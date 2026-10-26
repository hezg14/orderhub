import { Prisma, type OrderStatus } from '@prisma/client';
import { AppError } from '../lib/errors';
import {
  assertTransition,
  STATUS_LABEL,
  TRANSITIONS,
  type ApiLocale,
} from '../lib/order-state';
import { prisma } from '../lib/prisma';
import type { CreateOrderInput, ListOrdersQuery } from '../schemas';
import { writeAudit } from './audit.service';

interface LockedProduct {
  id: string;
  stock: number;
  unit_price: Prisma.Decimal;
  name: string;
}

const money = (d: Prisma.Decimal) => Number(d.toFixed(2));

/**
 * Order numbers are per-day sequential: #241019-001.
 *
 * `count(*) + 1` races: two requests read 7 at the same time and both write 008.
 * A transaction-scoped advisory lock serialises the read-modify-write and is
 * released automatically on commit/rollback, so the unique index stays clean.
 */
async function nextOrderNo(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `#${y}${m}${d}-`;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'order_no:' + prefix}))`;

  const last = await tx.$queryRaw<{ order_no: string }[]>`
    SELECT order_no FROM orders
    WHERE order_no LIKE ${prefix + '%'}
    ORDER BY order_no DESC
    LIMIT 1`;

  const seq = last.length > 0 ? parseInt(last[0]!.order_no.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(seq).padStart(3, '0');
}

export { TRANSITIONS, STATUS_LABEL, assertTransition };


/* ------------------------------------------------------------------ create */

interface LockedCustomer {
  id: string;
  name: string;
  credit_limit: Prisma.Decimal | null;
}

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { items: { include: { product: true } }; customer: true };
}>;

export interface CreateOrderResult {
  order: OrderWithRelations;
  /** True when the Idempotency-Key had already been used — the stored order is returned. */
  replay: boolean;
}

/**
 * Replay lookup shared by the fast-path and the insert-race recovery.
 * Scoped to the caller: a key belongs to the account that created it, so a
 * leaked key can never hand one user's order to another (the loser of that
 * lookup falls through to the unique-violation path and gets a plain 409).
 */
async function findReplay(key: string, userId: string): Promise<OrderWithRelations | null> {
  const row = await prisma.idempotencyKey.findUnique({
    where: { key },
    include: { order: { include: { items: { include: { product: true } }, customer: true } } },
  });
  return row && row.userId === userId ? row.order : null;
}

export async function createOrder(
  input: CreateOrderInput,
  actorId: string,
  requestId: string,
  idempotencyKey?: string,
): Promise<CreateOrderResult> {
  // Duplicate product rows would each pass the stock check and oversell, so
  // merge them before the lock is taken.
  const merged = new Map<string, number>();
  for (const item of input.items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  const productIds = [...merged.keys()].sort();

  // Replay fast-path. The authoritative check stays inside the transaction —
  // the unique index on the key is what makes concurrent retries safe.
  if (idempotencyKey) {
    const existing = await findReplay(idempotencyKey, actorId);
    if (existing) return { order: existing, replay: true };
  }

  try {
    const order = await prisma.$transaction(
      async (tx) => {
        // Lock the customer row too: the credit check must not run against a
        // snapshot that two concurrent orders can both fit into.
        const customers = await tx.$queryRaw<LockedCustomer[]>`
          SELECT id, name, credit_limit
          FROM customers
          WHERE id = ${input.customerId}::uuid
          FOR UPDATE`;
        const customer = customers[0];
        if (!customer) throw AppError.notFound('Customer');

        // ORDER BY id is mandatory: two concurrent orders touching the same two
        // products in opposite order deadlock otherwise.
        const products = await tx.$queryRaw<LockedProduct[]>`
          SELECT id, stock, unit_price, name
          FROM products
          WHERE id = ANY(${productIds}::uuid[])
          ORDER BY id
          FOR UPDATE`;

        if (products.length !== productIds.length) {
          throw AppError.notFound('One of the selected products');
        }

        const byId = new Map(products.map((p) => [p.id, p]));
        const shortages: { productId: string; name: string; available: number; requested: number }[] = [];

        for (const [productId, qty] of merged) {
          const p = byId.get(productId)!;
          if (p.stock < qty) {
            shortages.push({ productId, name: p.name, available: p.stock, requested: qty });
          }
        }
        if (shortages.length > 0) {
          throw AppError.conflict('Not enough stock for some items', shortages);
        }

        let subtotal = new Prisma.Decimal(0);
        const lines = [...merged].map(([productId, quantity]) => {
          const p = byId.get(productId)!;
          const lineTotal = p.unit_price.mul(quantity);
          subtotal = subtotal.add(lineTotal);
          return {
            productId,
            quantity,
            unitPrice: p.unit_price,
            subtotal: lineTotal,
          };
        });

        const discount = new Prisma.Decimal(input.discount);
        if (discount.greaterThan(subtotal)) {
          throw AppError.rule('Discount cannot exceed the subtotal', {
            subtotal: money(subtotal),
            discount: input.discount,
          });
        }
        const total = subtotal.sub(discount);

        // Credit control. NULL limit = cash customer, skip. Receivable is the
        // sum of the customer's unsettled (pending) orders; the customer row
        // lock above serialises concurrent check-then-insert for the account.
        if (customer.credit_limit != null) {
          const rows = await tx.$queryRaw<{ receivable: Prisma.Decimal }[]>`
            SELECT COALESCE(SUM(total), 0) AS receivable
            FROM orders
            WHERE customer_id = ${input.customerId}::uuid AND status = 'pending'`;
          const receivable = rows[0]?.receivable ?? new Prisma.Decimal(0);
          if (receivable.add(total).greaterThan(customer.credit_limit)) {
            throw AppError.rule('Credit limit exceeded for this customer', {
              reason: 'CREDIT_LIMIT_EXCEEDED',
              creditLimit: money(customer.credit_limit),
              receivable: money(receivable),
              attemptedTotal: money(total),
              shortfall: money(receivable.add(total).sub(customer.credit_limit)),
            });
          }
        }

        const orderNo = await nextOrderNo(tx);

        const order = await tx.order.create({
          data: {
            orderNo,
            customerId: input.customerId,
            status: 'pending',
            subtotal,
            discount,
            total,
            note: input.note || null,
            createdBy: actorId,
            items: { create: lines },
          },
          include: { items: { include: { product: true } }, customer: true },
        });

        // Decrement in one statement per product; the row is already locked.
        for (const [productId, qty] of merged) {
          await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: qty } },
          });
        }

        await writeAudit(tx, {
          userId: actorId,
          action: 'create',
          entity: 'order',
          entityId: order.id,
          requestId,
          detail: {
            orderNo,
            customer: customer.name,
            total: money(total),
            lines: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: money(l.unitPrice),
            })),
          },
        });

        // The key commits atomically with the order it produced: a replay can
        // only ever observe a fully-created order, never a half transaction.
        if (idempotencyKey) {
          await tx.idempotencyKey.create({
            data: { key: idempotencyKey, orderId: order.id, userId: actorId },
          });
        }

        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
    );

    return { order, replay: false };
  } catch (e) {
    // Lost the key-insert race against a concurrent identical retry: the
    // winner committed key + order together, so hand back that order instead
    // of surfacing a unique-violation.
    if (
      idempotencyKey &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const existing = await findReplay(idempotencyKey, actorId);
      if (existing) return { order: existing, replay: true };
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ status */

export async function changeStatus(
  orderId: string,
  next: OrderStatus,
  actor: { id: string; role: string },
  requestId: string,
  reason?: string,
  locale: ApiLocale = 'zh',
) {
  if (next === 'cancelled' && actor.role !== 'admin') {
    throw AppError.forbidden('Only an owner can cancel an order');
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!current) throw AppError.notFound('Order');

    assertTransition(current.status, next, locale);

    const order = await tx.order.update({
      where: { id: orderId },
      data: { status: next },
      include: { customer: true, items: { include: { product: true } } },
    });

    // Cancelling a pending order returns the reserved stock.
    if (next === 'cancelled') {
      const ids = current.items.map((i) => i.productId).sort();
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM products WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
      if (locked.length !== ids.length) throw AppError.notFound('Product');

      for (const item of current.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    await writeAudit(tx, {
      userId: actor.id,
      action: 'update',
      entity: 'order',
      entityId: orderId,
      requestId,
      detail: {
        field: 'status',
        from: current.status,
        to: next,
        ...(reason ? { reason } : {}),
        ...(next === 'cancelled' ? { stockReturned: true } : {}),
      },
    });

    return order;
  });
}

/* -------------------------------------------------------------------- read */

export async function listOrders(q: ListOrdersQuery) {
  const where: Prisma.OrderWhereInput = {};

  if (q.status) where.status = q.status;
  if (q.customerId) where.customerId = q.customerId;
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: new Date(`${q.from}T00:00:00.000Z`) } : {}),
      ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}),
    };
  }
  if (q.q) {
    where.OR = [
      { orderNo: { contains: q.q, mode: 'insensitive' } },
      { customer: { name: { contains: q.q, mode: 'insensitive' } } },
      { customer: { nameEn: { contains: q.q, mode: 'insensitive' } } },
      { customer: { company: { contains: q.q, mode: 'insensitive' } } },
      { customer: { companyEn: { contains: q.q, mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, nameEn: true, company: true, companyEn: true },
        },
      },
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      creator: { select: { id: true, name: true, nameEn: true, email: true } },
      items: { include: { product: true } },
    },
  });
  if (!order) throw AppError.notFound('Order');

  const logs = await prisma.auditLog.findMany({
    where: { entity: 'order', entityId: id },
    include: { user: { select: { name: true, nameEn: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return { ...order, timeline: logs };
}

export async function deleteOrder(id: string, actorId: string, requestId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw AppError.notFound('Order');
    if (order.status !== 'pending') {
      throw AppError.rule(
        `Only an unpaid order can be deleted. This one is ${STATUS_LABEL[order.status]}.`,
        { current: order.status, allowed: ['pending'] },
      );
    }

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    await tx.order.delete({ where: { id } });

    await writeAudit(tx, {
      userId: actorId,
      action: 'delete',
      entity: 'order',
      entityId: id,
      requestId,
      detail: { orderNo: order.orderNo, total: money(order.total), stockReturned: true },
    });
  });
}


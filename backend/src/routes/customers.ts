import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler, ok, paged } from '../lib/http';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import { validateBody, validateQuery } from '../middlewares/validate';
import {
  createCustomerWriteSchema,
  listCustomersQuery,
  updateCustomerWriteSchema,
  type CreateCustomerInput,
} from '../schemas';
import { writeAuditStandalone } from '../services/audit.service';

export const customersRouter = Router();
customersRouter.use(authenticate);

interface CustomerRow {
  id: string;
  name: string;
  /** Bilingual columns are optional: legacy rows may predate them. */
  name_en: string | null;
  company: string | null;
  company_en: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  credit_limit: Prisma.Decimal | null;
  created_at: Date;
  order_count: number;
  total_spent: Prisma.Decimal;
  receivable: Prisma.Decimal;
  last_order_at: Date | null;
}

const SORTS: Record<string, Prisma.Sql> = {
  recent: Prisma.sql`ORDER BY last_order_at DESC NULLS LAST, c.name ASC`,
  name: Prisma.sql`ORDER BY c.name ASC`,
  spend: Prisma.sql`ORDER BY total_spent DESC, c.name ASC`,
};

customersRouter.get(
  '/',
  validateQuery(listCustomersQuery),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as {
      page: number;
      pageSize: number;
      q?: string;
      sort: keyof typeof SORTS;
    };
    const search = q.q ? `%${q.q}%` : null;

    const rows = await prisma.$queryRaw<CustomerRow[]>(Prisma.sql`
      SELECT c.id, c.name, c.name_en, c.company, c.company_en, c.email, c.phone, c.address, c.note, c.created_at, c.credit_limit,
             COUNT(o.id)::int AS order_count,
             COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS total_spent,
             COALESCE(SUM(o.total) FILTER (WHERE o.status = 'pending'), 0) AS receivable,
             MAX(o.created_at) AS last_order_at
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE (${search}::text IS NULL
             OR c.name ILIKE ${search}
             OR c.name_en ILIKE ${search}
             OR c.company ILIKE ${search}
             OR c.company_en ILIKE ${search}
             OR c.phone ILIKE ${search})
      GROUP BY c.id
      ${SORTS[q.sort] ?? SORTS.recent!}
      LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}
    `);

    // noUncheckedIndexedAccess: a raw row may be undefined, so destructure safely.
    const countRows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count FROM customers c
      WHERE (${search}::text IS NULL
             OR c.name ILIKE ${search}
             OR c.name_en ILIKE ${search}
             OR c.company ILIKE ${search}
             OR c.company_en ILIKE ${search}
             OR c.phone ILIKE ${search})
    `);
    const count = countRows[0]?.count ?? 0;

    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      nameEn: r.name_en,
      company: r.company,
      companyEn: r.company_en,
      email: r.email,
      phone: r.phone,
      address: r.address,
      note: r.note,
      creditLimit: r.credit_limit == null ? null : Number(r.credit_limit),
      createdAt: r.created_at,
      orderCount: r.order_count,
      totalSpent: Number(r.total_spent),
      receivable: Number(r.receivable),
      lastOrderAt: r.last_order_at,
    }));

    return paged(res, data, count, q.page, q.pageSize);
  }),
);

customersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw AppError.notFound('Customer');

    const [agg, pendingAgg, recentOrders] = await prisma.$transaction([
      prisma.order.aggregate({
        where: { customerId: id, status: { not: 'cancelled' } },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
        _avg: { total: true },
      }),
      // Receivable = unsettled (pending) orders; feeds the credit-usage bar.
      prisma.order.aggregate({
        where: { customerId: id, status: 'pending' },
        _count: { _all: true },
        _sum: { total: true },
        _min: { createdAt: true },
      }),
      prisma.order.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return ok(res, {
      ...customer,
      stats: {
        orders: agg._count._all,
        revenue: Number(agg._sum.total ?? 0),
        avgOrder: Number(agg._avg.total ?? 0),
        lastOrderAt: agg._max.createdAt,
        receivable: Number(pendingAgg._sum.total ?? 0),
        pendingOrders: pendingAgg._count._all,
        oldestPendingAt: pendingAgg._min.createdAt,
      },
      recentOrders,
    });
  }),
);

customersRouter.post(
  '/',
  validateBody(createCustomerWriteSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CreateCustomerInput & { creditLimit?: number | null };
    if (input.creditLimit !== undefined && req.user!.role !== 'admin') {
      throw AppError.forbidden('Only an admin can set a credit limit');
    }
    const customer = await prisma.customer.create({
      data: {
        ...input,
        company: input.company || null,
        email: input.email || null,
        creditLimit: input.creditLimit ?? null,
      },
    });
    await writeAuditStandalone({
      userId: req.user!.id,
      action: 'create',
      entity: 'customer',
      entityId: customer.id,
      detail: { name: customer.name },
      requestId: req.requestId,
    });
    return ok(res, customer, 201);
  }),
);

customersRouter.patch(
  '/:id',
  validateBody(updateCustomerWriteSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    // The credit ceiling is financial policy: reading it is everyone's job,
    // changing it is the owner's.
    if ('creditLimit' in (req.body as object) && req.user!.role !== 'admin') {
      throw AppError.forbidden('Only an admin can change a credit limit');
    }
    const before = await prisma.customer.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Customer');

    const customer = await prisma.customer.update({ where: { id }, data: req.body });
    const changes = Object.fromEntries(
      Object.keys(req.body as object)
        .filter((k) => (before as Record<string, unknown>)[k] !== (req.body as Record<string, unknown>)[k])
        .map((k) => [k, { from: (before as Record<string, unknown>)[k], to: (req.body as Record<string, unknown>)[k] }]),
    );

    await writeAuditStandalone({
      userId: req.user!.id,
      action: 'update',
      entity: 'customer',
      entityId: id,
      // req.body is JSON-parsed by Express, so the values are JSON-safe at
      // runtime; the unknown→InputJsonValue gap is a TS limitation only.
      detail: { changes } as unknown as Prisma.InputJsonValue,
      requestId: req.requestId,
    });
    return ok(res, customer);
  }),
);

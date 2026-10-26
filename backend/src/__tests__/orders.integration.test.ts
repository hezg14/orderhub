/**
 * Integration tests against a real PostgreSQL — the layer pure unit tests
 * cannot reach. Requires `DATABASE_URL` with migrations applied (the docker
 * compose DB is fine); they create their own rows and clean up after.
 *
 * Covered here, because these are exactly the claims the README makes:
 *  - concurrent order creation must not oversell the last unit of stock
 *  - an Idempotency-Key retry returns the original order, never a duplicate
 *  - the credit ceiling blocks an order that would push receivables over it
 */
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';

const PASSWORD = 'Concurrency-Test-1234';
const EMAIL = `concurrency-${randomUUID().slice(0, 8)}@orderhub.test`;

let server: Server;
let base: string;
let cookie = '';

async function api(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? {} : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

const login = async () => {
  const res = await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  expect(res.status).toBe(200);
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('oh_token='));
  if (!raw) throw new Error('login did not set a cookie');
  cookie = raw.split(';')[0]!;
};

let customerId = '';
let productId = '';
const userIds: string[] = [];
const orderIds: string[] = [];

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: 'Concurrency Test',
      role: 'admin',
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    },
  });
  userIds.push(user.id);

  const customer = await prisma.customer.create({
    // No credit control here — the credit test creates its own limited account.
    data: { name: '并发测试客户' },
  });
  customerId = customer.id;

  const product = await prisma.product.create({
    data: { sku: `TST-${randomUUID().slice(0, 8)}`, name: '并发测试商品', category: '测试', unitPrice: 3000, stock: 1 },
  });
  productId = product.id;

  server = createApp().listen(0);
  const addr = server.address();
  if (addr && typeof addr === 'object') base = `http://127.0.0.1:${addr.port}`;
  await login();
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Children first: orders restrict customer deletion, keys cascade with orders.
  if (orderIds.length > 0) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.idempotencyKey.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

function track(body: any): any {
  if (body?.data?.id) orderIds.push(body.data.id as string);
  return body;
}

describe('concurrent order creation (anti-oversell)', () => {
  it('lets exactly one of N racing requests buy the last unit', async () => {
    const payload = { customerId, items: [{ productId, quantity: 1 }] };

    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => api('POST', '/api/orders', payload)),
    );

    const created = attempts.filter((r) => r.status === 201);
    const rejected = attempts.filter((r) => r.status !== 201);
    expect(created).toHaveLength(1);
    expect(rejected.every((r) => r.status === 409)).toBe(true);
    track(created[0]!.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stock).toBe(0);

    // Exactly one order row with exactly one line — not one order with two.
    const items = await prisma.orderItem.findMany({ where: { productId } });
    expect(items).toHaveLength(1);
  });
});

describe('idempotent order creation', () => {
  it('replays the same order for the same Idempotency-Key', async () => {
    const key = randomUUID();
    const payload = { customerId, items: [{ productId: await highStockProduct(), quantity: 1 }] };

    const first = await api('POST', '/api/orders', payload, { 'idempotency-key': key });
    expect(first.status).toBe(201);
    expect(first.headers.get('idempotent-replay')).toBeNull();
    track(first.body);

    const retry = await api('POST', '/api/orders', payload, { 'idempotency-key': key });
    expect(retry.status).toBe(201);
    expect(retry.headers.get('idempotent-replay')).toBe('true');
    track(retry.body);

    expect(retry.body.data.id).toBe(first.body.data.id);
  });

  it('rejects a malformed key before touching the database', async () => {
    const res = await api('POST', '/api/orders', { customerId, items: [] }, {
      'idempotency-key': 'not-a-uuid',
    });
    expect(res.status).toBe(400);
  });
});

describe('credit limit enforcement', () => {
  it('blocks an order that would push receivables past the ceiling, and unblocks after payment', async () => {
    // Fresh customer, limit ¥5000; the product costs ¥3000/unit.
    const limited = await prisma.customer.create({
      data: { name: '信用额度测试客户', creditLimit: 5000 },
    });

    const attempt = await api('POST', '/api/orders', {
      customerId: limited.id,
      items: [{ productId: await highStockProduct(), quantity: 2 }], // ¥6000 > ¥5000
    });
    expect(attempt.status).toBe(422);
    expect(attempt.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(attempt.body.error.details?.reason).toBe('CREDIT_LIMIT_EXCEEDED');
    expect(attempt.body.error.details?.creditLimit).toBe(5000);

    const first = await api('POST', '/api/orders', {
      customerId: limited.id,
      items: [{ productId: await highStockProduct(), quantity: 1 }], // ¥3000 ≤ ¥5000
    });
    expect(first.status).toBe(201);
    track(first.body);

    // Receivable is now ¥3000; another ¥3000 order would land at ¥6000.
    const second = await api('POST', '/api/orders', {
      customerId: limited.id,
      items: [{ productId: await highStockProduct(), quantity: 1 }],
    });
    expect(second.status).toBe(422);
    expect(second.body.error.details?.receivable).toBe(3000);
    expect(second.body.error.details?.shortfall).toBe(1000);

    // Settle the first order — receivable drops to 0, the same order now fits.
    const pay = await api('PATCH', `/api/orders/${first.body.data.id}/status`, { status: 'paid' });
    expect(pay.status).toBe(200);

    const third = await api('POST', '/api/orders', {
      customerId: limited.id,
      items: [{ productId: await highStockProduct(), quantity: 1 }],
    });
    expect(third.status).toBe(201);
    track(third.body);

    await prisma.order.deleteMany({ where: { customerId: limited.id } });
    await prisma.customer.delete({ where: { id: limited.id } });
  });
});

/** Shared helper: a throwaway product with ample stock for non-oversell tests. */
let highStockId: string | null = null;
async function highStockProduct(): Promise<string> {
  if (highStockId) return highStockId;
  const product = await prisma.product.create({
    data: {
      sku: `TST-HIGH-${randomUUID().slice(0, 8)}`,
      name: '余量测试商品',
      category: '测试',
      unitPrice: 3000,
      stock: 100,
    },
  });
  highStockId = product.id;
  cleanupHighStock = product.id;
  return product.id;
}
let cleanupHighStock: string | null = null;
afterAll(async () => {
  if (cleanupHighStock) {
    await prisma.product.delete({ where: { id: cleanupHighStock } }).catch(() => undefined);
  }
});

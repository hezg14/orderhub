import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * Metric definitions live here and nowhere else.
 * PRD §4.2 is explicit about each one; a second implementation in the frontend
 * would drift within a week.
 */
const REVENUE_STATUSES: OrderStatus[] = ['paid', 'shipped', 'completed'];

export type Range = 'week' | 'month' | 'quarter';

function rangeStart(range: Range, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === 'week') d.setDate(d.getDate() - 6);
  else if (range === 'month') d.setDate(d.getDate() - 29);
  else d.setDate(d.getDate() - 89);
  return d;
}

export async function getStats(range: Range = 'month') {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // One round trip instead of five; each subquery hits an existing index.
  const [row] = await prisma.$queryRaw<
    {
      today_orders: bigint;
      today_amount: Prisma.Decimal;
      month_revenue: Prisma.Decimal;
      prev_month_revenue: Prisma.Decimal;
      to_ship: bigint;
      to_ship_amount: Prisma.Decimal;
      active_customers: bigint;
      total_customers: bigint;
      pending_orders: bigint;
    }[]
  >(
    Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM orders
          WHERE created_at >= ${todayStart} AND status <> 'cancelled')                AS today_orders,
        (SELECT COALESCE(SUM(total), 0) FROM orders
          WHERE created_at >= ${todayStart} AND status <> 'cancelled')                AS today_amount,
        (SELECT COALESCE(SUM(total), 0) FROM orders
          WHERE created_at >= ${monthStart}
            AND status IN ('paid','shipped','completed'))                             AS month_revenue,
        (SELECT COALESCE(SUM(total), 0) FROM orders
          WHERE created_at >= ${prevMonthStart} AND created_at < ${monthStart}
            AND status IN ('paid','shipped','completed'))                             AS prev_month_revenue,
        (SELECT COUNT(*) FROM orders WHERE status = 'paid')                           AS to_ship,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'paid')            AS to_ship_amount,
        (SELECT COUNT(DISTINCT customer_id) FROM orders
          WHERE created_at >= ${thirtyDaysAgo})                                       AS active_customers,
        (SELECT COUNT(*) FROM customers)                                              AS total_customers,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending')                        AS pending_orders
    `,
  );

  const pct = (cur: number, prev: number) =>
    prev === 0 ? (cur === 0 ? 0 : 100) : Math.round(((cur - prev) / prev) * 1000) / 10;

  return {
    range,
    todayOrders: Number(row!.today_orders),
    todayAmount: Number(row!.today_amount),
    monthRevenue: Number(row!.month_revenue),
    monthRevenueDelta: pct(Number(row!.month_revenue), Number(row!.prev_month_revenue)),
    toShip: Number(row!.to_ship),
    toShipAmount: Number(row!.to_ship_amount),
    activeCustomers: Number(row!.active_customers),
    totalCustomers: Number(row!.total_customers),
    pendingOrders: Number(row!.pending_orders),
  };
}

export async function getCharts(range: Range = 'month') {
  const to = new Date();
  const from = rangeStart(range, to);

  const trend = await prisma.$queryRaw<{ label: string; value: Prisma.Decimal; orders: bigint }[]>(
    Prisma.sql`
      SELECT to_char(d.day, 'MM-DD') AS label,
             COALESCE(SUM(o.total), 0) AS value,
             COUNT(o.id) AS orders
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS d(day)
      LEFT JOIN orders o
        ON o.created_at >= d.day
       AND o.created_at <  d.day + interval '1 day'
       AND o.status IN ('paid','shipped','completed')
      GROUP BY d.day
      ORDER BY d.day
    `,
  );

  const byStatus = await prisma.order.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { createdAt: { gte: from } },
  });

  const topProducts = await prisma.$queryRaw<
    { name: string; name_en: string | null; qty: bigint; revenue: Prisma.Decimal }[]
  >(
    Prisma.sql`
      SELECT p.name, p.name_en,
             SUM(oi.quantity)          AS qty,
             SUM(oi.subtotal)          AS revenue
      FROM order_items oi
      JOIN products p  ON p.id = oi.product_id
      JOIN orders   o  ON o.id = oi.order_id
      WHERE o.created_at >= ${from} AND o.status <> 'cancelled'
      GROUP BY p.id, p.name, p.name_en
      ORDER BY qty DESC
      LIMIT 5
    `,
  );

  return {
    trend: trend.map((t) => ({ label: t.label, value: Number(t.value), orders: Number(t.orders) })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    topProducts: topProducts.map((p) => ({
      name: p.name,
      nameEn: p.name_en,
      quantity: Number(p.qty),
      revenue: Number(p.revenue),
    })),
  };
}

export async function getRecentOrders(limit = 10) {
  return prisma.order.findMany({
    include: { customer: { select: { id: true, name: true, nameEn: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

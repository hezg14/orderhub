import { Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';
import { statusLabel, type ApiLocale } from '../lib/order-state';
import { prisma } from '../lib/prisma';
import type { ReportQuery } from '../schemas';

export type ReportType = 'orders' | 'customers' | 'products';

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ReportResult {
  type: ReportType;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  total: number;
  range: { from: string; to: string };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function resolveRange(q: ReportQuery) {
  const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
  const from = q.from
    ? new Date(`${q.from}T00:00:00.000Z`)
    : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));
  return { from, to };
}

async function ordersReport(from: Date, to: Date, locale: ApiLocale) {
  const rows = await prisma.$queryRaw<
    {
      order_no: string;
      created_at: Date;
      customer: string;
      customer_en: string | null;
      status: string;
      subtotal: Prisma.Decimal;
      discount: Prisma.Decimal;
      total: Prisma.Decimal;
      items: bigint;
      created_by: string;
      created_by_en: string | null;
    }[]
  >(Prisma.sql`
    SELECT o.order_no,
           o.created_at,
           c.name AS customer,
           c.name_en AS customer_en,
           o.status::text AS status,
           o.subtotal, o.discount, o.total,
           COUNT(oi.id) AS items,
           u.name AS created_by,
           u.name_en AS created_by_en
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN users     u ON u.id = o.created_by
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.created_at BETWEEN ${from} AND ${to}
    GROUP BY o.id, c.name, c.name_en, u.name, u.name_en
    ORDER BY o.created_at DESC
  `);

  const pick = (zh: string, en: string | null) => (locale === 'en' ? (en ?? zh) : zh);

  return rows.map((r) => ({
    orderNo: r.order_no,
    date: isoDate(r.created_at),
    customer: pick(r.customer, r.customer_en),
    // Exports use the same status wording as the UI instead of the raw enum.
    status: statusLabel(r.status as OrderStatus, locale),
    items: Number(r.items),
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    total: Number(r.total),
    createdBy: pick(r.created_by, r.created_by_en),
  }));
}

async function customersReport(from: Date, to: Date, locale: ApiLocale) {
  const rows = await prisma.$queryRaw<
    {
      name: string;
      name_en: string | null;
      company: string | null;
      company_en: string | null;
      phone: string | null;
      orders: bigint;
      revenue: Prisma.Decimal;
      last_order: Date | null;
    }[]
  >(Prisma.sql`
    SELECT c.name, c.name_en, c.company, c.company_en, c.phone,
           COUNT(o.id) FILTER (WHERE o.status <> 'cancelled') AS orders,
           COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS revenue,
           MAX(o.created_at) AS last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.created_at BETWEEN ${from} AND ${to}
    GROUP BY c.id
    ORDER BY revenue DESC, c.name ASC
  `);

  const pick = (zh: string, en: string | null) => (locale === 'en' ? (en ?? zh) : zh);

  return rows.map((r) => ({
    customer: pick(r.name, r.name_en),
    company: pick(r.company ?? '—', r.company_en) ?? '—',
    phone: r.phone ?? '—',
    orders: Number(r.orders),
    revenue: Number(r.revenue),
    lastOrder: r.last_order ? isoDate(r.last_order) : '—',
  }));
}

async function productsReport(from: Date, to: Date, locale: ApiLocale) {
  // The date filter must live inside the joined set. Putting it on the
  // `LEFT JOIN orders` clause keeps every order_item row and only nulls the
  // order — SUM(oi.quantity) would then count sales from outside the range.
  const rows = await prisma.$queryRaw<
    {
      sku: string;
      name: string;
      name_en: string | null;
      category: string;
      qty: bigint | null;
      revenue: Prisma.Decimal | null;
      stock: number;
    }[]
  >(Prisma.sql`
    SELECT p.sku, p.name, p.name_en, p.category, p.stock,
           SUM(s.quantity) AS qty,
           SUM(s.subtotal) AS revenue
    FROM products p
    LEFT JOIN (
      SELECT oi.product_id, oi.quantity, oi.subtotal
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at BETWEEN ${from} AND ${to}
        AND o.status <> 'cancelled'
    ) s ON s.product_id = p.id
    GROUP BY p.id
    ORDER BY COALESCE(SUM(s.quantity), 0) DESC, p.name ASC
  `);

  return rows.map((r) => ({
    sku: r.sku,
    product: locale === 'en' ? (r.name_en ?? r.name) : r.name,
    category: r.category,
    sold: Number(r.qty ?? 0),
    revenue: Number(r.revenue ?? 0),
    stock: r.stock,
  }));
}

const COLUMNS: Record<ReportType, Record<ApiLocale, ReportColumn[]>> = {
  orders: {
    zh: [
      { key: 'orderNo', label: '订单号' },
      { key: 'date', label: '下单日期' },
      { key: 'customer', label: '客户' },
      { key: 'status', label: '状态' },
      { key: 'items', label: '商品行数', align: 'right' },
      { key: 'subtotal', label: '小计', align: 'right' },
      { key: 'discount', label: '优惠', align: 'right' },
      { key: 'total', label: '合计', align: 'right' },
      { key: 'createdBy', label: '开单人' },
    ],
    en: [
      { key: 'orderNo', label: 'Order no.' },
      { key: 'date', label: 'Date' },
      { key: 'customer', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'items', label: 'Items', align: 'right' },
      { key: 'subtotal', label: 'Subtotal', align: 'right' },
      { key: 'discount', label: 'Discount', align: 'right' },
      { key: 'total', label: 'Total', align: 'right' },
      { key: 'createdBy', label: 'Created by' },
    ],
  },
  customers: {
    zh: [
      { key: 'customer', label: '客户' },
      { key: 'company', label: '公司' },
      { key: 'phone', label: '电话' },
      { key: 'orders', label: '订单数', align: 'right' },
      { key: 'revenue', label: '累计金额', align: 'right' },
      { key: 'lastOrder', label: '最近下单' },
    ],
    en: [
      { key: 'customer', label: 'Customer' },
      { key: 'company', label: 'Company' },
      { key: 'phone', label: 'Phone' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right' },
      { key: 'lastOrder', label: 'Last order' },
    ],
  },
  products: {
    zh: [
      { key: 'sku', label: 'SKU' },
      { key: 'product', label: '商品' },
      { key: 'category', label: '分类' },
      { key: 'sold', label: '销量', align: 'right' },
      { key: 'revenue', label: '销售额', align: 'right' },
      { key: 'stock', label: '当前库存', align: 'right' },
    ],
    en: [
      { key: 'sku', label: 'SKU' },
      { key: 'product', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'sold', label: 'Sold', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right' },
      { key: 'stock', label: 'Stock on hand', align: 'right' },
    ],
  },
};

const TITLES: Record<ReportType, Record<ApiLocale, string>> = {
  orders: { zh: '订单明细', en: 'Order detail' },
  customers: { zh: '客户交易汇总', en: 'Customer revenue' },
  products: { zh: '商品销售汇总', en: 'Product sales' },
};

export async function buildReport(
  q: ReportQuery,
  previewRows?: number,
  locale: ApiLocale = 'zh',
): Promise<ReportResult> {
  const { from, to } = resolveRange(q);

  const all =
    q.type === 'customers'
      ? await customersReport(from, to, locale)
      : q.type === 'products'
        ? await productsReport(from, to, locale)
        : await ordersReport(from, to, locale);

  return {
    type: q.type,
    title: TITLES[q.type][locale],
    columns: COLUMNS[q.type][locale],
    rows: previewRows ? all.slice(0, previewRows) : all,
    total: all.length,
    range: { from: isoDate(from), to: isoDate(to) },
  };
}

/* --------------------------------------------------------------------- csv */

/**
 * A cell starting with = + - @ is executed as a formula when the file is opened
 * in Excel. Prefix with a single quote so the value stays text.
 */
function sanitise(value: string | number): string {
  const s = String(value ?? '');
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function toCsv(report: ReportResult): string {
  const header = report.columns.map((c) => sanitise(c.label)).join(',');
  const body = report.rows.map((row) =>
    report.columns.map((c) => sanitise(row[c.key] ?? '')).join(','),
  );
  // U+FEFF is what makes Excel on Windows read the file as UTF-8 instead of ANSI.
  return '\uFEFF' + [header, ...body].join('\r\n');
}

export function csvFilename(type: ReportType, range: ReportResult['range']) {
  return `${type}-${range.from}_${range.to}.csv`;
}

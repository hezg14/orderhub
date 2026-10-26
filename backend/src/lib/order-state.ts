import type { OrderStatus } from '@prisma/client';
import { AppError } from './errors';

/**
 * The order state machine, deliberately free of Prisma so it can be unit tested
 * without a database and reused by any surface (API, seed script, future worker).
 *
 * PRD 5.1: forward only. Cancel is only reachable from pending.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

/** Locales the API can localise its messages into. */
export type ApiLocale = 'zh' | 'en';

const LABELS: Record<ApiLocale, Record<OrderStatus, string>> = {
  zh: {
    pending: '待付款',
    paid: '已付款',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消',
  },
  en: {
    pending: 'Pending payment',
    paid: 'Paid',
    shipped: 'Shipped',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
};

/** Kept for existing callers that always want the Chinese wording (seed, tests). */
export const STATUS_LABEL = LABELS.zh;

/** Locale-aware status label; falls back to Chinese for unknown locales. */
export function statusLabel(status: OrderStatus, locale: ApiLocale = 'zh'): string {
  return (LABELS[locale] ?? LABELS.zh)[status];
}

export const TERMINAL: ReadonlySet<OrderStatus> = new Set<OrderStatus>(['completed', 'cancelled']);

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Throws a 422 carrying the legal next states, so the UI can explain the rule
 * instead of showing "operation failed". Both the template and the status
 * labels follow the client's locale (Accept-Language), defaulting to Chinese.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus, locale: ApiLocale = 'zh'): void {
  if (canTransition(from, to)) return;

  const allowed = TRANSITIONS[from];
  const lbl = (s: OrderStatus) => statusLabel(s, locale);
  const message =
    locale === 'en'
      ? `Cannot move an order from ${lbl(from)} to ${lbl(to)}`
      : `订单不能从「${lbl(from)}」变更为「${lbl(to)}」`;
  const hint =
    allowed.length === 0
      ? locale === 'en'
        ? `${lbl(from)} is a terminal state`
        : `「${lbl(from)}」是终态，不能再流转`
      : locale === 'en'
        ? `${lbl(from)} can only move to: ${allowed.map(lbl).join(', ')}`
        : `「${lbl(from)}」只能流转到：${allowed.map(lbl).join('、')}`;
  throw AppError.rule(message, {
    current: from,
    requested: to,
    allowedNext: allowed,
    hint,
  });
}

/** Cancelling is owner-only (PRD 4.8). */
export function canCancel(role: string): boolean {
  return role === 'admin';
}

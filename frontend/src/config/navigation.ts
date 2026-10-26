import {
  Box,
  DataBoard,
  Document,
  Key,
  PriceTag,
  Setting,
  TrendCharts,
  User,
} from '@element-plus/icons-vue';
import type { Component } from 'vue';

/**
 * The navigation model, declared once.
 *
 * The sidebar and the command palette are two views of the same list — if they
 * each declared their own copy, adding a page to one would silently make it
 * unreachable from the other.
 */
export interface NavItem {
  path: string;
  labelKey: string;
  icon: Component;
  /** Matches only the exact path (the dashboard would otherwise swallow `/`). */
  exact?: boolean;
  admin?: boolean;
  /** Extra search terms for the palette, in both locales. */
  keywords?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'nav.dashboard', icon: DataBoard, exact: true, keywords: 'home overview 首页 概览 kpi' },
  { path: '/orders', labelKey: 'nav.orders', icon: Box, keywords: 'order sales 订单 销售' },
  { path: '/customers', labelKey: 'nav.customers', icon: User, keywords: 'customer client 客户' },
  { path: '/products', labelKey: 'nav.products', icon: PriceTag, keywords: 'product sku stock 商品 库存' },
  { path: '/reports', labelKey: 'nav.reports', icon: TrendCharts, admin: true, keywords: 'report export 报表 导出' },
  { path: '/audit', labelKey: 'nav.audit', icon: Document, admin: true, keywords: 'audit log activity 审计 日志' },
  { path: '/permissions', labelKey: 'nav.permissions', icon: Key, admin: true, keywords: 'permission role rbac member 权限 角色 成员' },
  { path: '/settings', labelKey: 'nav.settings', icon: Setting, keywords: 'settings profile account 设置 账号' },
];

/** Items the current role may actually reach — filtered, not merely hidden. */
export function navFor(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.admin || isAdmin);
}

/** The nav entry a path belongs to (longest matching prefix wins). */
export function activeNavPath(path: string, isAdmin: boolean): string {
  const match = navFor(isAdmin)
    .filter((m) => (m.exact ? path === m.path : path.startsWith(m.path)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.path ?? '/';
}

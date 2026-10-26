/**
 * The permission matrix, declared once and rendered by the Permissions page.
 *
 * It documents what the backend actually enforces (route-level `requireRole`
 * plus the order state machine) — it is a readable view of the server's rules,
 * never a substitute for them. When you change `middlewares/rbac.ts` or the
 * product routes, update the matching row here in the same commit.
 */
export interface PermissionRow {
  /** i18n key under `permissions.rows` */
  key: string;
  admin: boolean;
  staff: boolean;
  /** Why the difference exists, shown as a muted line on the page. */
  noteKey?: string;
}

export const PERMISSION_MATRIX: PermissionRow[] = [
  { key: 'ordersRead', admin: true, staff: true },
  { key: 'ordersWrite', admin: true, staff: true },
  { key: 'ordersCancel', admin: true, staff: false, noteKey: 'ordersCancel' },
  { key: 'ordersDelete', admin: true, staff: false, noteKey: 'ordersDelete' },
  { key: 'customers', admin: true, staff: true },
  { key: 'productsRead', admin: true, staff: true },
  { key: 'productsWrite', admin: true, staff: false, noteKey: 'productsWrite' },
  { key: 'reports', admin: true, staff: false, noteKey: 'reports' },
  { key: 'audit', admin: true, staff: false, noteKey: 'audit' },
  { key: 'members', admin: true, staff: false, noteKey: 'members' },
];

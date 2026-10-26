import type {
  AuditLog,
  Customer,
  CustomerDetail,
  DashboardCharts,
  DashboardStats,
  Order,
  OrderDetail,
  OrderStatus,
  OrderTransitions,
  Paged,
  PageMeta,
  Product,
  ReceivablesReport,
  ReportPreview,
  Role,
  User,
} from '@/types';
import { http } from './client';

type Envelope<T> = { data: T };
type PagedEnvelope<T> = { data: T[]; meta: PageMeta };

const unwrap = <T>(p: Promise<Envelope<T>>) => p.then((r) => r.data);
const unwrapPaged = <T>(p: Promise<PagedEnvelope<T>>): Promise<Paged<T>> =>
  p.then((r) => ({ data: r.data, meta: r.meta }));

/* -------------------------------------------------------------------- auth */

export const authApi = {
  login: (email: string, password: string) =>
    unwrap(http.post<Envelope<User>>('/auth/login', { email, password })),
  logout: () => unwrap(http.post<Envelope<{ ok: boolean }>>('/auth/logout')),
  me: () => unwrap(http.get<Envelope<User>>('/auth/me')),
  updateMe: (name: string) => unwrap(http.patch<Envelope<User>>('/auth/me', { name })),
};

/* --------------------------------------------------------------- dashboard */

export const dashboardApi = {
  stats: (range: string) => unwrap(http.get<Envelope<DashboardStats>>('/dashboard/stats', { params: { range } })),
  charts: (range: string) =>
    unwrap(http.get<Envelope<DashboardCharts>>('/dashboard/charts', { params: { range } })),
  recentOrders: () => unwrap(http.get<Envelope<Order[]>>('/dashboard/recent-orders')),
};

/* ------------------------------------------------------------------ orders */

export interface OrderQuery {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | '';
  customerId?: string;
  q?: string;
  from?: string;
  to?: string;
  sortBy?: 'createdAt' | 'total' | 'orderNo';
  sortDir?: 'asc' | 'desc';
}

export const ordersApi = {
  list: (params: OrderQuery) => unwrapPaged(http.get<PagedEnvelope<Order>>('/orders', { params })),
  get: (id: string) => unwrap(http.get<Envelope<OrderDetail>>(`/orders/${id}`)),
  create: (body: {
    customerId: string;
    note?: string;
    discount: number;
    items: { productId: string; quantity: number }[];
  }) =>
    unwrap(
      http.post<Envelope<Order>>('/orders', body, {
        // One UUID per API call: a network-level retry replays the same order
        // instead of double-creating. Double-clicks are guarded in the view.
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    ),
  changeStatus: (id: string, status: OrderStatus, reason?: string) =>
    unwrap(http.patch<Envelope<Order>>(`/orders/${id}/status`, { status, reason })),
  remove: (id: string) => unwrap(http.delete<Envelope<{ deleted: boolean }>>(`/orders/${id}`)),
  transitions: () => unwrap(http.get<Envelope<OrderTransitions>>('/orders/meta/transitions')),
};

/* --------------------------------------------------------------- customers */

export const customersApi = {
  list: (params: { page?: number; pageSize?: number; q?: string; sort?: string }) =>
    unwrapPaged(http.get<PagedEnvelope<Customer>>('/customers', { params })),
  get: (id: string) => unwrap(http.get<Envelope<CustomerDetail>>(`/customers/${id}`)),
  create: (body: Partial<Customer>) => unwrap(http.post<Envelope<Customer>>('/customers', body)),
  update: (id: string, body: Partial<Customer>) =>
    unwrap(http.patch<Envelope<Customer>>(`/customers/${id}`, body)),
};

/* ---------------------------------------------------------------- products */

export const productsApi = {
  list: (params: {
    page?: number;
    pageSize?: number;
    q?: string;
    category?: string;
    lowStock?: boolean;
  }) => unwrapPaged(http.get<PagedEnvelope<Product>>('/products', { params })),
  categories: () =>
    unwrap(http.get<Envelope<{ name: string; count: number }[]>>('/products/categories')),
  create: (body: Partial<Product>) => unwrap(http.post<Envelope<Product>>('/products', body)),
  update: (id: string, body: Partial<Product>) =>
    unwrap(http.patch<Envelope<Product>>(`/products/${id}`, body)),
};

/* ----------------------------------------------------------------- reports */

export type ReportType = 'orders' | 'customers' | 'products';

export const reportsApi = {
  preview: (params: { type: ReportType; from?: string; to?: string }) =>
    unwrap(http.get<Envelope<ReportPreview>>('/reports/preview', { params })),
  receivables: () => unwrap(http.get<Envelope<ReceivablesReport>>('/reports/receivables')),
  exportCsv: (params: { type: ReportType; from?: string; to?: string }) =>
    http.download('/reports/export', `${params.type}-${params.from ?? 'from'}_${params.to ?? 'to'}.csv`, params),
};

/* ------------------------------------------------------------------- audit */

export const auditApi = {
  list: (params: {
    page?: number;
    pageSize?: number;
    action?: string;
    userId?: string;
    entity?: string;
    from?: string;
    to?: string;
  }) => unwrapPaged(http.get<PagedEnvelope<AuditLog>>('/audit-logs', { params })),
};

/* ------------------------------------------------------------------- users */

export const usersApi = {
  list: () =>
    unwrap(
      http.get<Envelope<(User & { _count: { orders: number; auditLogs: number } })[]>>('/users'),
    ),
  invite: (body: { email: string; name: string; role: Role; password: string }) =>
    unwrap(http.post<Envelope<User>>('/users/invite', body)),
  changeRole: (id: string, role: Role) =>
    unwrap(http.patch<Envelope<User>>(`/users/${id}/role`, { role })),
};

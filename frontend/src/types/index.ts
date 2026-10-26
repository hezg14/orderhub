export type Role = 'admin' | 'staff';
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export interface User {
  id: string;
  email: string;
  name: string;
  nameEn?: string | null;
  role: Role;
  createdAt?: string;
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  actors?: { id: string; name: string }[];
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export interface Customer {
  id: string;
  name: string;
  nameEn?: string | null;
  company: string | null;
  companyEn?: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  createdAt: string;
  orderCount?: number;
  totalSpent?: number;
  /** Unsettled (pending) order total — echoed by list/detail for credit UI. */
  receivable?: number;
  /** Open-credit ceiling; null = cash customer, no credit control. */
  creditLimit?: number | null;
  lastOrderAt?: string | null;
}

export interface CustomerDetail extends Customer {
  stats: {
    orders: number;
    revenue: number;
    avgOrder: number;
    lastOrderAt: string | null;
    receivable: number;
    pendingOrders: number;
    oldestPendingAt: string | null;
  };
  recentOrders: Order[];
}

/* ------------------------------------------------------- receivables aging */

export interface ReceivableBucket {
  key: 'current' | 'd30' | 'd60' | 'd90';
  total: number;
  count: number;
}

export interface ReceivableCustomer {
  id: string;
  name: string;
  nameEn: string | null;
  company: string | null;
  companyEn: string | null;
  receivable: number;
  orderCount: number;
  oldestDays: number;
  creditLimit: number | null;
  usage: number | null;
}

export interface ReceivablesReport {
  buckets: ReceivableBucket[];
  customers: ReceivableCustomer[];
  grandTotal: number;
  totalPending: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  nameEn?: string | null;
  category: string;
  unitPrice: number;
  stock: number;
  createdAt: string;
  lowStock?: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: Product;
}

export interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Pick<Customer, 'id' | 'name' | 'nameEn' | 'company' | 'companyEn'>;
  creator?: Pick<User, 'id' | 'name' | 'email'>;
  items?: OrderItem[];
  timeline?: AuditLog[];
}

export interface OrderDetail extends Order {
  customer: Customer;
  creator: User;
  items: OrderItem[];
  timeline: AuditLog[];
}

export interface AuditLog {
  id: string;
  userId: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  detail: Record<string, unknown>;
  requestId: string | null;
  createdAt: string;
  user?: { id: string; name: string; role?: Role };
}

export interface DashboardStats {
  range: 'week' | 'month' | 'quarter';
  todayOrders: number;
  todayAmount: number;
  monthRevenue: number;
  monthRevenueDelta: number;
  toShip: number;
  toShipAmount: number;
  activeCustomers: number;
  totalCustomers: number;
  pendingOrders: number;
}

export interface DashboardCharts {
  trend: { label: string; value: number; orders: number }[];
  byStatus: { status: OrderStatus; count: number }[];
  topProducts: { name: string; nameEn?: string | null; quantity: number; revenue: number }[];
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ReportPreview {
  type: 'orders' | 'customers' | 'products';
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  total: number;
  range: { from: string; to: string };
}

export interface OrderTransitions {
  labels: Record<OrderStatus, string>;
  transitions: Record<OrderStatus, OrderStatus[]>;
}

import { z } from 'zod';

/* ------------------------------------------------------------------ common */

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const uuid = z.string().uuid('Must be a valid id');
const money = z.coerce.number().finite().min(0).max(99_999_999);

/* -------------------------------------------------------------------- auth */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(200),
});

/* ------------------------------------------------------------------- users */

export const updateMeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(80),
  role: z.enum(['admin', 'staff']).default('staff'),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
});

export const changeRoleSchema = z.object({
  role: z.enum(['admin', 'staff']),
});

/* ---------------------------------------------------------------- customers */

// Open-credit ceiling in CNY. Null clears credit control (cash customer);
// a number turns enforcement on inside order creation. Only admins may set it.
export const creditLimitSchema = z
  .number()
  .min(0, 'Credit limit cannot be negative')
  .max(99_999_999, 'Credit limit is unreasonably large');

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(120),
  company: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const updateCustomerSchema = createCustomerSchema.partial();

/** Same writes plus the financial field — admin-only enforcement in the route. */
export const createCustomerWriteSchema = createCustomerSchema.extend({
  creditLimit: creditLimitSchema.nullable().optional(),
});
export const updateCustomerWriteSchema = createCustomerWriteSchema.partial();

export const listCustomersQuery = pagination.extend({
  q: z.string().trim().max(120).optional(),
  sort: z.enum(['recent', 'name', 'spend']).default('recent'),
});

/* ----------------------------------------------------------------- products */

export const createProductSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9-_]+$/, 'SKU may only contain letters, numbers, dash and underscore'),
  name: z.string().trim().min(1, 'Product name is required').max(160),
  category: z.string().trim().min(1, 'Category is required').max(60),
  unitPrice: money,
  stock: z.coerce.number().int().min(0).max(1_000_000),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuery = pagination.extend({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

/* ------------------------------------------------------------------- orders */

export const orderItemSchema = z.object({
  productId: uuid,
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(100_000),
});

export const createOrderSchema = z.object({
  customerId: uuid,
  note: z.string().trim().max(500).optional().or(z.literal('')),
  discount: money.default(0),
  items: z.array(orderItemSchema).min(1, 'Add at least one product').max(100),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['paid', 'shipped', 'completed', 'cancelled']),
  reason: z.string().trim().max(300).optional(),
});

export const listOrdersQuery = pagination.extend({
  status: z
    .enum(['pending', 'paid', 'shipped', 'completed', 'cancelled'])
    .optional(),
  customerId: uuid.optional(),
  q: z.string().trim().max(120).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  sortBy: z.enum(['createdAt', 'total', 'orderNo']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

/* ----------------------------------------------------------------- reports */

export const reportQuery = z.object({
  type: z.enum(['orders', 'customers', 'products']).default('orders'),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

/* ------------------------------------------------------------------- audit */

export const listAuditQuery = pagination.extend({
  action: z.enum(['create', 'update', 'delete']).optional(),
  userId: uuid.optional(),
  entity: z.string().trim().max(40).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

/* ------------------------------------------------------------------- types */

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuery>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ListAuditQuery = z.infer<typeof listAuditQuery>;
export type ReportQuery = z.infer<typeof reportQuery>;

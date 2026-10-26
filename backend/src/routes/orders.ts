import { Router } from 'express';
import { asyncHandler, ok, paged, reqLocale } from '../lib/http';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateBody, validateQuery } from '../middlewares/validate';
import {
  createOrderSchema,
  listOrdersQuery,
  updateOrderStatusSchema,
  type CreateOrderInput,
  type ListOrdersQuery,
  type UpdateOrderStatusInput,
} from '../schemas';
import {
  changeStatus,
  createOrder,
  deleteOrder,
  getOrder,
  listOrders,
  TRANSITIONS,
  STATUS_LABEL,
} from '../services/order.service';
import type { OrderStatus } from '@prisma/client';

export const ordersRouter = Router();

ordersRouter.use(authenticate);

ordersRouter.get(
  '/',
  validateQuery(listOrdersQuery),
  asyncHandler(async (req, res) => {
    const result = await listOrders(req.query as unknown as ListOrdersQuery);
    return paged(res, result.rows, result.total, result.page, result.pageSize);
  }),
);

/** Static metadata the frontend uses to render state buttons. */
ordersRouter.get('/meta/transitions', (_req, res) =>
  ok(res, {
    labels: STATUS_LABEL,
    transitions: TRANSITIONS,
  }),
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => ok(res, await getOrder(req.params.id!))),
);

ordersRouter.post(
  '/',
  validateBody(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await createOrder(
      req.body as CreateOrderInput,
      req.user!.id,
      req.requestId,
    );
    return ok(res, order, 201);
  }),
);

ordersRouter.patch(
  '/:id/status',
  validateBody(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const { status, reason } = req.body as UpdateOrderStatusInput;
    const order = await changeStatus(
      req.params.id!,
      status as OrderStatus,
      { id: req.user!.id, role: req.user!.role },
      req.requestId,
      reason,
      reqLocale(req),
    );
    return ok(res, order);
  }),
);

ordersRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await deleteOrder(req.params.id!, req.user!.id, req.requestId);
    return ok(res, { deleted: true });
  }),
);

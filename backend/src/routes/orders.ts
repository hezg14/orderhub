import { Router } from 'express';
import { asyncHandler, ok, paged, reqLocale } from '../lib/http';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The client generates a UUID per logical submission (not per attempt), so a
 * network retry or a double-click replays the same order instead of creating
 * a duplicate. Absent header = opt out; malformed header = client bug.
 */
function idempotencyKeyOf(req: { get(name: string): string | undefined }): string | undefined {
  const raw = req.get('idempotency-key');
  if (raw === undefined || raw === '') return undefined;
  if (!UUID_RE.test(raw)) {
    throw new AppError('VALIDATION_ERROR', 'Idempotency-Key must be a UUID', {
      header: 'Idempotency-Key',
    });
  }
  return raw;
}

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
    // Lazy sweep: keys older than a day can no longer be replayed by any
    // sane retry, so the table stays bounded without a cron job.
    void prisma.idempotencyKey
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3_600_000) } } })
      .catch(() => undefined);

    const { order, replay } = await createOrder(
      req.body as CreateOrderInput,
      req.user!.id,
      req.requestId,
      idempotencyKeyOf(req),
    );
    if (replay) res.setHeader('Idempotent-Replay', 'true');
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

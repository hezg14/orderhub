import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../lib/http';
import { authenticate } from '../middlewares/auth';
import { validateQuery } from '../middlewares/validate';
import { getCharts, getRecentOrders, getStats } from '../services/dashboard.service';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

const rangeQuery = z.object({
  range: z.enum(['week', 'month', 'quarter']).default('month'),
});

dashboardRouter.get(
  '/stats',
  validateQuery(rangeQuery),
  asyncHandler(async (req, res) => {
    const { range } = req.query as unknown as { range: 'week' | 'month' | 'quarter' };
    return ok(res, await getStats(range));
  }),
);

dashboardRouter.get(
  '/charts',
  validateQuery(rangeQuery),
  asyncHandler(async (req, res) => {
    const { range } = req.query as unknown as { range: 'week' | 'month' | 'quarter' };
    return ok(res, await getCharts(range));
  }),
);

dashboardRouter.get(
  '/recent-orders',
  asyncHandler(async (_req, res) => {
    const rows = await getRecentOrders(10);
    return ok(
      res,
      rows.map((o) => ({ ...o, subtotal: Number(o.subtotal), discount: Number(o.discount), total: Number(o.total) })),
    );
  }),
);

import { Router } from 'express';
import { asyncHandler, ok } from '../lib/http';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateQuery } from '../middlewares/validate';
import { listAuditQuery, type ListAuditQuery } from '../schemas';
import { listAudit } from '../services/audit.service';

export const auditRouter = Router();

auditRouter.use(authenticate, requireRole('admin'));

auditRouter.get(
  '/',
  validateQuery(listAuditQuery),
  asyncHandler(async (req, res) => {
    const result = await listAudit(req.query as unknown as ListAuditQuery);
    return res.json({
      data: result.rows,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
        actors: result.actors,
      },
    });
  }),
);

auditRouter.get(
  '/actors',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    });
    return ok(res, users);
  }),
);

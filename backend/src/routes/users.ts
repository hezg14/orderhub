import { Router } from 'express';
import { asyncHandler, ok } from '../lib/http';
import { hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { changeRoleSchema, inviteUserSchema } from '../schemas';
import { writeAuditStandalone } from '../services/audit.service';
import { AppError } from '../lib/errors';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        nameEn: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true, auditLogs: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return ok(res, users);
  }),
);

usersRouter.post(
  '/invite',
  requireRole('admin'),
  validateBody(inviteUserSchema),
  asyncHandler(async (req, res) => {
    const { email, name, role, password } = req.body as {
      email: string;
      name: string;
      role: 'admin' | 'staff';
      password: string;
    };

    const user = await prisma.user.create({
      data: { email, name, role, passwordHash: await hashPassword(password) },
      select: { id: true, name: true, nameEn: true, email: true, role: true, createdAt: true },
    });

    await writeAuditStandalone({
      userId: req.user!.id,
      action: 'create',
      entity: 'user',
      entityId: user.id,
      detail: { email: user.email, role: user.role },
      requestId: req.requestId,
    });

    return ok(res, user, 201);
  }),
);

/**
 * Promotes or demotes a member. Guarded against the two ways an admin could
 * lock the whole team out: changing their own role, and demoting the last
 * remaining admin.
 */
usersRouter.patch(
  '/:id/role',
  requireRole('admin'),
  validateBody(changeRoleSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: 'admin' | 'staff' };

    if (id === req.user!.id) {
      throw AppError.conflict('You cannot change your own role — ask another admin');
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw AppError.notFound('User');

    if (target.role !== role && target.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw AppError.conflict('The last admin cannot be demoted');
      }
    }

    if (target.role === role) {
      return ok(res, { id, role, unchanged: true });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, nameEn: true, email: true, role: true },
    });

    await writeAuditStandalone({
      userId: req.user!.id,
      action: 'update',
      entity: 'user',
      entityId: id,
      detail: { role: { from: target.role, to: role } },
      requestId: req.requestId,
    });

    return ok(res, user);
  }),
);

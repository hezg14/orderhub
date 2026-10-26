import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { ListAuditQuery } from '../schemas';

export interface AuditInput {
  userId: string;
  action: 'create' | 'update' | 'delete';
  entity: 'order' | 'customer' | 'product' | 'user';
  entityId: string;
  detail: Prisma.InputJsonValue;
  requestId?: string;
}

/**
 * Accepts a transaction client so the audit row commits with the business write.
 * If the order fails to save, the log must not claim it succeeded.
 */
export function writeAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      detail: input.detail,
      requestId: input.requestId ?? null,
    },
  });
}

/** Same thing outside a transaction (login, invite, read-only annotations). */
export function writeAuditStandalone(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      detail: input.detail,
      requestId: input.requestId ?? null,
    },
  });
}

export async function listAudit(q: ListAuditQuery) {
  const where: Prisma.AuditLogWhereInput = {};
  if (q.action) where.action = q.action;
  if (q.userId) where.userId = q.userId;
  if (q.entity) where.entity = q.entity;
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: new Date(`${q.from}T00:00:00.000Z`) } : {}),
      ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}),
    };
  }

  const [rows, total, actors] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, nameEn: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true, nameEn: true }, orderBy: { name: 'asc' } }),
  ]);

  return { rows, total, page: q.page, pageSize: q.pageSize, actors };
}

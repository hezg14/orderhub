import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler, ok, paged } from '../lib/http';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateBody, validateQuery } from '../middlewares/validate';
import {
  createProductSchema,
  listProductsQuery,
  updateProductSchema,
  type CreateProductInput,
} from '../schemas';
import { writeAuditStandalone } from '../services/audit.service';

export const productsRouter = Router();
productsRouter.use(authenticate);

/** PRD PRD-03: anything at or below this is "low stock" and turns red. */
export const LOW_STOCK_THRESHOLD = 5;

productsRouter.get(
  '/',
  validateQuery(listProductsQuery),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as {
      page: number;
      pageSize: number;
      q?: string;
      category?: string;
      lowStock: boolean;
    };

    const where: Prisma.ProductWhereInput = {};
    if (q.category) where.category = q.category;
    if (q.lowStock) where.stock = { lte: LOW_STOCK_THRESHOLD };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { nameEn: { contains: q.q, mode: 'insensitive' } },
        { sku: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: [{ stock: 'asc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return paged(
      res,
      rows.map((p) => ({ ...p, unitPrice: Number(p.unitPrice), lowStock: p.stock <= LOW_STOCK_THRESHOLD })),
      total,
      q.page,
      q.pageSize,
    );
  }),
);

productsRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.product.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
    return ok(res, rows.map((r) => ({ name: r.category, count: r._count._all })));
  }),
);

productsRouter.post(
  '/',
  // Price and stock are shared financial state — only admins maintain the
  // catalog; staff read it and place orders against it.
  requireRole('admin'),
  validateBody(createProductSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CreateProductInput;
    const product = await prisma.product.create({
      data: { ...input, unitPrice: new Prisma.Decimal(input.unitPrice) },
    });
    await writeAuditStandalone({
      userId: req.user!.id,
      action: 'create',
      entity: 'product',
      entityId: product.id,
      detail: { sku: product.sku, name: product.name, stock: product.stock },
      requestId: req.requestId,
    });
    return ok(res, { ...product, unitPrice: Number(product.unitPrice) }, 201);
  }),
);

productsRouter.patch(
  '/:id',
  requireRole('admin'),
  validateBody(updateProductSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Product');

    const body = req.body as Partial<CreateProductInput>;
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...body,
        ...(body.unitPrice !== undefined ? { unitPrice: new Prisma.Decimal(body.unitPrice) } : {}),
      },
    });

    const detail: Record<string, unknown> = {};
    if (body.stock !== undefined && body.stock !== before.stock) {
      detail.stock = { from: before.stock, to: body.stock };
    }
    if (body.unitPrice !== undefined && Number(before.unitPrice) !== body.unitPrice) {
      detail.unitPrice = { from: Number(before.unitPrice), to: body.unitPrice };
    }

    await writeAuditStandalone({
      userId: req.user!.id,
      action: 'update',
      entity: 'product',
      entityId: id,
      // Built from the JSON body, so runtime values are JSON-safe; the cast
      // bridges Prisma's InputJsonValue which TS cannot infer from unknown.
      detail: detail as unknown as Prisma.InputJsonValue,
      requestId: req.requestId,
    });

    return ok(res, { ...product, unitPrice: Number(product.unitPrice) });
  }),
);

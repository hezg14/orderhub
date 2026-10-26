import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError('NOT_FOUND', `No route matches ${req.method} ${req.path}`));
}

/**
 * Single place where an exception becomes an HTTP response.
 * The client only ever sees { error: { code, message, details, requestId } }.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, requestId }, err.message);
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        requestId,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields need attention',
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        requestId,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      return res.status(409).json({
        error: { code: 'CONFLICT', message: `That ${target} is already taken`, requestId },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'The record no longer exists', requestId },
      });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'This record is referenced by other records and cannot be changed',
          requestId,
        },
      });
    }
    if (err.code === 'P2023') {
      // A :id path param that is not a valid UUID hit a uuid column (e.g.
      // GET /api/orders/not-a-uuid). The client did nothing a server should
      // punish with a 500; from the API's point of view no such record exists.
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'The record does not exist', requestId },
      });
    }
  }

  // Unknown error: log the full stack, return nothing useful to the attacker.
  logger.error({ err, requestId, path: req.path }, 'unhandled error');

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Quote the request id if you contact support.',
      ...(env.isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
      requestId,
    },
  });
}

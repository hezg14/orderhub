import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../lib/errors';

function toAppError(err: ZodError): AppError {
  const details = err.issues.map((i) => ({
    field: i.path.join('.') || '(root)',
    message: i.message,
  }));
  return new AppError('VALIDATION_ERROR', 'Some fields need attention', details);
}

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(toAppError(result.error));
    req.body = result.data;
    next();
  };
}

/**
 * `req.query` is a getter in Express 4, so a plain assignment is silently
 * ignored. Redefine the property instead of mutating the object.
 */
export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(toAppError(result.error));
    Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
    next();
  };
}

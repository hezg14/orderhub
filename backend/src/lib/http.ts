import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ApiLocale } from './order-state';

/**
 * Express 4 does not catch rejected promises from async handlers: the request
 * hangs and the rejection becomes an unhandledRejection that can kill the
 * process. Wrapping is not optional.
 */
export const asyncHandler =
  <T extends RequestHandler>(fn: T): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Locale for server-generated wording (report columns, state-machine hints).
 * The frontend sends `Accept-Language: zh|en` on every call, mirroring the UI
 * locale; anything unparseable falls back to Chinese, the dataset's language.
 */
export function reqLocale(req: Request): ApiLocale {
  const header = String(req.headers['accept-language'] ?? '');
  return /(^|[,\s])zh\b/i.test(header) ? 'zh' : 'en';
}

/** Uniform success envelope: { data: ... }. Errors go through errorHandler. */
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

export function paged<T>(res: Response, rows: T[], total: number, page: number, pageSize: number) {
  return res.json({
    data: rows,
    meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

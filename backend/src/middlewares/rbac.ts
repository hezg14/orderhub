import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';
import type { Role } from '../lib/jwt';

/**
 * Route-level role gate. This is the security boundary — the frontend hiding a
 * menu item is a UX nicety, not access control.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('UNAUTHENTICATED', 'Please sign in to continue'));
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('Your role does not allow this action'));
    }
    next();
  };
}

import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';
import { COOKIE_NAME, verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

/**
 * Reads the JWT from the httpOnly cookie. A Bearer header is also accepted so
 * that Swagger / curl / integration tests do not need cookie plumbing.
 *
 * The token only proves *identity* (sign-in within the last 7 days). The role
 * is re-read from the database on every request, so a role change (or account
 * removal) takes effect on the very next request instead of after token
 * expiry. Cost: one indexed primary-key lookup per API call.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = bearer ?? (req.cookies?.[COOKIE_NAME] as string | undefined);

  if (!token) {
    return next(new AppError('UNAUTHENTICATED', 'Please sign in to continue'));
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, name: true },
    });
    // The signature is valid but the account no longer exists (e.g. removed
    // during testing) — treat it as signed out rather than a ghost session.
    if (!user) {
      return next(new AppError('UNAUTHENTICATED', 'Please sign in to continue'));
    }
    req.user = { id: payload.sub, role: user.role, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}

import { Router } from 'express';
import { env } from '../lib/env';
import { AppError } from '../lib/errors';
import { asyncHandler, ok } from '../lib/http';
import { COOKIE_NAME, signToken } from '../lib/jwt';
import { burnPasswordCheck, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { loginSchema, updateMeSchema } from '../schemas';

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.COOKIE_SECURE,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    // In-memory throttle: 10 attempts / 15 min per email.
    // A production deployment should move this to Redis so it survives restarts
    // and works across instances.
    const key = email;
    const now = Date.now();
    const bucket = attempts.get(key);
    if (bucket && bucket.resetAt > now && bucket.count >= 10) {
      throw new AppError('RATE_LIMITED', 'Too many attempts. Try again in a few minutes.');
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Same message and roughly the same latency whether the account exists or not.
    if (!user) {
      await burnPasswordCheck(password);
      throw new AppError('UNAUTHENTICATED', 'Email or password is incorrect');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const next = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + 15 * 60_000 };
      attempts.set(key, { count: next.count + 1, resetAt: next.resetAt });
      throw new AppError('UNAUTHENTICATED', 'Email or password is incorrect');
    }

    attempts.delete(key);

    const token = signToken({ sub: user.id, role: user.role, name: user.name });
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return ok(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    return ok(res, { ok: true });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, nameEn: true, role: true, createdAt: true },
    });
    if (!user) throw new AppError('UNAUTHENTICATED', 'Account no longer exists');
    return ok(res, user);
  }),
);

authRouter.patch(
  '/me',
  authenticate,
  validateBody(updateMeSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as { name: string };
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name },
      select: { id: true, email: true, name: true, nameEn: true, role: true },
    });
    // The name is embedded in the JWT; re-issue so the sidebar updates on reload.
    res.cookie(COOKIE_NAME, signToken({ sub: user.id, role: user.role, name: user.name }), cookieOptions);
    return ok(res, user);
  }),
);

const attempts = new Map<string, { count: number; resetAt: number }>();

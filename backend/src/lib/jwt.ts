import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from './env';
import { AppError } from './errors';

export type Role = 'admin' | 'staff';

export interface JwtPayload {
  sub: string;
  role: Role;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'orderhub',
    audience: 'orderhub-web',
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'orderhub',
      audience: 'orderhub-web',
    });
    if (typeof decoded === 'string') throw new Error('unexpected payload');

    const { sub, role, name } = decoded as jwt.JwtPayload & Partial<JwtPayload>;
    if (!sub || !role || !name) throw new Error('incomplete payload');

    return { sub, role, name };
  } catch (err) {
    // Never distinguish "expired" from "bad signature" to the client.
    throw new AppError('UNAUTHENTICATED', 'Your session has expired, please sign in again');
  }
}

export const COOKIE_NAME = 'oh_token';

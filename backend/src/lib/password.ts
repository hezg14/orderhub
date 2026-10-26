import bcrypt from 'bcryptjs';

/**
 * bcryptjs (pure JS) instead of bcrypt (native):
 * - no node-gyp / build-essential in the Alpine image
 * - ~15% slower at the same cost, irrelevant at login volume
 * cost 10 ≈ 60-90ms on a modern CPU, which is the intended defence against
 * offline cracking without making login feel slow.
 */
const COST = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * Constant-time-ish dummy compare. Call this when the email does not exist so
 * that response time does not reveal whether an account is registered.
 */
// Generated at boot so the salt version is guaranteed valid; a hand-written
// constant makes bcrypt.compare throw and turns a 401 into a 500.
const DUMMY_HASH = bcrypt.hashSync('orderhub-dummy-password', COST);
export const burnPasswordCheck = (plain: string) => bcrypt.compare(plain, DUMMY_HASH);

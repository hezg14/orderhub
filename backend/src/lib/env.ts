// Must run before anything reads process.env. Importing it here (rather than in
// server.ts) means the seed script and the tests get the same behaviour.
import 'dotenv/config';
import { z } from 'zod';

/**
 * Fail fast on boot instead of throwing a confusing error on the first request.
 * A missing JWT_SECRET in production is a critical misconfiguration, not a warning.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('info'),
  /**
   * Directory holding the built SPA. Defaults to `<dist>/../public`, which is
   * what the single-container image produces. Local development leaves it
   * absent (the SPA is served by Vite), so static hosting stays off.
   */
  PUBLIC_DIR: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export type Env = typeof env;

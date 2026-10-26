import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/**
 * Single Prisma instance per process. In dev, tsx watch re-imports modules on
 * every save; without the global cache each reload opens a new pool and you hit
 * "too many clients already" after ~10 saves.
 *
 * The client is built inside a factory so the global cache and the freshly
 * constructed instance share the *same* type (PrismaClient with the event log
 * config). Writing it as `globalForPrisma.prisma ?? new PrismaClient({log})`
 * widens the union and collapses `$on`'s event parameter to `never`, which
 * silently breaks slow-query logging at compile time.
 */
function createPrismaClient() {
  return new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Slow-query log: anything over 200ms is a smell worth seeing in dev.
prisma.$on('query', (e) => {
  if (e.duration >= 200) {
    logger.warn({ durationMs: e.duration, query: e.query }, 'slow query');
  }
});

prisma.$on('warn', (e) => logger.warn({ prisma: e.message }, 'prisma warning'));
prisma.$on('error', (e) => logger.error({ prisma: e.message }, 'prisma error'));

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

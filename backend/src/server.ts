import { createApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, cors: env.corsOrigins },
    `OrderHub API listening on http://localhost:${env.PORT}`,
  );
});

/**
 * Render sends SIGTERM before killing the container. Without draining we cut
 * in-flight requests and can leave a half-committed transaction.
 */
async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'error while closing server');
      process.exit(1);
    }
    await prisma.$disconnect();
    logger.info('closed cleanly');
    process.exit(0);
  });

  // Give in-flight requests 10s, then die anyway.
  setTimeout(() => {
    logger.error('forced shutdown after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection — this is a bug');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception, exiting');
  process.exit(1);
});

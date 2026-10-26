import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'orderhub-api', env: env.NODE_ENV },
  // Never log credentials, cookies or tokens, even by accident.
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'token',
      '*.token',
    ],
    censor: '[redacted]',
  },
  transport: env.isProd
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 },
      },
});

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middlewares/error';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  // Behind Render/nginx; needed for req.ip and secure cookies to be accurate.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));

  // CORS with a per-request decision rather than a static allowlist: the
  // single-image deploy serves the SPA from this same host, and browsers do send
  // an Origin header on same-origin POST/PATCH. A fixed allowlist would reject
  // the app's own login request the moment the hostname differs from the one
  // baked into the config (Render's generated *.onrender.com name, a custom
  // domain, a preview URL). Same-host is therefore always trusted.
  const corsOptions: cors.CorsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Rows'],
    maxAge: 86_400,
  };

  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;

      let sameHost = false;
      if (origin) {
        try {
          sameHost = new URL(origin).host === req.headers.host;
        } catch {
          sameHost = false; // `Origin: null` from a sandboxed iframe or file://
        }
      }

      // No Origin at all (curl, server-to-server, same-origin GET) is allowed.
      if (!origin || sameHost || env.corsOrigins.includes(origin)) {
        return callback(null, { ...corsOptions, origin: true });
      }

      // Unknown origin: emit no CORS headers at all, so the browser refuses to
      // hand the response to the calling page. Do NOT reject the request here —
      // CORS is a browser policy, not an authentication mechanism; turning it
      // into a 500 would only add noise to the logs and leak nothing extra.
      return callback(null, { ...corsOptions, origin: false });
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.use((req, _res, next) => {
    req.requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
    next();
  });

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: {
        ignore: (req) => req.url === '/healthz',
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.get('/healthz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.json({ status: 'ok', db: 'ok', uptime: Math.round(process.uptime()) });
    } catch {
      return res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use('/api', apiRouter);

  // ---------- built SPA, served from the API's own origin ----------
  // The session cookie is httpOnly + SameSite=Lax. A cross-site XHR would never
  // carry it, so "frontend on one domain, API on another" silently breaks login
  // (works in curl, fails in the browser). Serving both from one host keeps the
  // cookie first-party and removes CORS from the deployment surface entirely.
  // During local development this directory does not exist — Vite owns the
  // frontend — so the block below is inert there.
  const publicDir = env.PUBLIC_DIR
    ? path.resolve(env.PUBLIC_DIR)
    : path.resolve(__dirname, '../public');
  const indexHtml = path.join(publicDir, 'index.html');

  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(publicDir, {
        index: false,
        setHeaders(res, filePath) {
          // Vite fingerprints every file under /assets, so those can be cached
          // forever. Everything else (favicon, robots.txt) revalidates.
          const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
          res.setHeader(
            'Cache-Control',
            immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
          );
        },
      }),
    );

    // History-mode routing: unknown non-API paths get the shell and the Vue
    // router renders its own 404. /api and /healthz fall through to the JSON
    // handlers above so a mistyped endpoint still returns a 404 payload.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/healthz') return next();
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexHtml);
    });

    logger.info({ publicDir }, 'serving built SPA from the API origin');
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

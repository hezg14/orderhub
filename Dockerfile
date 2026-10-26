# Single-image OrderHub: the Express API also serves the built SPA.
#
# Why one image instead of "static hosting + API host"? The session cookie is
# httpOnly + SameSite=Lax, so a browser will not attach it to a cross-site XHR.
# Two different hostnames (*.vercel.app + *.onrender.com) are cross-site, so
# login appears to work and every request afterwards returns 401. One origin
# removes CORS, cookie flags and proxy rewrites from the deployment entirely.
#
# Build:  docker build -t orderhub .
# Run:    docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_SECRET=... orderhub

# ---------- stage 1: frontend ----------
FROM node:20-alpine AS web
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# Dependencies first: this layer only rebuilds when the lockfile changes.
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
# build:only skips vue-tsc — types are a CI gate, not an image-build cost.
RUN pnpm run build:only

# ---------- stage 2: backend ----------
FROM node:20-alpine AS api
WORKDIR /app

# openssl is required by the Prisma query engine on Alpine.
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY backend/prisma ./prisma
RUN pnpm exec prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN pnpm run build

# The seed script lives outside src/ so the app build ignores it. Compile it on
# its own to plain JS: the runtime image has no tsx, and pulling a TS runner
# into production just to seed a demo is a bad trade.
RUN pnpm exec tsc prisma/seed.ts \
      --outDir prisma-dist \
      --module commonjs \
      --moduleResolution node \
      --target ES2022 \
      --esModuleInterop \
      --skipLibCheck

# Drop dev dependencies (tsx, vitest, @types/*). `prisma` stays a runtime
# dependency on purpose: the entrypoint runs `prisma migrate deploy`.
RUN pnpm prune --prod

# ---------- stage 3: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl curl \
 && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=api /app/node_modules ./node_modules
COPY --from=api /app/dist ./dist
COPY --from=api /app/prisma-dist ./prisma-dist
COPY --from=api /app/prisma ./prisma
COPY --from=api /app/package.json ./package.json
COPY --from=web /app/dist ./public
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=25s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]

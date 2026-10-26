# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

# openssl is required by the Prisma engine on Alpine
RUN apk add --no-cache openssl

# `prisma` is a runtime dependency (not dev) because the CMD below runs
# `prisma migrate deploy`; `npm prune --omit=dev` would otherwise delete the CLI
# and make npx download it from the network on every container start.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Strip dev dependencies from the tree we are about to copy forward.
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl curl && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

# migrate deploy is idempotent; it is safe on every boot and avoids a
# separate release step on hosts that only run a start command.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

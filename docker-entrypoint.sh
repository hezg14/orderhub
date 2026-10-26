#!/bin/sh
# Container entrypoint: migrate, optionally reset demo data, then hand PID 1 to
# node so Docker's SIGTERM reaches the graceful-shutdown handler in server.ts.
set -e

echo "→ prisma migrate deploy"
npx prisma migrate deploy

# Demo environments want deterministic numbers every time a reviewer opens the
# link. Off by default: on a real deployment this would wipe live data on every
# restart.
if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "→ SEED_ON_BOOT=true — resetting demo data to the seed snapshot"
  node prisma-dist/seed.js
fi

exec node dist/server.js

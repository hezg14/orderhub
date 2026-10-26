# Deployment Guide

Production deployment for OrderHub: **Neon Postgres + Render (single Docker container)**.

- Live URL: `https://orderhub-iczq.onrender.com`
- Deploy method: Render Blueprint (`render.yaml` in repo root)
- Database: Neon free project (region: Singapore, same as the Render service)

## Architecture

```
Browser ──HTTPS──> Render Web Service (Docker, free plan)
                     │  ./Dockerfile — builds SPA + API into one image
                     │  env: DATABASE_URL, JWT_SECRET, SEED_ON_BOOT
                     ▼
                   Neon Postgres (pooled endpoint, sslmode=require)
```

One container serves both the SPA (static assets) and the API. The database
is intentionally NOT hosted on Render — Render's free Postgres expires after
30 days, while Neon's free tier is permanent (autosuspends when idle, resumes
in under a second).

## Step 1 — Neon database

1. Sign up at [neon.tech](https://neon.tech) and create a project
   (region: `AWS Asia Pacific 1 (Singapore)` to match the Render service).
2. Open the project → **Dashboard** → **Connect** (top-right) → copy the
   **Pooled connection** string (hostname contains `-pooler`, ends with
   `?sslmode=require`).
3. Run migrations + seed against it once from a machine that can reach Neon:

   ```bash
   DATABASE_URL="<pooled connection string>" npx prisma migrate deploy
   DATABASE_URL="<pooled connection string>" npx prisma db seed
   ```

> On the local dev machine a proxy with fake-ip DNS may block the `-pooler`
> host; use the **unpooled** (direct) string for local runs — Render's cloud
> network has no such problem.

## Step 2 — Render Blueprint

1. Sign up at [render.com](https://render.com) (free workspace is enough).
2. **New + → Blueprint** → authorize GitHub (**Only select repositories** →
   `hezg14/orderhub`) → pick the repo, branch `main`.
3. Render reads `render.yaml` and creates one web service `orderhub`
   (Docker / Free / Singapore / health check `/healthz`).
4. Fill the only required secret: **`DATABASE_URL`** = the Neon pooled
   string from Step 1. `JWT_SECRET` is auto-generated.
5. **Apply Resources** → first Docker build takes ~2 minutes.

`render.yaml` presets:

| Key | Value | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | *(sync: false)* | Neon pooled connection string |
| `JWT_SECRET` | generated | 32+ chars, required to boot |
| `COOKIE_SECURE` | `true` | Session cookie over HTTPS only |
| `SEED_ON_BOOT` | `true` | Re-seeds demo data on every restart |
| `CORS_ORIGIN` | `https://orderhub-iczq.onrender.com` | Only needed if SPA/API ever split hosts |

## Step 3 — Verify

```bash
curl https://orderhub-iczq.onrender.com/healthz
# {"status":"ok","db":"ok",...}
```

Then open the site and log in with a demo account (see
`frontend/src/config/demoAccounts.ts`). Checked 2026-10-26: healthz 200,
login 200, order list returns seeded data, receivables report 200.

## Day-to-day operations

- **Auto deploy**: every push to `main` triggers a rebuild (Blueprint-managed).
- **Manual deploy**: service page → **Manual Deploy → Deploy latest commit**.
- **Cold starts**: the free plan spins down after ~15 min idle; the first
  request afterwards takes up to ~50 s. Combined with `SEED_ON_BOOT=true`,
  every cold start also restores a clean demo dataset — good for a portfolio
  link, turn it OFF before loading real data.
- **Rotate DB credentials**: Neon → project → role menu → Reset password,
  then update `DATABASE_URL` in Render → Environment and redeploy.
- **Next product**: reuse the same Render workspace and Neon account — just
  add a `render.yaml` to the new repo and create another Blueprint; each
  product gets its own Neon project and Render service.

/**
 * OrderHub keep-alive — Cloudflare Worker (free plan).
 *
 * Problem: Render's free instance spins down after ~15 min without inbound
 * traffic and takes ~50 s to wake on the next request. A portfolio link
 * cannot afford a 50-second first impression.
 *
 * The math that makes this free: Render grants 750 instance-hours/month and
 * a month is ~730 hours, so a single service can stay warm 24/7 inside the
 * free allowance. Pinging /healthz every 12 minutes keeps the 15-minute
 * idle timer from ever expiring.
 *
 * Deploy (one-time):
 *   1. npm i -g wrangler && wrangler login
 *   2. cd deploy/keepalive && npx wrangler deploy
 *   3. In the Cloudflare dashboard, confirm the Cron Trigger is enabled.
 *
 * Deploy via GitHub instead of the CLI: repo root on Cloudflare → Workers →
 * connect this folder, set the cron in the dashboard.
 */

const TARGET = "https://orderhub-iczq.onrender.com/healthz";

export default {
  async scheduled(controller, env, ctx) {
    const res = await fetch(TARGET, { cf: { cacheTtl: 0 } });
    if (!res.ok) {
      console.error(`keepalive: healthz returned ${res.status}`);
    }
  },
};

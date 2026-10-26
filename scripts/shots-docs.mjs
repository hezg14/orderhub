/**
 * Portfolio screenshots: 1600x1000 PNGs of every page, captured from a running
 * instance. Used by README + the portfolio entry, so they must match the
 * real product — no mockups.
 *
 *   BASE_URL=http://localhost:3000 node scripts/shots-docs.mjs [outDir]
 *
 * Requires puppeteer-core and a local Chrome. Set PUPPETEER_MODULE to the
 * directory that can resolve it when it is not in this project's node_modules.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(process.env.PUPPETEER_MODULE ?? import.meta.url);
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.resolve(process.argv[2] ?? 'docs/screenshots');
const EMAIL = process.env.DEMO_EMAIL ?? 'admin@orderhub.demo';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234';

const PAGES = [
  ['dashboard', '/'],
  ['orders', '/orders'],
  ['order-detail', '/orders/{orderId}'],
  ['order-new', '/orders/new'],
  ['customers', '/customers'],
  ['customer-detail', '/customers/{customerId}'],
  ['products', '/products'],
  ['reports', '/reports'],
  ['audit', '/audit'],
  ['settings', '/settings'],
];

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });

const problems = [];
// Track HTTP failures, not console noise: the login page legitimately probes
// /api/auth/me and gets a 401 before anyone has signed in.
page.on('response', (res) => {
  if (res.status() >= 500) problems.push(`${res.status()} ${res.request().method()} ${res.url()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 160)}`));

// --- log in (the form is prefilled; the demo-account buttons only rewrite it)
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
const inputs = await page.$$('input');
if (inputs.length < 2) throw new Error('login form not found — is the SPA served?');
for (const [el, value] of [
  [inputs[0], EMAIL],
  [inputs[1], PASSWORD],
]) {
  // select() then Backspace, rather than click({ clickCount: 3 }): the latter
  // does not reliably select inside an Element Plus input, and the typed text
  // gets appended to the prefilled demo value.
  await el.click();
  await el.evaluate((node) => node.select());
  await page.keyboard.press('Backspace');
  await el.type(value, { delay: 12 });
}
await Promise.all([
  page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 }),
  page.click('button[type=submit]'),
]);

// --- resolve real detail-page ids so the deep links are not placeholders
async function firstId(pathname) {
  const res = await page.evaluate(async (p) => {
    const r = await fetch(`/api${p}?pageSize=1`, { credentials: 'include' });
    if (!r.ok) return null;
    const body = await r.json();
    return body.data?.[0]?.id ?? null;
  }, pathname);
  return res;
}
const orderId = await firstId('/orders');
const customerId = await firstId('/customers');
console.log('ids', { orderId, customerId });

for (const [name, route] of PAGES) {
  const url = route
    .replace('{orderId}', orderId ?? '')
    .replace('{customerId}', customerId ?? '');
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2' });
  // Charts and count-up animations settle around 700 ms.
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name, url);
}

await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} console problem(s):`);
  for (const p of problems.slice(0, 10)) console.log(' -', p);
  process.exitCode = 1;
} else {
  console.log('\nno console errors');
}

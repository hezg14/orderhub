import { createRequire } from 'node:module';

// Resolve puppeteer-core from this project, or from PUPPETEER_MODULE when
// the browser tooling lives outside the repo (CI, sandboxes).
const require = createRequire(process.env.PUPPETEER_MODULE ?? import.meta.url);
const puppeteer = require('puppeteer-core');

const OUT = process.argv[2] || process.env.SHOT_DIR || '.shots';
const WIDE = process.argv.includes('--desktop');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const PREFIX = WIDE ? 'd' : 'm';

const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
});
const p = await b.newPage();
await p.setViewport(
  WIDE
    ? { width: 1440, height: 900, deviceScaleFactor: 1 }
    : { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
);
await p.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });

const ins = await p.$$('input');
for (const [el, v] of [
  [ins[0], 'admin@orderhub.demo'],
  [ins[1], 'Demo1234'],
]) {
  await el.focus();
  await el.evaluate((n) => n.setSelectionRange(0, n.value.length));
  await el.type(v, { delay: 15 });
}
await p.click('button[type=submit]');
await p.waitForFunction(() => location.pathname !== '/login', { timeout: 15000 });

for (const [name, url] of [
  ['orders', '/orders'],
  ['cust', '/customers'],
  ['prod', '/products'],
  ['audit', '/audit'],
  ['dash', '/'],
  ['reports', '/reports'],
  ['settings', '/settings'],
  ['new', '/orders/new'],
  ['order-detail', '/orders/2943a96d-94c0-4b94-9358-8bc78ef701fb'],
  ['cust-detail', '/customers/4197b264-4d1c-484d-bc6e-0be9b0b8ae25'],
]) {
  await p.goto(BASE + url, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));
  await p.screenshot({ path: `${OUT}/${PREFIX}-${name}.png`, fullPage: false });
  const sc = await p.evaluate(() =>
    [...document.querySelectorAll('.el-table__body-wrapper, .el-scrollbar__wrap')].map((e) => ({
      cls: e.className.split(' ')[0],
      sw: e.scrollWidth,
      cw: e.clientWidth,
    })),
  );
  console.log(name, JSON.stringify(sc));
}
await b.close();

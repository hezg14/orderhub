import { createRequire } from 'node:module';

// Resolve puppeteer-core from this project, or from PUPPETEER_MODULE when
// the browser tooling lives outside the repo (CI, sandboxes).
const require = createRequire(process.env.PUPPETEER_MODULE ?? import.meta.url);
const puppeteer = require('puppeteer-core');

const OUT = process.env.SHOT_DIR || '.shots';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
});

async function run(locale) {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  // Every run starts signed out: a surviving session cookie would skip /login.
  const cdp = await p.createCDPSession();
  await cdp.send('Network.clearBrowserCookies');
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await p.evaluate((l) => localStorage.setItem('orderhub.locale', l), locale);
  await p.reload({ waitUntil: 'networkidle2' });
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
    ['audit', '/audit'],
    ['cust', '/customers'],
  ]) {
    await p.goto(BASE + url, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1100));
    await p.screenshot({ path: `${OUT}/${locale}-${name}.png` });
  }

  // Filters are collapsed on phones — open them first, then the customer select.
  await p.goto(`${BASE}/orders`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));
  await p.click('.filter-toggle');
  await new Promise((r) => setTimeout(r, 400));
  const selects = await p.$$('.filter-rest .el-select');
  if (selects[1]) {
    await selects[1].click();
    await new Promise((r) => setTimeout(r, 500));
    await p.screenshot({ path: `${OUT}/${locale}-filter-open.png` });
    const opts = await p.$$eval('.el-select-dropdown__item', (els) => els.map((e) => e.textContent.trim()));
    console.log(locale, 'customer options:', opts.slice(0, 4).join(' | '));
  }
  await p.close();
}

await run('zh');
await run('en');
await b.close();

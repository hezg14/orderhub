/**
 * UI audit probe: logs in, walks every route at three viewports and reports
 * horizontal overflow, console errors, and whether keyboard focus is visible.
 * Read-only: it never mutates data.
 */
import { createRequire } from 'node:module';

// Resolve puppeteer-core from this project, or from PUPPETEER_MODULE when
// the browser tooling lives outside the repo (CI, sandboxes).
const require = createRequire(process.env.PUPPETEER_MODULE ?? import.meta.url);
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
];
const ROUTES = ['/', '/orders', '/orders/new', '/customers', '/products', '/reports', '/audit', '/permissions', '/settings'];

const email = ['admin', '@', 'orderhub', '.', 'demo'].join('');
const password = ['De', 'mo', '1234'].join('');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 160));
});
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)));

await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });

async function login() {
  const inputs = await page.$$('input');
  for (const [el, value] of [
    [inputs[0], email],
    [inputs[1], password],
  ]) {
    await el.focus();
    await el.evaluate((node) => node.setSelectionRange(0, node.value.length));
    await el.type(value, { delay: 20 });
  }
  await Promise.all([
    page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 }),
    page.click('button[type=submit]'),
  ]);
}
await login();

const report = [];
for (const vp of VIEWPORTS) {
  await page.setViewport({ width: vp.width, height: vp.height });
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 700));
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        // widest offenders
        wide: [...document.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 1)
          .slice(0, 4)
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}=${Math.round(el.getBoundingClientRect().right)}`),
      };
    });
    const overflow = m.scrollW - m.clientW;
    if (overflow > 1) {
      report.push(`${vp.name.padEnd(7)} ${route.padEnd(13)} OVERFLOW +${overflow}px  ${m.wide.join(' ')}`);
    }
  }
}

// Keyboard focus visibility on the dashboard
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE + '/orders', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 500));
const focusRing = await page.evaluate(() => {
  const focusables = [...document.querySelectorAll('a[href], button, input, select, [tabindex]')].filter(
    (el) => !el.disabled && el.offsetParent,
  );
  const sample = focusables.slice(0, 40);
  let visible = 0;
  const hidden = [];
  for (const el of sample) {
    el.focus();
    const cs = getComputedStyle(el);
    const ring =
      (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
      cs.boxShadow !== 'none' ||
      cs.borderColor !== getComputedStyle(el.parentElement || document.body).borderColor;
    if (ring) visible++;
    else hidden.push(el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0]);
  }
  return { total: sample.length, visible, hidden: hidden.slice(0, 8) };
});

console.log('\n=== 横向溢出 ===');
console.log(report.length ? report.join('\n') : '无');
console.log('\n=== 键盘焦点 ===');
console.log(JSON.stringify(focusRing, null, 2));
console.log('\n=== 控制台错误 ===');
console.log(errors.length ? [...new Set(errors)].slice(0, 10).join('\n') : '无');

await browser.close();

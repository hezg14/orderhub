import { createRequire } from 'node:module';

// Resolve puppeteer-core from this project, or from PUPPETEER_MODULE when
// the browser tooling lives outside the repo (CI, sandboxes).
const require = createRequire(process.env.PUPPETEER_MODULE ?? import.meta.url);
const puppeteer = require('puppeteer-core');

const url = process.argv[2];
const out = process.argv[3];

const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
});
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
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
await p.goto('http://localhost:5173' + url, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise((r) => setTimeout(r, 600));
await p.screenshot({ path: out });
await b.close();

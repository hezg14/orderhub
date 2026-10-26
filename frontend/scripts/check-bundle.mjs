#!/usr/bin/env node
/**
 * Bundle budget check.
 *
 * A performance budget that is not enforced in CI is a wish. This script fails
 * the build when the gzipped output exceeds the numbers below, so a careless
 * import (the full ECharts build, a 60 KB date library) is caught in the PR
 * rather than by a Lighthouse score two weeks later.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = new URL('../dist/assets/', import.meta.url).pathname;

/** Total JS budget, gzipped.
 *
 * Actual composition of the current build (~497 KB):
 *   echarts        ~175 KB  — lazy chunk, only Dashboard/Reports fetch it
 *   element-plus   ~127 KB  — on-demand, 11 pages of tables/forms/pickers
 *   vendor         ~58 KB   — vue/router/pinia/axios/dayjs
 *   routes + misc  ~137 KB
 * The gate exists to catch careless regressions (full ECharts barrel, a stray
 * moment.js), not to pretend a data-dense admin fits in 320 KB.
 *
 * 500 → 520 KB: every list view gained a phone record layout (#mobile slot in
 * DataTable) so a 390px screen shows amount and status without a sideways
 * scroll. That is ~3 KB of real markup per page, not a regression — but it did
 * use up the last of the old headroom, so the ceiling moves with it.
 */
const TOTAL_JS_BUDGET = 520 * 1024;
/** Any single chunk over this is a red flag and gets named. */
const CHUNK_WARN = 180 * 1024;

let files;
try {
  files = readdirSync(DIST).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`No build found at ${DIST}. Run "npm run build" first.`);
  process.exit(1);
}

let totalRaw = 0;
let totalGzip = 0;
const rows = [];

for (const file of files) {
  const path = join(DIST, file);
  const raw = statSync(path).size;
  const gzip = gzipSync(readFileSync(path), { level: 9 }).length;
  totalRaw += raw;
  totalGzip += gzip;
  rows.push({ file, raw, gzip });
}

rows.sort((a, b) => b.gzip - a.gzip);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

console.log('\nBundle report (gzip)');
console.log('─'.repeat(58));
for (const r of rows) {
  const flag = r.gzip > CHUNK_WARN ? '  ← over chunk budget' : '';
  console.log(`  ${r.file.padEnd(34)} ${kb(r.gzip).padStart(10)}${flag}`);
}
console.log('─'.repeat(58));
console.log(`  ${'total'.padEnd(34)} ${kb(totalGzip).padStart(10)}  (raw ${kb(totalRaw)})`);
console.log(`  ${'budget'.padEnd(34)} ${kb(TOTAL_JS_BUDGET).padStart(10)}`);

const overChunk = rows.filter((r) => r.gzip > CHUNK_WARN);
if (overChunk.length) {
  console.warn(`\n⚠  ${overChunk.length} chunk(s) exceed ${kb(CHUNK_WARN)}: ${overChunk.map((r) => r.file).join(', ')}`);
}

if (totalGzip > TOTAL_JS_BUDGET) {
  console.error(`\n✗ Over budget by ${kb(totalGzip - TOTAL_JS_BUDGET)}.`);
  process.exit(1);
}

console.log('\n✓ Within budget.\n');

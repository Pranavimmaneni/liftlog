/**
 * NFR-PERF-3 budget check (run after `npm run build`): the JavaScript the first page load needs
 * (entry script + modulepreloads in dist/index.html) must be under 250 KB gzipped, and the library
 * data, pose data, charts and QR decoder must stay out of it (lazy-loaded).
 *
 *   npx tsx scripts/check-budget.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 250;
const LAZY = [/^exercises-/, /^poses-/, /zxing|barcode|qr-polyfill/i, /^Chart-/];
const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="\/([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+)"/g),
].map((m) => m[1]!);
const initial = [...new Set(refs)];
let total = 0;
const rows: string[] = [];
for (const f of initial) {
  const gz = gzipSync(readFileSync(join(dist, f))).length;
  total += gz;
  rows.push(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${f}`);
}
const leaked = initial.filter((f) => LAZY.some((re) => re.test(f.split('/').pop()!)));
const lazyFiles = readdirSync(join(dist, 'assets')).filter((f) => LAZY.some((re) => re.test(f)));

console.log('Initial JS (gzip):');
console.log(rows.join('\n'));
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  total (budget ${BUDGET_KB} KB)`);
console.log(`Lazy chunks present: ${lazyFiles.join(', ') || 'none'}`);
if (leaked.length) {
  console.error(`FAIL: lazy data loaded up front: ${leaked.join(', ')}`);
  process.exit(1);
}
if (total > BUDGET_KB * 1024) {
  console.error(`FAIL: initial JS ${(total / 1024).toFixed(1)} KB > ${BUDGET_KB} KB`);
  process.exit(1);
}
console.log('OK');

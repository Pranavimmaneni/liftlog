/**
 * Local Lighthouse run (mobile) against `npm run preview` on :4173, using Playwright's Chromium on a
 * debugging port (chrome-launcher can't spawn Chrome in some Windows sandboxes). CI uses
 * .github/workflows/lighthouse.yml with @lhci/cli instead.
 *
 *   npx tsx scripts/lighthouse-local.ts [/route …]
 */
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';

const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/install'];
const base = process.env.LH_BASE ?? 'http://localhost:4173';
const port = 9333;
const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
let failed = false;
for (const route of routes) {
  const result = await lighthouse(`${base}${route}`, {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });
  const cats = result!.lhr.categories;
  const scores = Object.values(cats).map((c) => `${c.id}=${Math.round((c.score ?? 0) * 100)}`);
  console.log(`${route} → ${result!.lhr.finalDisplayedUrl}  ${scores.join(' ')}`);
  if (process.env.LH_DETAIL) {
    const a = result!.lhr.audits;
    for (const id of [
      'first-contentful-paint',
      'largest-contentful-paint',
      'total-blocking-time',
      'speed-index',
      'cumulative-layout-shift',
      'interactive',
    ])
      console.log(`  ${id}: ${a[id]?.displayValue} (${a[id]?.score})`);
    for (const id of [
      'render-blocking-resources',
      'unused-javascript',
      'uses-text-compression',
      'bootup-time',
      'mainthread-work-breakdown',
    ])
      if (a[id] && (a[id]!.score ?? 1) < 1)
        console.log(`  ${id}: ${a[id]!.displayValue ?? ''} ${a[id]!.score}`);
  }
  if (process.env.LH_LCP) {
    const el = result!.lhr.audits['largest-contentful-paint-element'];
    console.log(JSON.stringify(el?.details, null, 1).slice(0, 1500));
  }
  if (Object.values(cats).some((c) => (c.score ?? 0) < 0.9)) failed = true;
}
await browser.close();
if (failed) {
  console.error('A category scored below 90.');
  process.exit(1);
}

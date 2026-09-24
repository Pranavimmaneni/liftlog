/**
 * Screenshots routes at the mockup size (390×844, 2×) in Paper and Iron for side-by-side
 * comparison with design/screens/{light,dark}/*.png.
 *
 *   npx tsx scripts/shoot.ts <outDir> <name>=<route> [<name>=<route> …]
 *
 * Needs `npm run preview` (port 4173). An optional `setup` route (e.g. /dev/fixture?auto=1) is
 * visited first when SHOOT_SETUP is set, so screens have data.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir = 'docs/reports/screens', ...pairs] = process.argv.slice(2);
const base = process.env.SHOOT_BASE ?? 'http://localhost:4173';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const theme of ['paper', 'iron'] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: theme === 'iron' ? 'dark' : 'light',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  if (process.env.SHOOT_SETUP) {
    await page.goto(base + process.env.SHOOT_SETUP);
    await page.waitForSelector('[data-fixture-done]', { timeout: 30_000 });
  }
  for (const pair of pairs) {
    // name=/route or name=/route|css-selector-to-click-after-load
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    const [route, click] = pair.slice(eq + 1).split('|');
    await page.goto(base + route);
    await page.waitForLoadState('networkidle');
    if (click) {
      await page.locator(click).first().click();
      await page.waitForLoadState('networkidle');
    }
    await page.waitForTimeout(400);
    const file = join(outDir, `${name}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: process.env.SHOOT_FULL === '1' });
    console.log(file);
  }
  await ctx.close();
}
await browser.close();

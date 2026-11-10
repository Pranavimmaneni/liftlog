/**
 * Screenshots routes at the mockup size (390×844, 2×) in Paper and Iron for side-by-side
 * comparison with design/screens/{light,dark}/*.png.
 *
 *   npx tsx scripts/shoot.ts <outDir> <name>=<route> [<name>=<route> …]
 *
 * Needs `npm run preview` (port 4173). An optional `setup` route (e.g. /dev/fixture?auto=1) is
 * visited first when SHOOT_SETUP is set, so screens have data.
 *
 * SHOOT_LOOK=sun shoots the Rising Sun look (FR-DSN-1) for comparison with
 * docs/new-design-handoff/png. SHOOT_SCALE=1 gives 1× images. SHOOT_SHEET=<columns> also writes one
 * contact sheet per theme (sheet-<theme>.jpg), which is quicker to review than single files.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [outDir = 'docs/reports/screens', ...pairs] = process.argv.slice(2);
const base = process.env.SHOOT_BASE ?? 'http://localhost:4173';
const look = process.env.SHOOT_LOOK === 'sun' ? 'sun' : 'classic';
const scale = Number(process.env.SHOOT_SCALE ?? 2);
const columns = Number(process.env.SHOOT_SHEET ?? 0);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const theme of ['paper', 'iron'] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: scale,
    colorScheme: theme === 'iron' ? 'dark' : 'light',
    isMobile: true,
    hasTouch: true,
  });
  // The look's pre-paint mirror (public/theme-boot.js); Dexie has no saved look in a fresh context.
  await ctx.addInitScript((l) => localStorage.setItem('ll-design', l), look);
  const page = await ctx.newPage();
  if (process.env.SHOOT_SETUP) {
    await page.goto(base + process.env.SHOOT_SETUP);
    await page.waitForSelector('[data-fixture-done]', { timeout: 30_000 });
  }
  const files: string[] = [];
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
    files.push(file);
    console.log(file);
  }
  if (columns > 0 && files.length) {
    const w = 390 * scale;
    const h = 844 * scale;
    const rows = Math.ceil(files.length / columns);
    const sheet = join(outDir, `sheet-${theme}.jpg`);
    await sharp({
      create: { width: columns * w, height: rows * h, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .composite(
        await Promise.all(
          files.map(async (f, i) => ({
            input: await sharp(f).resize(w, h, { fit: 'cover', position: 'top' }).toBuffer(),
            left: (i % columns) * w,
            top: Math.floor(i / columns) * h,
          })),
        ),
      )
      .jpeg({ quality: 82 })
      .toFile(sheet);
    console.log(sheet);
  }
  await ctx.close();
}
await browser.close();

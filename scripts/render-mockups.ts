/**
 * Renders the 1.2 mockups in design/screens-v2/<dir>/ to 2× PNGs in Paper and Iron:
 *   npx tsx scripts/render-mockups.ts food [F01]
 * Output: design/screens-v2/<dir>/png/{light,dark}/<name>.png. Dev only (loads Google Fonts like the
 * original mockups do).
 */
import { readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const dir = process.argv[2] ?? 'food';
const only = process.argv[3];
const root = resolve('design/screens-v2', dir);
const files = readdirSync(root).filter((f) => /^[A-Z]\d+.*\.html$/.test(f) && (!only || f.startsWith(only)));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [theme, out] of [
  ['paper', 'light'],
  ['iron', 'dark'],
] as const) {
  mkdirSync(join(root, 'png', out), { recursive: true });
  for (const f of files) {
    // `<name>.paper.html` / `<name>.iron.html` are fixed to one theme (copies of the 1.1 mockups).
    const fixed = f.match(/\.(paper|iron)\.html$/)?.[1];
    if (fixed && fixed !== theme) continue;
    await page.goto(`${pathToFileURL(join(root, f)).href}?theme=${theme}`);
    await page.evaluate(() => document.fonts.ready);
    const shot = fixed ? page.locator('body > div').first() : page.locator('.phone');
    await shot.screenshot({ path: join(root, 'png', out, f.replace(/(\.(paper|iron))?\.html$/, '.png')) });
  }
}
await browser.close();
console.log(`Rendered ${files.length} screens × 2 themes into ${join(root, 'png')}`);

/**
 * Smoke test for the APK's web bundle (`npm run build:native`): serves dist/ and drives onboarding →
 * start workout → log a set with hash routing and no service worker, using Capacitor's web fallbacks.
 * Runs in the Android APK workflow before Gradle, and locally where there's no Android SDK.
 *
 *   npm run build:native && npx tsx scripts/smoke-native.ts
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
if (!html.includes('src="./assets/'))
  throw new Error('dist is not a native build (expected relative asset paths)');

const port = 4176;
const server = spawn(process.execPath, ['--import', 'tsx', 'scripts/serve-dist.ts', String(port)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise<void>((resolve) =>
  server.stdout!.on('data', (d) => String(d).includes('dist on') && resolve()),
);

const browser = await chromium.launch();
const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForURL(/#\/onboarding\/about/);
  await page.getByRole('radio', { name: /intermediate/i }).click();
  await page.getByRole('button', { name: /next: your gym/i }).click();
  await page.getByRole('button', { name: /next: pick a split/i }).click();
  await page.getByRole('button', { name: /build my routine/i }).click();
  await page.getByRole('button', { name: /save routine/i }).click();
  await page.getByRole('heading', { name: 'Upper A' }).waitFor();
  await page.getByRole('button', { name: /start workout/i }).click();
  await page.waitForURL(/#\/workout$/);
  await page.locator('a[aria-current="step"]').click();
  await page
    .getByRole('group', { name: 'Load', exact: true })
    .getByRole('button', { name: /increase/ })
    .click();
  await page.getByRole('button', { name: /^log set 1/i }).click();
  await page.getByRole('button', { name: /^log set 2/i }).waitFor();
  const sw = await page.evaluate(
    async () => (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
  );
  if (sw !== 0) throw new Error(`native build registered ${sw} service worker(s)`);
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log('native bundle smoke test: OK (hash routing, onboarding → logged a set, no service worker)');
} finally {
  await browser.close();
  server.kill();
}

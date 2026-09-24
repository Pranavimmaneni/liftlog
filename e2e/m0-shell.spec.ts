import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, goOfflineAndReload, projectTheme } from './helpers';

test.describe('M0 shell', () => {
  test('FR-SET-1: System theme follows the OS colour scheme', async ({ page }, info) => {
    await page.goto('/dev/components');
    await expect(page.locator('html')).toHaveAttribute('data-theme', projectTheme(info));
  });

  test('FR-SET-1: forcing Paper / Iron applies instantly and survives a reload', async ({ page }) => {
    await page.goto('/dev/components');
    await page.getByRole('button', { name: 'Iron' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'iron');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'iron');
    await page.getByRole('button', { name: 'Paper' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(242, 234, 219)');
  });

  test('FR-PLT-8: web manifest is installable (name, standalone, icons)', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const m = await res.json();
    expect(m.name).toBe('LiftLog');
    expect(m.display).toBe('standalone');
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const i of m.icons) expect((await request.get(i.src)).ok()).toBeTruthy();
  });

  test('FR-PLT-1 / NFR-OFF-1: loads offline after the first visit, theme switch still works', async ({
    page,
    context,
    browserName,
  }) => {
    await page.goto('/dev/components');
    await goOfflineAndReload(page, browserName, '/dev/components');
    await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible();
    await page.getByRole('button', { name: 'Iron' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'iron');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await context.setOffline(false);
  });

  test('NFR-SEC-1: CSP is present and nothing leaves the origin', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname !== 'localhost') external.push(r.url());
    });
    await page.goto('/dev/components');
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });

  test('NFR-A11Y-1: /dev/components and /settings have no axe violations', async ({ page }) => {
    await page.goto('/dev/components');
    await expectNoAxeViolations(page);
    await page.goto('/settings');
    await expectNoAxeViolations(page);
  });
});

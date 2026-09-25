import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers';
import { logCurrentExercise, onboard, startWorkout } from './flows';

test.describe('M5 motivation and polish', () => {
  test('NFR-A11Y-1: every screen is axe-clean in this theme', async ({ page }) => {
    // One week of demo data keeps Playwright's WebKit fast enough (D58); `active` leaves a workout open.
    test.slow();
    await page.goto('/dev/fixture?auto=1&weeks=1&active=1');
    await page.waitForSelector('[data-fixture-done]', { timeout: 170_000 });
    const routes = [
      '/',
      '/workout',
      '/plan',
      '/plan/edit/0',
      '/library',
      '/library/bench-press',
      '/library/new',
      '/progress',
      '/progress?tab=body',
      '/progress?tab=history',
      '/progress/review',
      '/progress/strength',
      '/progress/body-stats',
      '/settings',
      '/settings/profile',
      '/settings/gym',
      '/install',
      '/scan/stickers',
    ];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').first()).toBeVisible();
      await expectNoAxeViolations(page);
    }
    // A logger, a ticket and a session detail from the demo data.
    await page.goto('/workout');
    await page.locator('a[href^="/workout/"]').first().click();
    await expect(page.getByRole('button', { name: /^log set \d/i })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.goto('/progress?tab=history');
    await page.locator('a[href^="/progress/session/"]').first().click();
    await expect(page.getByRole('button', { name: 'Delete session' })).toBeVisible();
    await expectNoAxeViolations(page);
    const id = page.url().split('/').pop()!;
    await page.goto(`/summary/${id}`);
    await expect(page.getByText('Workout complete')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('FR-SUM-2 + FR-XP-2/5: the ticket shows level, XP and a milestone, and shares as a PNG', async ({
    page,
  }) => {
    await onboard(page);
    await expect(page.getByRole('link', { name: /^level 1, rookie/i })).toBeVisible();
    await startWorkout(page);
    await logCurrentExercise(page);
    await page.getByRole('button', { name: /finish workout/i }).click();
    await expect(page.getByRole('heading', { name: /^level \d+$/i })).toBeVisible();
    await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible();
    await expect(page.getByText('Your first session is logged.')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /share/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^liftlog-upper-a-\d{4}-\d{2}-\d{2}\.png$/);
    const path = await download.path();
    const fs = await import('node:fs');
    const head = fs.readFileSync(path).subarray(0, 8);
    expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  test('S22: stickers for My Gym, and a sticker link opens the machine (FR-PLT-5)', async ({ page }) => {
    await onboard(page);
    await page.goto('/settings/gym');
    await page.getByRole('link', { name: 'Print machine stickers' }).click();
    await expect(page.getByRole('heading', { name: 'Machine stickers' })).toBeVisible();
    expect(await page.getByRole('img', { name: /^QR code for / }).count()).toBeGreaterThan(3);
    await page.goto('/m/lat-pulldown');
    await expect(page).toHaveURL(/\/library\/lat-pulldown$/);
    // With a workout open, the same link opens the logger (adding the exercise if needed).
    await page.goto('/');
    await startWorkout(page);
    await page.goto('/m/leg-press');
    await expect(page).toHaveURL(/\/workout\/leg-press$/);
    await expect(page.getByRole('heading', { name: /your machine/i })).toBeVisible();
    // Unknown machines get a clear message.
    await page.goto('/m/not-a-machine');
    await expect(page.getByText(/isn’t in this app’s list/i)).toBeVisible();
  });

  test('FR-DATA-2 + FR-PLT-8: backup nudge downloads a backup; install help is reachable', async ({
    page,
  }) => {
    await onboard(page);
    await startWorkout(page);
    await logCurrentExercise(page);
    await page.getByRole('button', { name: /finish workout/i }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    // Pretend the first session was 8 days ago so the nudge is due.
    await page.evaluate(async () => {
      const req = indexedDB.open('liftlog');
      const db: IDBDatabase = await new Promise((res) => (req.onsuccess = () => res(req.result)));
      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      const all: { endedAt: number; startedAt: number }[] = await new Promise(
        (res) => (store.getAll().onsuccess = (e) => res((e.target as IDBRequest).result)),
      );
      for (const s of all) {
        s.startedAt -= 8 * 86_400_000;
        s.endedAt -= 8 * 86_400_000;
        store.put(s);
      }
      await new Promise((res) => (tx.oncomplete = res));
      db.close();
    });
    await page.reload();
    await expect(page.getByText(/haven’t backed up yet/i)).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Back up now' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.liftlog\.json$/);
    await page.reload();
    await expect(page.getByText(/haven’t backed up yet/i)).toHaveCount(0);

    await page.getByRole('link', { name: 'How' }).click();
    await expect(page.getByRole('heading', { name: 'Install LiftLog' })).toBeVisible();
    await expect(page.getByText(/each keep their own data/i)).toBeVisible();
  });
});

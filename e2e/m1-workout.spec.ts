import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, goOfflineAndReload } from './helpers';
import { logCurrentExercise, onboard, startWorkout } from './flows';

test.describe('M1 log a workout', () => {
  test('e2e #1: onboarding → first set in under 3 minutes (FR-ONB-1, FR-WRK-5)', async ({ page }) => {
    const t0 = Date.now();
    await onboard(page);
    await startWorkout(page);
    await page.locator('a[aria-current="step"]').click();
    const load = page.getByRole('group', { name: 'Load' });
    await load.getByRole('button', { name: /increase/ }).click();
    await page.getByRole('button', { name: /^log set 1/i }).click();
    await expect(page.getByRole('button', { name: /log set 2/i })).toBeVisible();
    await expect(page.getByRole('group', { name: 'How did it feel?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /rest timer/i })).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(180_000);
  });

  test('e2e #2: full session → ticket (FR-WRK-3, FR-SUM-1, FR-RTN-4)', async ({ page }) => {
    // A whole session is ~30 logged sets; Playwright's WebKit on Windows takes ~250 ms per IndexedDB
    // write (Chromium ~17 ms), which puts this flow near the default 60 s timeout (DECISIONS D58).
    test.slow();
    await onboard(page);
    await startWorkout(page);
    const items = page.locator('main ul > li a[href^="/workout/"]');
    await expect(items.first()).toBeVisible();
    const n = await items.count();
    expect(n).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < n; i++) {
      await expect(page.locator('a[aria-current="step"]')).toBeVisible();
      await logCurrentExercise(page);
    }
    await expect(page.locator('a[aria-current="step"]')).toHaveCount(0);
    const text = (await page.getByRole('meter').getAttribute('aria-valuetext')) ?? '';
    const [, done, total] = text.match(/(\d+) of (\d+)/) ?? [];
    expect(done).toBe(total);
    await page.getByRole('button', { name: /finish workout/i }).click();
    await expect(page).toHaveURL(/\/summary\//);
    await expect(page.getByText('Workout complete')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
    await expect(page.getByText('Goal sets')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    // The rotation advanced.
    await expect(page.getByRole('heading', { name: 'Lower A' })).toBeVisible();
    await expect(page.getByText(/1 of 4 done/i)).toBeVisible();
  });

  test('e2e #3: offline session (FR-PLT-1, NFR-OFF-1)', async ({ page, browserName }) => {
    await onboard(page);
    await goOfflineAndReload(page, browserName, '/');
    await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
    await startWorkout(page);
    await page.locator('a[aria-current="step"]').click();
    await page
      .getByRole('group', { name: 'Load' })
      .getByRole('button', { name: /increase/ })
      .click();
    await page.getByRole('button', { name: /^log set 1/i }).click();
    await expect(page.getByRole('button', { name: /log set 2/i })).toBeVisible();
    await page.context().setOffline(false);
  });

  test('e2e #4: kill/reload mid-session resumes with every set intact (FR-WRK-13, NFR-REL-1)', async ({
    page,
  }) => {
    await onboard(page);
    await startWorkout(page);
    await page.locator('a[aria-current="step"]').click();
    await expect(page).toHaveURL(/\/workout\/.+/);
    const url = page.url();
    await page
      .getByRole('group', { name: 'Load' })
      .getByRole('button', { name: /increase/ })
      .click();
    await page.getByRole('button', { name: /^log set 1/i }).click();
    await page.getByRole('button', { name: /^log set 2/i }).click();
    await expect(page.getByRole('button', { name: /log set 3/i })).toBeVisible();
    // "Kill" the app: close the page and open a new one on the same origin.
    const ctx = page.context();
    await page.close();
    const again = await ctx.newPage();
    await again.goto('/');
    await expect(again.getByRole('button', { name: /resume workout/i })).toBeVisible();
    await again.goto(url);
    await expect(again.getByRole('button', { name: /log set 3/i })).toBeVisible();
    await expect(again.getByText('Set 1', { exact: true })).toBeVisible();
    await expect(again.getByText('Set 2', { exact: true })).toBeVisible();
  });

  test('e2e #5: backup export → delete → import restores everything (FR-DATA-1/3/4, NFR-REL-2)', async ({
    page,
  }) => {
    await onboard(page);
    await startWorkout(page);
    await logCurrentExercise(page);
    await page.getByRole('button', { name: /finish workout/i }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.goto('/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /back up now/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^liftlog-\d{4}-\d{2}-\d{2}\.liftlog\.json$/);
    const path = await download.path();
    // Delete everything with the typed confirmation.
    await page.getByRole('button', { name: /delete all data/i }).click();
    const del = page.getByRole('button', { name: /delete everything/i });
    await expect(del).toBeDisabled();
    await page.getByRole('dialog').getByRole('textbox').fill('DELETE');
    await del.click();
    await expect(page).toHaveURL(/\/onboarding\/about/);
    // Restore from the file.
    await page.goto('/settings');
    await page.getByTestId('restore-input').setInputFiles(path);
    await expect(page.getByTestId('restore-preview')).toContainText('1 sessions');
    await page.getByRole('button', { name: /replace everything/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Lower A' })).toBeVisible();
    await page.goto('/progress?tab=history');
    await expect(page.getByRole('link', { name: /upper a/i })).toBeVisible();
  });

  test('M1 phone check 5: dumbbell exercises say "kg / hand"', async ({ page }) => {
    await onboard(page);
    await startWorkout(page);
    await page.getByRole('link', { name: /incline dumbbell press/i }).click();
    await expect(page.getByText('kg/hand', { exact: true })).toBeVisible();
  });

  test('NFR-A11Y-1: M1 routes have no axe violations', async ({ page }) => {
    await page.goto('/onboarding/about');
    await expectNoAxeViolations(page);
    await onboard(page);
    await expectNoAxeViolations(page);
    await page.goto('/library');
    await expect(page.getByText(/results/)).toBeVisible();
    await expectNoAxeViolations(page);
    await page.goto('/plan');
    await expectNoAxeViolations(page);
    await page.goto('/settings');
    await expectNoAxeViolations(page);
    await page.goto('/');
    await startWorkout(page);
    await expectNoAxeViolations(page);
    await page.locator('a[aria-current="step"]').click();
    await page
      .getByRole('group', { name: 'Load' })
      .getByRole('button', { name: /increase/ })
      .click();
    await page.getByRole('button', { name: /^log set 1/i }).click();
    await expectNoAxeViolations(page);
  });
});

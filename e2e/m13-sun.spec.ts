import { expect, test, type Page } from '@playwright/test';
import { onboard, startWorkout } from './flows';
import { expectNoAxeViolations, goOfflineAndReload } from './helpers';

/** Opens the app in the Rising Sun look: the pre-paint mirror that Settings writes (FR-DSN-1). */
async function useSun(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ll-design', 'sun'));
}

async function expectNoSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe('M13 Rising Sun look', () => {
  test('FR-DSN-1: classic by default; Settings switches the look and it survives a reload', async ({
    page,
  }) => {
    await onboard(page);
    await expect(page.locator('html')).toHaveAttribute('data-design', 'classic');
    await expect(page.getByTestId('sun-backdrop')).toHaveCount(0);

    await page.goto('/settings');
    await page.getByRole('group', { name: 'Look' }).getByRole('button', { name: 'Rising Sun' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-design', 'sun');
    await expect(page.getByRole('switch', { name: 'Frosted glass' })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-design', 'sun');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    // FR-DSN-3: the sun sits behind Today; FR-DSN-2: LiftLog is the workout family.
    await expect(page.getByTestId('sun-backdrop')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('data-section', 'workout');
    await page.goto('/food');
    await expect(page.locator('html')).toHaveAttribute('data-section', 'food');
  });

  test('FR-DSN-4…7: Today → workout → log a set → rest → next set, accessible at 360 px', async ({
    page,
  }) => {
    await useSun(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await onboard(page);

    // FR-DSN-4 Today: workout card, Food card, the kept features.
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('link', { name: /log food/i })).toBeVisible();
    await expect(page.getByRole('region', { name: 'This week' })).toBeVisible();
    const cal = page.getByRole('button', { name: /days? trained/i });
    await cal.click();
    await expect(cal).toHaveAttribute('aria-pressed', 'true');
    await expectNoSidewaysScroll(page);
    await expectNoAxeViolations(page);

    // FR-DSN-5 Active workout.
    await startWorkout(page);
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await expectNoAxeViolations(page);

    // FR-DSN-6 Logging a set.
    await page.locator('a[aria-current="step"]').click();
    await expect(page).toHaveURL(/\/workout\/.+/);
    const log = page.getByRole('button', { name: /^log set 1/i });
    await expect(log).toBeVisible();
    await expect(page.getByText('Last session')).toBeVisible();
    await expect(page.getByTestId('goal-reason')).toBeVisible();
    const load = page.getByRole('group', { name: 'Load', exact: true });
    if (await load.count()) {
      if ((await load.getByRole('spinbutton').getAttribute('aria-valuetext')) === 'empty')
        await load.getByRole('button', { name: /increase/ }).click();
    }
    await expectNoSidewaysScroll(page);
    await expectNoAxeViolations(page);
    await log.click();
    // FR-DSN-8: a logged set ripples the sun.
    await expect(page.getByTestId('echo-ripple')).toBeAttached();

    // FR-DSN-7 Rest: ring countdown, effort question, "Start set 2 now".
    await expect(page.getByRole('timer')).toBeVisible();
    await page
      .getByRole('group', { name: 'How did set 1 feel?' })
      .getByRole('button', { name: 'Solid' })
      .click();
    await expect(page.getByRole('button', { name: 'Solid' })).toHaveAttribute('aria-pressed', 'true');
    await expectNoSidewaysScroll(page);
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: /options for/i }).click();
    await expect(page.getByRole('button', { name: 'Plus 15 seconds' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hurts' })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Start set 2 now' }).click();
    await expect(page.getByRole('button', { name: /^log set 2/i })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveCount(0);

    // The set survived (written when logged) and the workout screen counts it.
    await page.getByRole('link', { name: /^back/i }).click();
    await expect(page).toHaveURL(/\/workout$/);
    await expect(page.getByText(/1 of \d+ sets/)).toBeVisible();
  });

  test('FR-DSN-10 / FR-DSN-11: every main screen is accessible in the new look, at 360 px', async ({
    page,
  }) => {
    test.setTimeout(240_000); // 18 screens with an axe pass each; WebKit is slow (D58)
    await useSun(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await onboard(page);
    const routes = [
      '/plan',
      '/plan/edit/0',
      '/progress',
      '/progress/review',
      '/progress/strength',
      '/progress/body-stats',
      '/library',
      '/library/new',
      '/settings',
      '/settings/gym',
      '/settings/profile',
      '/install',
      '/food',
      '/food/add',
      '/food/new',
      '/food/targets',
      '/food/review',
      '/food/fasting',
    ];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading').first()).toBeVisible();
      // FR-DSN-3: the sun is behind every screen.
      await expect(page.getByTestId('sun-backdrop')).toHaveCount(1);
      await expectNoSidewaysScroll(page);
      // At the end of the page floating bars rest in the flow, so none covers a row.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expectNoAxeViolations(page);
    }
  });

  test('NFR-OFF-1: the Rising Sun look works offline (fonts are self-hosted)', async ({
    page,
    browserName,
  }) => {
    await useSun(page);
    await onboard(page);
    await goOfflineAndReload(page, browserName, '/');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: /start workout/i })).toBeVisible();
  });
});

import { expect, type Page } from '@playwright/test';

/** Completes onboarding with defaults (intermediate, build muscle, 4 days, full gym, Upper / Lower). */
export async function onboard(page: Page, opts: { units?: 'kg' | 'lb' } = {}) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding\/about/);
  await expect(page.getByRole('heading', { name: /how long have you been lifting/i })).toBeVisible();
  await page.getByRole('radio', { name: /intermediate/i }).click();
  await page.getByRole('button', { name: /next: your gym/i }).click();
  await expect(page.getByRole('heading', { name: /what’s in your gym/i })).toBeVisible();
  if (opts.units === 'lb') await page.getByRole('button', { name: 'lb', exact: true }).click();
  await page.getByRole('button', { name: /next: pick a split/i }).click();
  await expect(page.getByRole('heading', { name: /pick your split/i })).toBeVisible();
  await page.getByRole('button', { name: /build my routine/i }).click();
  await expect(page.getByRole('heading', { name: /your routine/i })).toBeVisible();
  await page.getByRole('button', { name: /save routine/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
}

export async function startWorkout(page: Page) {
  await page.getByRole('button', { name: /start workout|resume workout/i }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole('meter')).toBeVisible();
}

/** Logs every planned set of the current exercise, skipping warm-ups and rest. */
export async function logCurrentExercise(page: Page, calibrationLoad = true) {
  await page.locator('a[aria-current="step"]').click();
  await expect(page).toHaveURL(/\/workout\/.+/);
  await expect(page.getByRole('button', { name: /^log set \d/i })).toBeVisible();
  const back = page.getByRole('button', { name: /back to workout/i });
  for (let i = 0; i < 12; i++) {
    const log = page.getByRole('button', { name: /^log set \d/i });
    const label = (await log.textContent()) ?? '';
    const loadGroup = page.getByRole('group', { name: 'Load', exact: true });
    if (calibrationLoad && (await loadGroup.count())) {
      const empty = (await loadGroup.getByRole('spinbutton').getAttribute('aria-valuetext')) === 'empty';
      if (empty) await loadGroup.getByRole('button', { name: /increase/ }).click();
    }
    await log.click();
    // Wait for the next state: a different "Log set …" label, or the done state.
    await expect(async () => {
      const done = await back.isVisible();
      const next = done ? '' : ((await log.allTextContents())[0] ?? label);
      expect(done || next !== label).toBe(true);
    }).toPass({ timeout: 10_000 });
    if (await back.isVisible()) break;
  }
  await back.click();
  await expect(page).toHaveURL(/\/workout$/);
}

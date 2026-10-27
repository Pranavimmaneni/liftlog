import { expect, test } from '@playwright/test';
import { onboard, startWorkout } from './flows';
import { expectNoAxeViolations } from './helpers';

test('FR-WRK-16: Undo right after Start workout, and Cancel workout, leave Up next unchanged', async ({
  page,
}) => {
  await onboard(page);
  await startWorkout(page);
  await expect(page.getByText('Workout started.')).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Undo start workout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();

  await startWorkout(page);
  await page.getByRole('button', { name: 'Cancel workout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
  await expect(page.getByRole('button', { name: /start workout/i })).toBeVisible();
});

test('FR-WRK-5a: typing 122.5 into the load keeps every digit visible', async ({ page }) => {
  await onboard(page);
  await startWorkout(page);
  await page.locator('a[aria-current="step"]').click();
  const load = page.getByRole('group', { name: 'Load', exact: true });
  await load.getByRole('spinbutton').click();
  const input = load.getByRole('textbox');
  await input.fill('122.5');
  const box = (await input.boundingBox())!;
  const scroll = await input.evaluate((el) => (el as HTMLInputElement).scrollWidth);
  expect(scroll).toBeLessThanOrEqual(Math.ceil(box.width));
  await input.press('Enter');
  const value = load.getByRole('spinbutton');
  await expect(value).toHaveAttribute('aria-valuenow', '122.5');
  const fits = await value.evaluate((el) => {
    const text = el.querySelector('span')!.getBoundingClientRect();
    const area = el.getBoundingClientRect();
    return text.left >= area.left - 0.5 && text.right <= area.right + 0.5;
  });
  expect(fits).toBe(true);
  await expectNoAxeViolations(page);
});

test('FR-NAV-1: no Library tab; the Library opens from Plan and goes back to it', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Today', 'Plan', 'Progress']);
  await nav.getByRole('link', { name: 'Plan' }).click();
  await page.getByRole('link', { name: 'Exercise library' }).first().click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/plan$/);
});

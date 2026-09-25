import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers';

test('Build your own split: combine muscle groups per day, then edit the suggested routine (D79)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /next: your gym/i }).click();
  await page.getByRole('button', { name: /next: pick a split/i }).click();
  await page.getByRole('radio', { name: /build your own/i }).click();
  await page.getByRole('button', { name: 'Remove day 4' }).click();
  const pick = async (day: number, names: string[]) => {
    for (const n of names)
      await page
        .getByRole('group', { name: `Muscle groups for day ${day}` })
        .getByRole('button', { name: n, exact: true })
        .click();
  };
  await pick(1, ['Chest', 'Biceps']);
  await pick(2, ['Shoulders', 'Triceps']);
  await pick(3, ['Legs', 'Back']);
  await expect(page.getByRole('heading', { name: 'Legs + Back' })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: /build my routine/i }).click();
  await expect(page.getByRole('heading', { name: /your routine/i })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveText(['Chest + Biceps', 'Shoulders + Triceps', 'Legs + Back']);
  const rows = page.getByRole('button', { name: /^reorder/i });
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  await expectNoAxeViolations(page);

  // Replace the first exercise with an alternative.
  const first = ((await rows.first().getAttribute('aria-label')) ?? '').replace(/^Reorder /, '');
  await page
    .getByRole('button', { name: /^swap /i })
    .first()
    .click();
  const alt = page.getByRole('dialog').locator('button:has(span.font-bold)').first();
  await alt.click();
  await expect(rows.first()).not.toHaveAttribute('aria-label', `Reorder ${first}`);

  await page.getByRole('button', { name: /save routine/i }).click();
  await expect(page.getByRole('heading', { name: 'Chest + Biceps' })).toBeVisible();
});

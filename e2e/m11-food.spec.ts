import { expect, test, type Page } from '@playwright/test';
import { onboard } from './flows';
import { expectNoAxeViolations } from './helpers';

/**
 * M11 Food screens (PRD-1.2 FR-NAV-2, FR-DIARY-*, FR-FOOD-3, FR-TGT-*, FR-FAST-1, FR-NUT-2).
 * The library is imported through /dev/food; the Indian chunk is enough for these flows and keeps
 * WebKit's slow IndexedDB on Windows out of the way (D58, D113).
 */
async function setup(page: Page) {
  await onboard(page);
  await page.goto('/dev/food?subset=indian');
  await page.getByRole('button', { name: /import library now/i }).click();
  await expect(page.getByTestId('food-lib-status')).toContainText(/Library \d{4}-\d{2}-\d{2}/, {
    timeout: 60_000,
  });
}

test('FR-NAV-2: the section switch moves between LiftLog and Food and is remembered', async ({ page }) => {
  await onboard(page);
  const sw = page.getByRole('navigation', { name: 'Section' });
  await sw.getByRole('link', { name: 'Food' }).click();
  await expect(page).toHaveURL(/\/food$/);
  await expect(page.getByRole('navigation', { name: 'Food' }).getByRole('link')).toHaveText([
    'Diary',
    'Review',
    'Fasting',
  ]);
  await expectNoAxeViolations(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/food$/);
  await page.getByRole('navigation', { name: 'Section' }).getByRole('link', { name: 'LiftLog' }).click();
  await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
});

test('FR-DIARY-1/2, FR-FOOD-3: log a food from search, then edit and delete it', async ({ page }) => {
  test.slow();
  await setup(page);
  await page.goto('/food/add?meal=dinner');
  await expect(page.getByRole('heading', { name: 'Add to dinner' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search foods' }).fill('dal tadka');
  await page.getByRole('button', { name: 'Add Dal tadka' }).click();
  const sheet = page.getByRole('dialog', { name: 'Dal tadka' });
  await expect(sheet).toBeVisible();
  await expectNoAxeViolations(page);
  await sheet.getByRole('button', { name: 'Add to dinner' }).click();
  await expect(sheet).toBeHidden();

  await page.goto('/food');
  // No weigh-in yet after onboarding, so the Diary asks for one instead of showing calories left.
  await expect(page.getByText('Add a weigh-in to get your targets.')).toBeVisible();
  await page.getByRole('link', { name: /dinner.*dal tadka/i }).click();
  await page.getByRole('button', { name: 'Edit Dal tadka' }).click();
  const edit = page.getByRole('dialog', { name: 'Dal tadka' });
  await edit.getByRole('button', { name: /^more/i }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/1\.5 × 1 katori/)).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Delete Dal tadka' }).click();
  await expect(page.getByText('Nothing logged in this meal yet.')).toBeVisible();
});

test('FR-FOOD-5, FR-TGT-1: quick add, then Targets asks for a weigh-in first', async ({ page }) => {
  await onboard(page);
  await page.goto('/food/new?tab=quick&meal=lunch');
  await expect(page.getByRole('tab', { name: 'Quick add', selected: true })).toBeVisible();
  await page.getByRole('textbox', { name: /^name/i }).fill('Office samosa');
  await page.getByRole('textbox', { name: /^calories/i }).fill('260');
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Save food' }).click();
  await expect(page).toHaveURL(/\/food$/);
  await expect(page.getByRole('link', { name: /lunch.*office samosa/i })).toBeVisible();

  await page.goto('/food/targets');
  await expect(page.getByText('Add a weigh-in to get your targets.')).toBeVisible();
  await expectNoAxeViolations(page);
});

test('FR-FAST-1: start a fast, see the time left, end it', async ({ page }) => {
  await onboard(page);
  await page.goto('/food/fasting');
  await page.getByRole('radio', { name: '16:8' }).click();
  await page.getByRole('button', { name: 'Start fast' }).click();
  await expect(page.getByRole('meter', { name: 'Fast progress' })).toBeVisible();
  await expect(page.getByText(/16 h 0 m left|15 h 59 m left/)).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'End fast' }).click();
  await expect(page.getByRole('button', { name: 'Start fast' })).toBeVisible();
});

test('FR-NUT-2: Review shows the week and asks for a weigh-in first', async ({ page }) => {
  await onboard(page);
  await page.goto('/food/review');
  await expect(page.getByRole('heading', { name: /^week \d+$/i })).toBeVisible();
  // Onboarding adds no weigh-in, so Review asks for one first.
  await expect(page.getByText('Add a weigh-in to get targets and your review.')).toBeVisible();
  await expectNoAxeViolations(page);
});

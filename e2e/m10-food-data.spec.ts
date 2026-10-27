import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, waitForServiceWorker } from './helpers';

/**
 * M10 food data (PRD-1.2 FR-FOOD-1..3, NFR-OFF-3). The background import is off under automation
 * (D101), so the test imports through /dev/food, then searches, then searches again offline.
 */
test('FR-FOOD-2 / NFR-OFF-3: the food library imports once, searches, and works offline', async ({
  page,
  browserName,
}) => {
  test.slow(); // ~30,000 IndexedDB rows; WebKit's IndexedDB is slow on Windows (D58)
  await page.goto('/dev/food');
  const status = page.getByTestId('food-lib-status');
  await expect(status).toContainText('0 foods stored');
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: /import library now/i }).click();
  await expect(status).not.toContainText(' 0 foods stored', { timeout: 120_000 });
  await expect(page.getByRole('button', { name: /import library now/i })).toBeEnabled({ timeout: 120_000 });

  const search = page.getByRole('searchbox', { name: 'Search foods' });
  await search.fill('paneer');
  await expect(page.getByTestId('food-results').getByRole('listitem').first()).toContainText(/paneer/i, {
    timeout: 30_000,
  });
  await search.fill('dal tadka');
  await expect(page.getByTestId('food-results')).toContainText(/dal/i);

  // FR-TGT-2: the sample person's numbers match the F05 mockup.
  await expect(page.getByTestId('food-targets')).toContainText('kcal 2950');

  if (browserName === 'chromium') {
    await waitForServiceWorker(page);
    await page.context().setOffline(true);
    await page.goto('/dev/food');
    await page.getByRole('searchbox', { name: 'Search foods' }).fill('banana');
    await expect(page.getByTestId('food-results').getByRole('listitem').first()).toContainText(/banana/i, {
      timeout: 30_000,
    });
  }
});

import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers';
import { onboard, startWorkout } from './flows';

// 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('M2 coach', () => {
  test('e2e #6: swap an exercise for this session only, then in the routine (FR-RTN-2, S23)', async ({
    page,
  }) => {
    await onboard(page);
    await startWorkout(page);
    await page.getByRole('link', { name: /lat pulldown/i }).click();
    await page.getByRole('button', { name: /swap lat pulldown/i }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('button', { name: 'This session only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const alt = sheet.locator('button:has(span.font-bold)').first();
    const altName = ((await alt.locator('span.font-bold').first().textContent()) ?? '').trim();
    await alt.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(altName);
    await page.goto('/workout');
    await expect(page.getByRole('link', { name: new RegExp(altName, 'i') })).toBeVisible();
    await expect(page.getByRole('link', { name: /lat pulldown/i })).toHaveCount(0);
    // The routine itself is unchanged.
    await page.goto('/plan');
    await expect(page.getByText(/lat pulldown/i).first()).toBeVisible();

    // Replace in routine.
    await page.goto('/workout');
    await page.getByRole('link', { name: new RegExp(altName, 'i') }).click();
    await page.getByRole('button', { name: /^swap /i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Replace in routine' }).click();
    const alt2 = page.getByRole('dialog').locator('button:has(span.font-bold)').first();
    const alt2Name = ((await alt2.locator('span.font-bold').first().textContent()) ?? '').trim();
    await alt2.click();
    await page.goto('/plan');
    await expect(page.getByText(new RegExp(alt2Name, 'i')).first()).toBeVisible();
  });

  test('M2 phone check 1: a home-dumbbell routine only uses what you ticked', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /next: your gym/i }).click();
    await page.getByRole('button', { name: 'Home DBs' }).click();
    await page.getByRole('button', { name: /next: pick a split/i }).click();
    await page.getByRole('button', { name: /build my routine/i }).click();
    await expect(page.getByRole('heading', { name: /your routine/i })).toBeVisible();
    const text = await page.locator('[role="tabpanel"]').innerText();
    expect(text).not.toMatch(/barbell|machine|cable|smith|pulldown/i);
  });

  test('M2 phone check 2: coverage flags a missing muscle and "+ Fix" adds something (FR-RTN-3)', async ({
    page,
  }) => {
    await onboard(page);
    await page.goto('/plan');
    await page
      .getByRole('link', { name: /edit session/i })
      .first()
      .click();
    const card = page.locator('section', { has: page.getByRole('heading', { name: /hard sets per week/i }) });
    await expect(card).toBeVisible();
    const fixes = card.getByRole('button', { name: /^fix /i });
    const before = await fixes.count();
    expect(before).toBeGreaterThan(0);
    await fixes.first().click();
    await expect(page.getByText(/^Added .+ to /)).toBeVisible();
  });

  test('M2 phone check 3: an easy first set on a new exercise suggests a heavier second set (FR-WRK-9)', async ({
    page,
  }) => {
    await onboard(page);
    await startWorkout(page);
    await page.locator('a[aria-current="step"]').click();
    await page
      .getByRole('group', { name: 'Load' })
      .getByRole('button', { name: /increase/ })
      .click();
    await page.getByRole('button', { name: /^log set 1/i }).click();
    await page.getByRole('button', { name: 'Easy' }).click();
    const nudge = page.getByRole('status').filter({ hasText: /was easy/i });
    await expect(nudge).toBeVisible();
    await nudge.getByRole('button', { name: /^use /i }).click();
    await expect(page.getByRole('group', { name: 'Load' }).getByRole('spinbutton')).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
  });

  test('M2 phone check 4: machine photo and settings are there next time (FR-GYM-2/3)', async ({ page }) => {
    await onboard(page);
    await startWorkout(page);
    await page.getByRole('link', { name: /lat pulldown/i }).click();
    await expect(page.getByRole('heading', { name: /your machine/i })).toBeVisible();
    await page
      .getByTestId('machine-photo-input')
      .setInputFiles({ name: 'm.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('img', { name: /photo of your lat pulldown/i })).toBeVisible();
    await page.getByRole('button', { name: /\+ setting/i }).click();
    const d = page.getByRole('dialog');
    await d.getByRole('textbox', { name: 'Name' }).fill('Seat');
    await d.getByRole('textbox', { name: 'Value' }).fill('4');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: /seat: 4/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('img', { name: /photo of your lat pulldown/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /seat: 4/i })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('FR-GYM-4: add a custom machine in Settings → My gym', async ({ page }) => {
    await onboard(page);
    await page.goto('/settings/gym');
    await page.getByRole('button', { name: /add a machine/i }).click();
    const d = page.getByRole('dialog');
    await d.getByRole('textbox', { name: /machine name/i }).fill('Viking press');
    await d.getByRole('button', { name: /add machine/i }).click();
    await expect(page.getByText('Viking press', { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

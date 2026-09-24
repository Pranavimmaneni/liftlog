import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers';
import { onboard, startWorkout } from './flows';

/**
 * Logs every set of the current (first) exercise. `load` types a weight into the Load stepper on the
 * first set; `repsDelta` presses the reps stepper (negative = fewer reps, i.e. a miss). Returns the
 * logger's "Next time" line.
 */
async function logFirst(page: Page, opts: { load?: number; repsDelta?: number } = {}): Promise<string> {
  await page.locator('a[aria-current="step"]').click();
  await expect(page).toHaveURL(/\/workout\/.+/);
  const back = page.getByRole('button', { name: /back to workout/i });
  const log = page.getByRole('button', { name: /^log set \d/i });
  await expect(log).toBeVisible();
  if (opts.load !== undefined) {
    const group = page.getByRole('group', { name: 'Load', exact: true });
    await group.getByRole('spinbutton').click();
    await group.getByRole('textbox').fill(String(opts.load));
    await group.getByRole('textbox').press('Enter');
    await expect(group.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', String(opts.load));
  }
  for (let i = 0; i < 12; i++) {
    const label = (await log.textContent()) ?? '';
    const reps = page.getByRole('group', { name: 'Reps', exact: true });
    const d = opts.repsDelta ?? 0;
    for (let k = 0; k < Math.abs(d); k++) {
      await reps.getByRole('button', { name: d < 0 ? /decrease/ : /increase/ }).click();
    }
    await log.click();
    await expect(async () => {
      const done = await back.isVisible();
      const next = done ? '' : ((await log.allTextContents())[0] ?? label);
      expect(done || next !== label).toBe(true);
    }).toPass({ timeout: 10_000, intervals: [50, 100, 200] });
    if (await back.isVisible()) break;
  }
  const next = (await page.getByTestId('next-time').textContent()) ?? '';
  await back.click();
  await page.getByRole('button', { name: /finish workout/i }).click();
  await expect(page).toHaveURL(/\/summary\//);
  await page.getByRole('button', { name: 'Done' }).click();
  return next;
}

/** Makes Upper A the next session again via Plan → "Skip to" (FR-RTN-4). */
async function upperANext(page: Page) {
  await page.goto('/plan');
  const row = page.getByTestId('plan-session').filter({ has: page.getByRole('link', { name: /upper a$/i }) });
  await expect(row).toBeVisible();
  const skip = row.getByRole('button', { name: 'Skip to' });
  if (await skip.count()) await skip.click();
  await expect(row.getByText('Next', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
}

test.describe('M3 progression', () => {
  test('e2e #7: hitting every rep twice puts the weight up, with the reason (FR-PRG-2, FR-PRG-8)', async ({
    page,
  }) => {
    await onboard(page);
    await startWorkout(page);
    const first = await logFirst(page, { load: 100 });
    expect(first).toMatch(/set from your first session/i);
    await upperANext(page);
    await startWorkout(page);
    const second = await logFirst(page);
    // "Next time: 102.5 kg × 10. Up 2.5 kg: every set hit 10."
    expect(second).toMatch(/^Next time: 10[1-9](\.\d)? kg/);
    expect(second).toMatch(/Up \d+(\.\d)? kg: every set hit \d+/);
    // The logger goal card carries the new target into the next session.
    await upperANext(page);
    await startWorkout(page);
    await page.locator('a[aria-current="step"]').click();
    await expect(page.getByRole('button', { name: /^change target/i })).toContainText(/10[1-9]/);
  });

  test('M3 phone check: missing reps twice drops the weight 10% (FR-PRG-4)', async ({ page }) => {
    test.slow();
    await onboard(page);
    await startWorkout(page);
    await logFirst(page, { load: 100 });
    await upperANext(page);
    await startWorkout(page);
    const miss1 = await logFirst(page, { repsDelta: -4 });
    expect(miss1).toMatch(/same weight/i);
    await upperANext(page);
    await startWorkout(page);
    const miss2 = await logFirst(page, { repsDelta: -4 });
    expect(miss2).toMatch(/Down 10%: two tough sessions in a row/);
    expect(miss2).toMatch(/Next time: 9\d(\.\d)? kg/);
  });

  test('M3 phone check: an override sticks and "Reset to coach’s pick" undoes it (FR-PRG-8, S24)', async ({
    page,
  }) => {
    await onboard(page);
    await startWorkout(page);
    await page.locator('a[aria-current="step"]').click();
    const card = page.getByRole('button', { name: /^change target/i });
    await card.click();
    const d = page.getByRole('dialog');
    await expect(d.getByText('Coach’s pick:')).toBeVisible();
    await d
      .getByRole('group', { name: 'Sets' })
      .getByRole('button', { name: /increase/ })
      .click();
    await d.getByRole('button', { name: 'Use my target' }).click();
    await expect(page.getByText('Your target')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Your target')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: /^change target/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset to coach’s pick' }).click();
    await expect(page.getByText('Your target')).toHaveCount(0);
  });

  test('S16 + S17: create a custom exercise, see it in the library, open its detail (FR-LIB-6)', async ({
    page,
  }) => {
    await onboard(page);
    await page.goto('/library/new');
    await page.getByRole('button', { name: 'Save exercise' }).click();
    await expect(page.getByText('Give it a name.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Landmine Press');
    await page.getByRole('group', { name: 'Main muscle' }).getByRole('button', { name: 'Chest' }).click();
    await page.getByRole('combobox', { name: 'How is it loaded?' }).selectOption('plate_loaded');
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Save exercise' }).click();
    await expect(page.getByRole('heading', { name: 'Landmine Press' })).toBeVisible();
    await expect(page.getByRole('img', { name: /muscles worked/i })).toBeVisible();
    await page.goto('/library');
    await page.getByRole('searchbox').fill('landmine');
    await page.getByRole('link', { name: /landmine press/i }).click();
    await expect(page).toHaveURL(/\/library\/custom-landmine-press-/);

    // A seeded Tier 2 exercise shows its animated pictogram.
    await page.goto('/library/barbell-curl');
    await expect(page.getByRole('img', { name: 'Barbell Curl' }).first()).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('M3 phone check: /dev/poses shows every pictogram (FR-ILL-2)', async ({ page }) => {
    await page.goto('/dev/poses');
    await expect(page.getByTestId('pose-count')).toContainText(/\d{3} pictograms/);
    const n = await page.locator('[data-pose]').count();
    expect(n).toBeGreaterThanOrEqual(130);
    await page.getByRole('searchbox', { name: 'Filter poses' }).fill('squat');
    await expect(page.locator('[data-pose]').first()).toBeVisible();
  });
});

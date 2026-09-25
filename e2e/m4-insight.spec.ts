import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers';
import { logCurrentExercise, onboard, startWorkout } from './flows';

function isoDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test.describe('M4 insight', () => {
  test('M4 phone check 1: weekly review shows one "Going well" and one "Needs work" (FR-REV-1)', async ({
    page,
  }) => {
    // 3 weeks of demo data: enough for last week's review and the recomp check. Playwright's WebKit
    // needs ~1.5 min to write it (IndexedDB ~100 ms per operation there, D58); Chromium ~2 s.
    test.slow();
    await page.goto('/dev/fixture?auto=1&weeks=3');
    await page.waitForSelector('[data-fixture-done]', { timeout: 170_000 });
    await page.goto('/progress/review');
    await expect(page.getByRole('heading', { name: /week \d+ review/i })).toBeVisible();
    await expect(page.getByText('Going well')).toBeVisible();
    await expect(page.getByText('Needs work')).toBeVisible();
    await expect(page.getByText(/recomp check/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /next week and why/i })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Monthly' }).click();
    await expect(page.getByRole('heading', { name: /hard sets per muscle/i })).toBeVisible();
    await expectNoAxeViolations(page);
    // The hub and strength levels also render on the fixture, axe clean.
    await page.goto('/progress');
    await expect(page.getByRole('combobox', { name: 'Exercise' })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.goto('/progress/strength');
    await expect(page.getByText(/^Next: /).first()).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('M4 phone check 2: three weigh-ins make the recomp check appear (FR-REV-3, S20)', async ({ page }) => {
    await onboard(page);
    await page.goto('/progress?tab=body');
    await expect(page.getByText(/log 3 more weigh-ins/i)).toBeVisible();
    for (const days of [14, 7, 0]) {
      await page.getByRole('button', { name: 'Add weigh-in' }).click();
      const d = page.getByRole('dialog');
      await d.getByLabel('Date').fill(isoDaysAgo(days));
      await d.getByRole('button', { name: /save weigh-in/i }).click();
      await expect(d).toBeHidden();
    }
    await expect(page.getByText(/more weigh-in/i)).toHaveCount(0);
    await expect(page.getByText(/^(On track|Watch)$/)).toBeVisible();
    await expect(page.getByRole('button', { name: /delete weigh-in/i })).toHaveCount(3);
  });

  test('M4 phone checks 3 + 4: strength asks for body stats once; history edits a set (FR-STR-3, S18)', async ({
    page,
  }) => {
    test.slow();
    await onboard(page);
    await startWorkout(page);
    // Upper A starts with Lat Pulldown, then Incline Dumbbell Press (a strength benchmark).
    await logCurrentExercise(page);
    await logCurrentExercise(page);
    await page.getByRole('button', { name: /finish workout/i }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    await page.goto('/progress/strength');
    await expect(page.getByRole('heading', { name: 'Body stats' })).toBeVisible();
    await page.getByRole('group', { name: 'Sex' }).getByRole('button', { name: 'Male', exact: true }).click();
    await page.getByRole('textbox', { name: 'Birth year' }).fill('1995');
    const bw = page.getByRole('group', { name: 'Bodyweight' });
    await bw.getByRole('spinbutton').click();
    await bw.getByRole('textbox').fill('80');
    await bw.getByRole('textbox').press('Enter');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Strength levels' })).toBeVisible();
    await expect(page.getByText('Guideline values')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chest' })).toBeVisible();
    await expect(page.getByText(/^Next: /)).toBeVisible();
    // Asked once only.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Strength levels' })).toBeVisible();

    // History → S18 → edit a set.
    await page.goto('/progress?tab=history');
    await page.getByRole('link', { name: /upper a/i }).click();
    await expect(page).toHaveURL(/\/progress\/session\//);
    const first = page.getByRole('button', { name: /^edit set 1:/i }).first();
    const before = (await first.getAttribute('aria-label')) ?? '';
    await first.click();
    const d = page.getByRole('dialog');
    await d
      .getByRole('group', { name: 'Reps' })
      .getByRole('button', { name: /decrease/ })
      .click();
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d).toBeHidden();
    await expect(page.getByRole('button', { name: /^edit set 1:/i }).first()).not.toHaveAttribute(
      'aria-label',
      before,
    );
    await expectNoAxeViolations(page);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from '@/db/schema';
import { defaultReviewTime } from '@/db/insight';
import type { DiaryRow } from '@/db/types';
import { emptyNutrients } from '@/engine/food-types';
import { addDays, dateKey } from '@/engine/week';
import { targetsFor } from './hooks';
import { isoWeek, loadFoodReview } from './ReviewData';

const W = { timeout: 8000 };
const HOUR = 3_600_000;

/**
 * Last completed week (what the Review opens on): trained Mon/Wed/Fri at 18:30 with protein short,
 * carbs eaten at 16:00 before each session, on target on the other days.
 */
async function seedWeek() {
  await seedOnboarded();
  const now = Date.now();
  const start = defaultReviewTime(now, 1);
  await db.bodyweights.add({ date: dateKey(addDays(start, -14)), kg: 78.4 });
  const profile = (await db.profile.get('me'))!;
  const weighIns = await db.bodyweights.toArray();
  const training = new Set([0, 2, 4]);
  const rows: DiaryRow[] = [];
  for (let d = 0; d < 7; d++) {
    const date = dateKey(addDays(start, d));
    const t = targetsFor(date, { profile, weighIns, trainingDay: null, overrides: {}, now })!.macros;
    const protein = training.has(d) ? t.protein * 0.75 : t.protein;
    const meal = (m: DiaryRow['meal'], h: number, share: number, carbs: number): DiaryRow => ({
      id: `${date}-${m}`,
      date,
      meal: m,
      loggedAt: addDays(start, d) + h * HOUR,
      foodId: `f:${m}`,
      name: m,
      portion: { label: '1 plate', grams: 100 },
      servings: 1,
      grams: 100,
      per100g: {
        ...emptyNutrients(),
        kcal: t.kcal * share,
        protein: protein * share,
        carbs,
        fat: 30,
        vitD: 1,
      },
    });
    rows.push(meal('breakfast', 8, 0.5, 200), meal('snacks', 16, 0.5, 120));
    if (training.has(d))
      await db.sessions.add({
        id: `s${d}`,
        startedAt: addDays(start, d) + 18.5 * HOUR,
        endedAt: addDays(start, d) + 19.5 * HOUR,
        routineSessionId: 'r',
        name: 'Upper A',
        calibration: false,
        deload: false,
        plan: [],
      });
  }
  await db.diary.bulkAdd(rows);
  return start;
}

describe('F06 Food review (FR-NUT-2, FR-COACH-1/2)', () => {
  beforeEach(resetDb);

  it('FR-NUT-2: the ISO week number names the week', () => {
    expect(isoWeek(new Date(2026, 9, 19).getTime())).toBe(43);
    expect(isoWeek(new Date(2026, 0, 1).getTime())).toBe(1);
    expect(isoWeek(new Date(2027, 0, 1).getTime())).toBe(53);
  });

  it('FR-COACH-1/2: the week reads food and training together', async () => {
    const start = await seedWeek();
    const d = await loadFoodReview('week', start);
    expect(d.review.loggedDays).toBe(7);
    expect(d.review.daysOnTarget).toBe(4);
    expect(d.needsWork).toMatchObject({ id: 'protein-short-training', data: { short: 3, trainingDays: 3 } });
    expect(d.goingWell).toMatchObject({ id: 'pre-lift-carbs-good', data: { sessions: 3 } });
    expect(d.review.low[0]).toBe('vitD');
  });

  it('FR-NUT-2 / FR-COACH-2: shows days on target, the insights and a one-tap fix', async () => {
    const start = await seedWeek();
    const { router } = renderRoute('/food/review');
    expect(await screen.findByRole('heading', { name: `Week ${isoWeek(start)}` }, W)).toBeInTheDocument();
    const days = await screen.findByTestId('days-on-target', {}, W);
    expect(days).toHaveTextContent('4');
    expect(days).toHaveTextContent('/ 7');
    expect(await screen.findByText('Protein was short on 3 of 3 training days.', {}, W)).toBeInTheDocument();
    expect(screen.getByText('Carbs before all 3 workouts.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Low this week' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Section' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All nutrients' }));
    const sheet = await screen.findByRole('dialog', {}, W);
    expect(within(sheet).getByText('Vitamin D')).toBeInTheDocument();
    expect(within(sheet).getAllByText('not tracked').length).toBeGreaterThan(0);
    fireEvent.click(within(sheet).getByRole('button', { name: /close/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Fix: more protein at breakfast' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/food/add'), W);
    expect(router.state.location.search).toMatch(/suggest=/);
  });

  it('FR-NUT-2: an empty period says so; the month view and period steps work', async () => {
    await seedOnboarded();
    await db.bodyweights.add({ date: '2026-01-01', kg: 80 });
    renderRoute('/food/review');
    expect(await screen.findByText(/nothing logged in this period/i, {}, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(await screen.findByRole('button', { name: 'Weekly' }, W)).toBeInTheDocument();
    // The current month can't step forward once it has loaded.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled(), W);
  });

  it('FR-NUT-2: without a weigh-in there are no targets yet', async () => {
    await seedOnboarded();
    renderRoute('/food/review');
    expect(await screen.findByText(/add a weigh-in/i, {}, W)).toBeInTheDocument();
  });
});

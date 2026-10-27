import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from '@/db/schema';
import { saveProfile, saveWeighIn } from '@/db/repo';
import { getRawSetting } from '@/db/settings';
import { logFood } from '@/db/food';
import { emptyNutrients, type FoodItem, type Nutrients } from '@/engine/food-types';
import { dateKey } from '@/engine/week';
import { defaultPhase, targetsFor, weightOn } from './hooks';
import { mealForNow } from './format';

const W = { timeout: 8000 };
const n = (p: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...p });
const TODAY = dateKey(Date.now());
const BHURJI: FoodItem = {
  id: 'in:paneer-bhurji',
  name: 'Paneer bhurji',
  aliases: ['scrambled paneer'],
  source: 'indian',
  per100g: n({ kcal: 233, protein: 14.4, carbs: 4.4, fat: 17.7 }),
  portions: [
    { label: '1 katori', grams: 150 },
    { label: '100 g', grams: 100 },
  ],
};
const RICE: FoodItem = {
  id: 'g:1',
  name: 'Rice, white, cooked',
  aliases: [],
  source: 'generic',
  per100g: n({ kcal: 130, protein: 2.7, carbs: 28 }),
  portions: [{ label: '1 cup', grams: 158 }],
};

async function sampleProfile() {
  await seedOnboarded();
  await saveProfile({
    sex: 'male',
    birthYear: new Date().getFullYear() - 29,
    heightCm: 178,
    activity: 'light',
    diet: { phase: 'gain', rateKgPerWeek: 0.25 },
  });
  await saveWeighIn(TODAY, 78.4);
}

describe('Food targets plumbing (FR-TGT-1, FR-SHR-1)', () => {
  it('FR-SHR-1: the weigh-in on or before the date; the first one before any', () => {
    const w = [
      { date: '2026-10-10', kg: 80 },
      { date: '2026-10-20', kg: 79 },
    ];
    expect(weightOn('2026-10-25', w)).toBe(79);
    expect(weightOn('2026-10-15', w)).toBe(80);
    expect(weightOn('2026-10-01', w)).toBe(80);
    expect(weightOn('2026-10-01', [])).toBeNull();
  });

  it('FR-TGT-1: without a chosen phase, build muscle gains slowly and other goals maintain (D115)', () => {
    expect(defaultPhase('build_muscle')).toEqual({ phase: 'gain', rateKgPerWeek: 0.25 });
    expect(defaultPhase('recomp')).toEqual({ phase: 'maintain', rateKgPerWeek: 0 });
  });

  it('FR-TGT-1: targets come from the shared profile and weigh-ins; none without a weigh-in', () => {
    const profile = {
      id: 'me' as const,
      experience: 'intermediate' as const,
      goal: 'build_muscle' as const,
      daysPerWeek: 4,
      nudge: 0 as const,
      units: 'kg' as const,
      limitations: [],
      sex: 'male' as const,
      birthYear: 1997,
      heightCm: 178,
      activity: 'light' as const,
    };
    const now = new Date(2026, 9, 27).getTime();
    const t = targetsFor('2026-10-27', {
      profile,
      weighIns: [{ date: '2026-10-26', kg: 78.4 }],
      trainingDay: null,
      overrides: {},
      now,
    })!;
    expect(t.macros).toMatchObject({ kcal: 2950, protein: 140, carbs: 440, fat: 70 });
    expect(t.micros.iron.value).toBe(8);
    expect(
      targetsFor('2026-10-27', { profile, weighIns: [], trainingDay: null, overrides: {}, now }),
    ).toBeNull();
  });

  it('meal suggestion follows the time of day today, snacks otherwise', () => {
    expect(mealForNow(new Date(2026, 9, 27, 8), true)).toBe('breakfast');
    expect(mealForNow(new Date(2026, 9, 27, 13), true)).toBe('lunch');
    expect(mealForNow(new Date(2026, 9, 27, 16), true)).toBe('snacks');
    expect(mealForNow(new Date(2026, 9, 27, 20), true)).toBe('dinner');
    expect(mealForNow(new Date(2026, 9, 27, 8), false)).toBe('snacks');
  });
});

describe('Food screens (FR-NAV-2, FR-DIARY-1/2, FR-FOOD-3)', () => {
  beforeEach(resetDb);

  it('FR-NAV-2: LiftLog Home has the section switch; Food remembers itself as the last section', async () => {
    await sampleProfile();
    const { router } = renderRoute('/');
    const sw = await screen.findByRole('navigation', { name: 'Section' }, W);
    expect(within(sw).getByRole('link', { name: 'LiftLog' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(sw).getByRole('link', { name: 'Food' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/food'), W);
    await waitFor(async () => expect(await getRawSetting('lastSection')).toBe('food'), W);
    const tabs = await screen.findByRole('navigation', { name: 'Food' }, W);
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Diary', 'Review', 'Fasting']);
  });

  it('FR-DIARY-1: Diary shows calories left, macros, the quest and meals', async () => {
    await sampleProfile();
    await logFood({ date: TODAY, meal: 'lunch', food: RICE, portion: RICE.portions[0]!, servings: 1 });
    renderRoute('/food');
    expect(await screen.findByText('Left today', {}, W)).toBeInTheDocument();
    // 2,950 − 205 (1 cup of rice, 205.4 kcal rounded) = 2,745.
    expect(screen.getByText('2,745')).toBeInTheDocument();
    expect(screen.getByText('205 eaten of 2,950')).toBeInTheDocument();
    expect(screen.getByText('Quest: reach 140 g protein')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /lunch.*rice, white, cooked/i })).toHaveAttribute(
      'href',
      `/food/meal/${TODAY}/lunch`,
    );
    expect(screen.getByRole('link', { name: 'Add: Dinner' })).toHaveAttribute(
      'href',
      `/food/add?meal=dinner&date=${TODAY}`,
    );
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(await screen.findByText('Yesterday', {}, W)).toBeInTheDocument();
  });

  it('FR-DIARY-1: without a weigh-in the Diary asks for one', async () => {
    await seedOnboarded();
    renderRoute('/food');
    expect(await screen.findByText(/add a weigh-in/i, {}, W)).toBeInTheDocument();
  });

  it('FR-FOOD-3 / FR-DIARY-2: search, pick a portion, add: the entry is saved at once', async () => {
    await sampleProfile();
    await db.foodLib.bulkPut([BHURJI, RICE]);
    await db.meta.put({ key: 'foodLibVersion', value: 'test' });
    renderRoute(`/food/add?meal=dinner&date=${TODAY}`);
    expect(await screen.findByRole('heading', { name: 'Add to dinner' }, W)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search foods' }), {
      target: { value: 'paner bhurji' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add Paneer bhurji' }, W));
    const sheet = await screen.findByRole('dialog', { name: 'Paneer bhurji' }, W);
    expect(within(sheet).getByText('Indian dish · 1 katori is 150 g')).toBeInTheDocument();
    expect(within(sheet).queryByRole('radio', { name: '100 g' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: /^more/i }));
    expect(within(sheet).getByText('1.5')).toBeInTheDocument();
    expect(within(sheet).getByText('524')).toBeInTheDocument(); // 225 g × 2.33 kcal/g
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add to dinner' }));
    await waitFor(async () => expect(await db.diary.count()).toBe(1), W);
    expect((await db.diary.toArray())[0]).toMatchObject({
      meal: 'dinner',
      grams: 225,
      servings: 1.5,
      name: 'Paneer bhurji',
    });
  });

  it('FR-DIARY-2: a meal lists its items; edit changes the portion, delete removes it', async () => {
    await sampleProfile();
    await db.foodLib.bulkPut([BHURJI]);
    await logFood({ date: TODAY, meal: 'dinner', food: BHURJI, portion: BHURJI.portions[0]!, servings: 1 });
    renderRoute(`/food/meal/${TODAY}/dinner`);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Paneer bhurji' }, W));
    const sheet = await screen.findByRole('dialog', { name: 'Paneer bhurji' }, W);
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Grams' }));
    fireEvent.click(within(sheet).getByRole('button', { name: /^less/i }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await db.diary.toArray())[0]!.grams).toBe(140), W);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Paneer bhurji' }, W));
    await waitFor(async () => expect(await db.diary.count()).toBe(0), W);
    expect(await screen.findByText('Nothing logged in this meal yet.', {}, W)).toBeInTheDocument();
  });
});

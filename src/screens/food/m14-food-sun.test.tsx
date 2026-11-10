import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { applyLook } from '@/app/design';
import { dismissCelebration, useEcho } from '@/app/echo';
import { db } from '@/db/schema';
import { saveProfile, saveWeighIn } from '@/db/repo';
import { logFood } from '@/db/food';
import { putLibraryFoods } from '@/db/food-lib';
import { emptyNutrients, type FoodItem, type Nutrients } from '@/engine/food-types';
import { dateKey } from '@/engine/week';
import { logWithEcho } from './echo';
import { shiftDate } from './hooks';

const W = { timeout: 8000 };
const n = (p: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...p });
const TODAY = dateKey(Date.now());
const RICE: FoodItem = {
  id: 'g:1',
  name: 'Rice, white, cooked',
  aliases: [],
  source: 'generic',
  per100g: n({ kcal: 130, protein: 2.7, carbs: 28, fibre: 0.4 }),
  portions: [{ label: '1 cup', grams: 158 }],
};
const BHURJI: FoodItem = {
  id: 'in:paneer-bhurji',
  name: 'Paneer bhurji',
  aliases: [],
  source: 'indian',
  per100g: n({ kcal: 233, protein: 14.4, carbs: 4.4, fat: 17.7 }),
  portions: [{ label: '1 katori', grams: 150 }],
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
const logRice = (date = TODAY) =>
  logFood({ date, meal: 'lunch', food: RICE, portion: RICE.portions[0]!, servings: 1 });

/** Rising Sun look for the Food screens (M14, FR-DSN-11) and their Echo events (FR-DSN-8). */
describe('M14 Food screens in the Rising Sun look', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
    useEcho.setState({ ripples: 0, celebration: null });
    applyLook({ design: 'sun', glass: true });
  });
  afterEach(() => {
    dismissCelebration();
    applyLook({ design: 'classic', glass: true });
  });

  it('FR-DSN-11 (F01): the diary shows calories left, four bars with fibre, and the meals', async () => {
    await sampleProfile();
    await logRice();
    const { router } = renderRoute('/food');
    expect(await screen.findByRole('heading', { name: 'Food' }, W)).toBeInTheDocument();
    expect(await screen.findByText('Calories left', {}, W)).toBeInTheDocument();
    expect(screen.getByText('2,745')).toBeInTheDocument();
    expect(screen.getByText(/205 of 2,950 kcal eaten/)).toBeInTheDocument();
    for (const name of ['Protein', 'Carbs', 'Fat', 'Fibre'])
      expect(screen.getByRole('meter', { name: new RegExp(`^${name}: `) })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: /^Fibre: 1 of \d+ grams/ })).toBeInTheDocument();
    // Kept from the classic diary: section switch, quest, targets, log food, day arrows.
    expect(screen.getByRole('navigation', { name: 'Section' })).toBeInTheDocument();
    expect(screen.getByText('Quest: reach 140 g protein')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Targets' })).toHaveAttribute('href', '/food/targets');
    expect(screen.getByRole('link', { name: 'Log food' })).toHaveAttribute(
      'href',
      expect.stringContaining('/food/add?meal='),
    );
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
    expect(router.state.location.search).toBe(`?date=${shiftDate(TODAY, -1)}`);
  });

  it('FR-DSN-11 (F01): without a weigh-in the diary asks for one', async () => {
    await seedOnboarded();
    renderRoute('/food');
    expect(await screen.findByText(/add a weigh-in/i, {}, W)).toBeInTheDocument();
  });

  it('FR-DSN-11 (F02, F03) / FR-DSN-8: search, create, tabs; adding a food saves it and ripples', async () => {
    await sampleProfile();
    await putLibraryFoods([BHURJI, RICE]);
    renderRoute(`/food/add?meal=dinner&date=${TODAY}`);
    expect(await screen.findByRole('heading', { name: 'Add to dinner' }, W)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scan barcode' })).toHaveAttribute(
      'href',
      `/food/scan?meal=dinner&date=${TODAY}`,
    );
    expect(screen.getByRole('link', { name: 'Create a new food' })).toHaveAttribute(
      'href',
      `/food/new?meal=dinner&date=${TODAY}`,
    );
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'All',
      'Recent',
      'My foods',
      'Indian',
      'Brands',
    ]);
    expect(await screen.findByText(/kcal left today/, {}, W)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search foods' }), {
      target: { value: 'paneer' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add Paneer bhurji' }, W));
    const sheet = await screen.findByRole('dialog', { name: 'Paneer bhurji' }, W);
    fireEvent.click(within(sheet).getByRole('button', { name: /^more/i }));
    expect(within(sheet).getByText('1.5')).toBeInTheDocument();
    expect(within(sheet).getByText('524')).toBeInTheDocument();
    expect(within(sheet).getByRole('meter', { name: 'Protein after this' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add to dinner' }));
    await waitFor(async () => expect(await db.diary.count()).toBe(1), W);
    expect((await db.diary.toArray())[0]).toMatchObject({ meal: 'dinner', grams: 225, servings: 1.5 });
    await waitFor(() => expect(useEcho.getState().ripples).toBe(1), W);
    expect(useEcho.getState().celebration).toBeNull();
  });

  it('FR-DSN-8: a food goal reached today celebrates once; other days and classic do nothing', async () => {
    const targets = { kcal: 220, protein: 100, carbs: 40, fat: 50 };
    // 1 cup of rice: 205 kcal (93% of 220) and 44 g carbs.
    await logWithEcho(TODAY, targets, logRice);
    expect(useEcho.getState().ripples).toBe(1);
    expect(useEcho.getState().celebration).toMatchObject({
      title: 'Goal reached',
      lines: ['Calories for today', 'Carbs for today'],
    });
    dismissCelebration();
    await logWithEcho(TODAY, targets, logRice);
    expect(useEcho.getState().ripples).toBe(2);
    expect(useEcho.getState().celebration).toBeNull();

    await logWithEcho(shiftDate(TODAY, -1), targets, () => logRice(shiftDate(TODAY, -1)));
    expect(useEcho.getState().ripples).toBe(2);

    applyLook({ design: 'classic' });
    localStorage.clear();
    await resetDb();
    await logWithEcho(TODAY, targets, logRice);
    expect(await db.diary.count()).toBe(1);
    expect(useEcho.getState().ripples).toBe(2);
    expect(useEcho.getState().celebration).toBeNull();
  });

  it('FR-DSN-11 (F04): a new food is saved and logged from the card form', async () => {
    await sampleProfile();
    const { router } = renderRoute(`/food/new?meal=dinner&date=${TODAY}`);
    expect(await screen.findByRole('heading', { name: 'New food' }, W)).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Food', 'Recipe', 'Quick add']);
    fireEvent.click(screen.getByRole('button', { name: 'Save food' }));
    expect(await screen.findByText('Give the food a name.', {}, W)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Homemade dal' } });
    fireEvent.change(screen.getByLabelText(/^Serving in grams/), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText(/^Calories/), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText(/^Fibre/), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save food' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/food'), W);
    expect((await db.diary.toArray())[0]).toMatchObject({ name: 'Homemade dal', meal: 'dinner', grams: 150 });
    expect(useEcho.getState().ripples).toBe(1);
  });

  it('FR-DSN-11 (F05): targets show the calorie number, the macros with fibre, and the inputs', async () => {
    await sampleProfile();
    renderRoute('/food/targets');
    expect(await screen.findByRole('heading', { name: 'Targets' }, W)).toBeInTheDocument();
    expect(await screen.findByTestId('target-kcal', {}, W)).toHaveTextContent('2,950');
    expect(screen.getByTestId('target-reason')).toHaveTextContent(/You burn about/);
    expect(screen.getByRole('button', { name: 'Protein 140 g' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fibre.*41 g/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'More carbs on training days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to coach’s pick' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Protein 140 g' }));
    const sheet = await screen.findByRole('dialog', { name: 'Protein target' }, W);
    fireEvent.click(within(sheet).getByRole('button', { name: /^more/i }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Protein 145 g' }, W)).toHaveTextContent('edited');
  });

  it('FR-DSN-11 (F06): the review has Week and Month, a bar a day and the averages', async () => {
    await sampleProfile();
    await logRice();
    renderRoute('/food/review');
    expect(await screen.findByRole('heading', { name: 'Review' }, W)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Section' })).toBeInTheDocument();
    const period = screen.getByRole('group', { name: 'Period' });
    expect(within(period).getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(period).getByRole('button', { name: 'Month' }));
    expect(within(period).getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByTestId('days-on-target', {}, W)).toHaveTextContent(/^0 of \d+ days on target$/);
    expect(screen.getByRole('listitem', { name: /: 7% of the calorie target$/ })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem', { name: /: nothing logged$/ }).length).toBeGreaterThan(20);
    fireEvent.click(screen.getByRole('button', { name: 'All nutrients' }));
    expect(await screen.findByRole('dialog', { name: 'All nutrients' }, W)).toBeInTheDocument();
  });

  it('FR-DSN-11 (F07): fasting starts from a plan pill and shows the ring and the week', async () => {
    await sampleProfile();
    renderRoute('/food/fasting');
    expect(await screen.findByRole('heading', { name: 'Fasting' }, W)).toBeInTheDocument();
    expect(screen.getByText('No fast running.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '14:10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start fast' }));
    expect(await screen.findByTestId('fast-elapsed', {}, W)).toHaveTextContent('0:00');
    expect((await db.fasts.toArray())[0]).toMatchObject({ planHours: 14 });
    expect(screen.getByRole('meter', { name: 'Fast progress' })).toBeInTheDocument();
    expect(within(screen.getByTestId('fast-week')).getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'End fast' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('FR-DSN-11 (meal): a meal lists its items with the total; delete still works', async () => {
    await sampleProfile();
    await logRice();
    renderRoute(`/food/meal/${TODAY}/lunch`);
    expect(await screen.findByRole('heading', { name: 'Lunch' }, W)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Edit Rice, white, cooked' }, W)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Total' })).toBeInTheDocument();
    expect(screen.getByText('Protein 4 g · Carbs 44 g · Fat 0 g')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add food' })).toHaveAttribute(
      'href',
      `/food/add?meal=lunch&date=${TODAY}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rice, white, cooked' }));
    await waitFor(async () => expect(await db.diary.count()).toBe(0), W);
    expect(await screen.findByText('Nothing logged in this meal yet.', {}, W)).toBeInTheDocument();
  });
});

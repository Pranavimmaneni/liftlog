import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from '@/db/schema';
import { saveCustomFood } from '@/db/food';
import { emptyNutrients, type FoodItem } from '@/engine/food-types';
import { parseAmount, perServingTo100g } from './NewFood';
import { carryParams, displayCode, resolveScan } from './ScanLookup';

const W = { timeout: 8000 };

const type = (name: RegExp, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });

describe('New food helpers (FR-FOOD-5)', () => {
  it('FR-FOOD-5: blank is unknown (null), not zero; bad input is an error', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(' 12,5 ')).toBe(12.5);
    expect(parseAmount('abc')).toBeUndefined();
    expect(parseAmount('-1')).toBeUndefined();
  });

  it('FR-FOOD-5: per-serving label values become per 100 g', () => {
    const n = perServingTo100g({ kcal: 520, protein: 18, carbs: null }, 320);
    expect(n.kcal).toBe(162.5);
    expect(n.protein).toBe(5.63);
    expect(n.carbs).toBeNull();
    expect(n.iron).toBeNull();
  });
});

describe('barcode lookup (FR-FOOD-4)', () => {
  const yogurt: FoodItem = {
    id: 'b:1',
    name: 'Greek yogurt',
    aliases: [],
    source: 'branded',
    per100g: emptyNutrients(),
    portions: [{ label: '1 cup', grams: 227 }],
    gtin: '00012345678905',
  };
  const lookup = async (g: string) => (g === yogurt.gtin ? yogurt : undefined);

  it('FR-FOOD-4: a decoded code is padded to 14 digits and looked up', async () => {
    expect(await resolveScan('012345678905', lookup)).toEqual({
      kind: 'found',
      gtin: '00012345678905',
      food: yogurt,
    });
    expect(await resolveScan('8901234567890', lookup)).toEqual({ kind: 'missing', gtin: '08901234567890' });
    expect(await resolveScan('12', lookup)).toEqual({ kind: 'invalid' });
  });

  it('FR-FOOD-4: meal and date travel with the scan; codes show without padding', () => {
    expect(carryParams(new URLSearchParams('meal=dinner&date=2026-10-27&x=1'), { food: 'b:1' })).toBe(
      'meal=dinner&date=2026-10-27&food=b%3A1',
    );
    expect(displayCode('08901234567890')).toBe('8901234567890');
    expect(displayCode('00000012345670')).toBe('12345670');
  });
});

describe('F04 New food (FR-FOOD-4, FR-FOOD-5)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedOnboarded();
  });

  it('FR-FOOD-5: saves a food from its label, per 100 g, with empty fields unknown', async () => {
    renderRoute('/food/new?name=Mom%27s%20rajma%20chawal');
    expect(await screen.findByRole('heading', { name: 'New food' }, W)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^name/i })).toHaveValue("Mom's rajma chawal");
    fireEvent.click(screen.getByRole('button', { name: 'Save food' }));
    expect(await screen.findByText('Enter the serving weight in grams.', {}, W)).toBeInTheDocument();
    expect(screen.getByText('Enter the calories.')).toBeInTheDocument();
    type(/^serving name/i, '1 plate');
    type(/^serving in grams/i, '320');
    type(/^calories/i, '520');
    type(/^protein/i, '18');
    fireEvent.click(screen.getByRole('button', { name: 'Save food' }));
    await waitFor(async () => expect(await db.foods.count()).toBe(1), W);
    const f = (await db.foods.toArray())[0]!;
    expect(f).toMatchObject({
      name: "Mom's rajma chawal",
      isRecipe: 0,
      portions: [{ label: '1 plate', grams: 320 }],
    });
    expect(f.per100g.kcal).toBe(162.5);
    expect(f.per100g.protein).toBe(5.63);
    expect(f.per100g.carbs).toBeNull();
    expect(await db.diary.count()).toBe(0);
  });

  it('FR-FOOD-4: a scanned barcode is stored, and with a meal the food is logged once', async () => {
    const { router } = renderRoute('/food/new?barcode=8901234567890&meal=dinner&date=2026-10-27');
    expect(await screen.findByRole('textbox', { name: /^barcode/i }, W)).toHaveValue('8901234567890');
    type(/^name/i, 'Haldiram bhujia');
    type(/^serving in grams/i, '30');
    type(/^calories/i, '165');
    fireEvent.click(screen.getByRole('button', { name: 'Save food' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/food'), W);
    const f = (await db.foods.toArray())[0]!;
    expect(f.gtin).toBe('08901234567890');
    expect(await db.diary.toArray()).toEqual([
      expect.objectContaining({ foodId: f.id, meal: 'dinner', date: '2026-10-27', grams: 30, servings: 1 }),
    ]);
  });

  it('FR-FOOD-5: quick add logs calories and macros into the meal', async () => {
    const { router } = renderRoute('/food/new?tab=quick&meal=lunch&date=2026-10-27');
    expect(await screen.findByRole('tab', { name: 'Quick add', selected: true }, W)).toBeInTheDocument();
    type(/^name/i, 'Office samosa');
    type(/^calories/i, '260');
    type(/^carbs/i, '30');
    fireEvent.click(screen.getByRole('button', { name: 'Save food' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/food'), W);
    const [e] = await db.diary.toArray();
    expect(e).toMatchObject({ name: 'Office samosa', meal: 'lunch', date: '2026-10-27' });
    expect(e!.per100g).toMatchObject({ kcal: 260, carbs: 30, protein: null });
  });

  it('FR-FOOD-5: a recipe saves its ingredients and cooked yield', async () => {
    await saveCustomFood({
      name: 'Toor dal, dry',
      portions: [{ label: '100 g', grams: 100 }],
      per100g: { ...emptyNutrients(), kcal: 350, protein: 22 },
    });
    renderRoute('/food/new?tab=recipe');
    expect(await screen.findByRole('tab', { name: 'Recipe', selected: true }, W)).toBeInTheDocument();
    type(/^name/i, 'Dal tadka');
    fireEvent.click(await screen.findByRole('button', { name: 'Add ingredient' }, W));
    const sheet = await screen.findByRole('dialog', {}, W);
    fireEvent.change(within(sheet).getByRole('searchbox', { name: 'Search ingredients' }), {
      target: { value: 'toor' },
    });
    fireEvent.click(await within(sheet).findByRole('button', { name: /toor dal, dry/i }, W));
    expect(await screen.findByRole('textbox', { name: /^grams of toor dal, dry/i }, W)).toHaveValue('100');
    type(/^cooked weight/i, '320');
    // 100 g of dal at 350 kcal per 100 g, one serving.
    expect(screen.getByText('350 kcal per serving')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save food' }));
    await waitFor(async () => expect(await db.foods.where('isRecipe').equals(1).count()).toBe(1), W);
    const r = await db.foods.where('isRecipe').equals(1).first();
    expect(r).toMatchObject({ name: 'Dal tadka', yieldGrams: 320, ingredients: [{ grams: 100 }] });
    expect(r!.per100g.kcal).toBeCloseTo(109.375);
  });
});

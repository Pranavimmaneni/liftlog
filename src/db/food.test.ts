import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/render';
import { db } from './schema';
import {
  copyEntries,
  customFoods,
  deleteCustomFood,
  deleteEntry,
  entriesBetween,
  entriesFor,
  findByGtin,
  frequentFoodIds,
  getFood,
  logFood,
  logSavedMeal,
  quickAdd,
  recentFoodIds,
  saveCustomFood,
  saveMeal,
  saveRecipe,
  updateEntry,
} from './food';
import { activeFast, editFast, endFast, fastsSince, startFast } from './fasting';
import { chunkToRows, importLibrary, type LibraryManifest } from './food-lib';
import {
  emptyNutrients,
  encodeRow,
  NUTRIENTS,
  type FoodChunk,
  type FoodItem,
  type Nutrients,
} from '@/engine/food-types';

const n = (p: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...p });
const PANEER: FoodItem = {
  id: 'in:paneer-bhurji',
  name: 'Paneer bhurji',
  aliases: ['scrambled paneer'],
  source: 'indian',
  per100g: n({ kcal: 193, protein: 12, carbs: 6, fat: 14 }),
  portions: [{ label: '1 katori', grams: 150 }],
};
const T0 = new Date(2026, 9, 27, 19, 40).getTime();

describe('food diary (FR-DIARY-1..3)', () => {
  beforeEach(resetDb);

  it('FR-DIARY-2: every entry is stored at once with grams and a nutrient snapshot', async () => {
    const e = await logFood({
      date: '2026-10-27',
      meal: 'dinner',
      food: PANEER,
      portion: PANEER.portions[0]!,
      servings: 1.5,
      now: T0,
    });
    expect(e.grams).toBe(225);
    expect(await db.diary.get(e.id)).toEqual(e);
    // Changing the food later never rewrites the logged day.
    PANEER.per100g.kcal = 999;
    expect((await db.diary.get(e.id))!.per100g.kcal).toBe(193);
    PANEER.per100g.kcal = 193;
  });

  it('FR-DIARY-2: edits recompute grams; deletes remove the entry', async () => {
    const e = await logFood({
      date: '2026-10-27',
      meal: 'dinner',
      food: PANEER,
      portion: PANEER.portions[0]!,
      servings: 1,
      now: T0,
    });
    await updateEntry(e.id, { servings: 2, meal: 'snacks' });
    expect(await db.diary.get(e.id)).toMatchObject({ servings: 2, grams: 300, meal: 'snacks' });
    await updateEntry('missing', { servings: 3 });
    await deleteEntry(e.id);
    expect(await db.diary.count()).toBe(0);
  });

  it('FR-FOOD-5: quick add stores calories and macros only', async () => {
    const e = await quickAdd({
      date: '2026-10-27',
      meal: 'snacks',
      name: 'Office samosa',
      kcal: 260,
      carbs: 30,
      now: T0,
    });
    expect(e.per100g).toMatchObject({ kcal: 260, carbs: 30, protein: null, iron: null });
    expect(e.grams).toBe(100);
    expect(e.foodId.startsWith('q:')).toBe(true);
  });

  it('FR-DIARY-3: copy a meal or a whole day; read by date and range', async () => {
    await logFood({
      date: '2026-10-26',
      meal: 'lunch',
      food: PANEER,
      portion: PANEER.portions[0]!,
      servings: 1,
      now: T0 - 86_400_000,
    });
    await quickAdd({ date: '2026-10-26', meal: 'breakfast', name: 'Poha', kcal: 250, now: T0 - 86_000_000 });
    expect(
      await copyEntries({
        fromDate: '2026-10-26',
        toDate: '2026-10-27',
        meal: 'lunch',
        toMeal: 'dinner',
        now: T0,
      }),
    ).toBe(1);
    expect((await entriesFor('2026-10-27')).map((e) => e.meal)).toEqual(['dinner']);
    expect(await copyEntries({ fromDate: '2026-10-26', toDate: '2026-10-28', now: T0 })).toBe(2);
    expect(await entriesBetween('2026-10-26', '2026-10-28')).toHaveLength(3);
  });

  it('FR-DIARY-3: saved meals log again; foods that are gone are skipped', async () => {
    const own = await saveCustomFood({
      name: 'Mom’s rajma',
      portions: [{ label: '1 plate', grams: 320 }],
      per100g: n({ kcal: 160 }),
    });
    const a = await logFood({
      date: '2026-10-26',
      meal: 'lunch',
      food: own,
      portion: own.portions[0]!,
      servings: 1,
      now: T0,
    });
    const ghost = { ...a, foodId: 'g:gone' };
    const meal = await saveMeal('Sunday lunch', [a, ghost], T0);
    expect(await logSavedMeal(meal.id, '2026-10-27', 'lunch', T0)).toEqual({ logged: 1, missing: 1 });
    expect(await logSavedMeal('nope', '2026-10-27', 'lunch')).toEqual({ logged: 0, missing: 0 });
  });

  it('FR-FOOD-3: recent and frequent foods for search ranking', async () => {
    const rice = { ...PANEER, id: 'g:rice', name: 'Rice' };
    await logFood({
      date: '2026-10-25',
      meal: 'lunch',
      food: rice,
      portion: rice.portions[0]!,
      servings: 1,
      now: T0 - 2,
    });
    await logFood({
      date: '2026-10-26',
      meal: 'lunch',
      food: rice,
      portion: rice.portions[0]!,
      servings: 1,
      now: T0 - 1,
    });
    await logFood({
      date: '2026-10-27',
      meal: 'dinner',
      food: PANEER,
      portion: PANEER.portions[0]!,
      servings: 1,
      now: T0,
    });
    await quickAdd({ date: '2026-10-27', meal: 'snacks', name: 'x', kcal: 1, now: T0 + 1 });
    expect(await frequentFoodIds('2026-10-27')).toEqual(['g:rice', 'in:paneer-bhurji']);
    expect(await recentFoodIds()).toEqual(['in:paneer-bhurji', 'g:rice']);
  });
});

describe('own foods and recipes (FR-FOOD-4, FR-FOOD-5)', () => {
  beforeEach(resetDb);

  it('FR-FOOD-5: own foods get search terms; deleting keeps them resolvable for history', async () => {
    const f = await saveCustomFood({
      name: ' Mom’s rajma chawal ',
      brand: 'Home',
      portions: [],
      per100g: n({ kcal: 162 }),
    });
    expect(f.name).toBe('Mom’s rajma chawal');
    expect(f.portions).toEqual([{ label: '100 g', grams: 100 }]);
    expect(f.terms).toEqual(expect.arrayContaining(['moms', 'rajma', 'chawal', 'home']));
    const again = await saveCustomFood(
      { name: 'Rajma chawal', portions: [], per100g: n({ kcal: 150 }) },
      f.id,
      T0,
    );
    expect(again.createdAt).toBe(f.createdAt);
    await deleteCustomFood(f.id);
    expect(await customFoods()).toEqual([]);
    expect((await getFood(f.id))?.name).toBe('Rajma chawal');
  });

  it('FR-FOOD-5: a recipe computes per-100 g from ingredients and yield', async () => {
    const dal = { ...PANEER, id: 'g:dal', per100g: n({ kcal: 350, protein: 24 }) };
    const water = { ...PANEER, id: 'g:water', per100g: n({ kcal: 0, protein: 0 }) };
    const r = await saveRecipe({
      name: 'Dal tadka',
      ingredients: [
        { food: dal, grams: 100 },
        { food: water, grams: 300 },
      ],
      yieldGrams: 320,
      portions: [],
    });
    expect(r.isRecipe).toBe(1);
    expect(r.per100g.kcal).toBeCloseTo(109.375);
    expect(r.portions).toEqual([{ label: 'whole recipe', grams: 320 }]);
    expect(r.ingredients).toEqual([
      { foodId: 'g:dal', grams: 100 },
      { foodId: 'g:water', grams: 300 },
    ]);
  });

  it('FR-FOOD-4: a barcode finds own foods first, then the library, as 14 digits', async () => {
    await db.foodLib.add({ ...PANEER, id: 'b:1', name: 'Library yogurt', gtin: '00012345678905' });
    expect((await findByGtin('012345678905'))?.id).toBe('b:1');
    const own = await saveCustomFood({
      name: 'My yogurt',
      barcode: '12345678905',
      portions: [],
      per100g: n({}),
    });
    expect((await findByGtin('0012345678905'))?.id).toBe(own.id);
    expect(await findByGtin('12')).toBeUndefined();
  });
});

describe('fasts (FR-FAST-1)', () => {
  beforeEach(resetDb);

  it('FR-FAST-1: one open fast; end and edit times; an end before the start is refused', async () => {
    const f = await startFast(16, T0);
    expect(await startFast(18, T0 + 1)).toEqual(f);
    expect(await activeFast()).toEqual(f);
    await endFast(f.id, T0 + 16 * 3_600_000);
    expect(await activeFast()).toBeUndefined();
    expect(await editFast(f.id, { endedAt: T0 - 1 })).toBe(false);
    expect(await editFast(f.id, { startedAt: T0 - 3_600_000 })).toBe(true);
    expect(await editFast('missing', {})).toBe(false);
    expect((await fastsSince(T0 - 7_200_000)).map((x) => x.id)).toEqual([f.id]);
  });
});

describe('food library import (FR-FOOD-2, NFR-OFF-3)', () => {
  beforeEach(resetDb);

  const chunk: FoodChunk = {
    v: '2026-10-27.1',
    source: 'indian',
    nutrients: [...NUTRIENTS],
    foods: [encodeRow(PANEER)],
  };
  const manifest: LibraryManifest = {
    v: '2026-10-27.1',
    chunks: [{ file: 'foods-indian.json', source: 'indian', count: 1 }],
  };

  it('FR-FOOD-2: decodes chunks with search terms', () => {
    expect(chunkToRows(chunk)[0]).toEqual(PANEER);
  });

  it('FR-FOOD-2: imports once per version and replaces old rows', async () => {
    let loads = 0;
    const load = async () => {
      loads++;
      return chunk;
    };
    expect(await importLibrary({ manifest: null })).toBe('no-library');
    await db.foodLib.add({ ...PANEER, id: 'g:old' });
    expect(await importLibrary({ manifest, load })).toBe('imported');
    expect(await db.foodLib.toCollection().primaryKeys()).toEqual(['in:paneer-bhurji']);
    expect(await importLibrary({ manifest, load })).toBe('up-to-date');
    expect(loads).toBe(1);
    expect(await importLibrary({ manifest: { ...manifest, v: '2026-11-01.1' }, load })).toBe('imported');
    expect(loads).toBe(2);
  });
});

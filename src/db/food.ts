import { db } from './schema';
import { uid } from './ids';
import type { CustomFoodRow, DiaryRow, FoodLibRow, MealSlot, SavedMealRow } from './types';
import {
  emptyNutrients,
  normalizeGtin,
  type FoodItem,
  type Nutrients,
  type Portion,
} from '@/engine/food-types';
import { recipePer100g } from '@/engine/nutrition';
import { foodTerms } from '@/engine/food-search';

/**
 * Food diary and the user's own foods (PRD-1.2 FR-DIARY-1..3, FR-FOOD-4/5). Like sets (FR-WRK-13),
 * every entry is written the moment it's logged. Entries keep a nutrient snapshot, so editing or
 * re-importing a food never rewrites past days.
 */

export function withTerms<T extends FoodItem>(f: T): T & { terms: string[] } {
  return { ...f, terms: foodTerms(f) };
}

/** A food by id: the user's own first, then the library. Deleted own foods still resolve (history). */
export async function getFood(id: string): Promise<FoodItem | undefined> {
  return (await db.foods.get(id)) ?? (await db.foodLib.get(id));
}

/** FR-FOOD-4: a scanned barcode, matched as 14 digits; own foods win. */
export async function findByGtin(code: string): Promise<FoodItem | undefined> {
  const gtin = normalizeGtin(code);
  if (!gtin) return undefined;
  const own = (await db.foods.where('gtin').equals(gtin).toArray()).find((f) => !f.deletedAt);
  return own ?? (await db.foodLib.where('gtin').equals(gtin).first());
}

// ---------- diary ----------

export async function logFood(input: {
  date: string;
  meal: MealSlot;
  food: FoodItem;
  portion: Portion;
  servings: number;
  now?: number;
}): Promise<DiaryRow> {
  const row: DiaryRow = {
    id: uid(),
    date: input.date,
    meal: input.meal,
    loggedAt: input.now ?? Date.now(),
    foodId: input.food.id,
    name: input.food.name,
    ...(input.food.brand ? { brand: input.food.brand } : {}),
    portion: { ...input.portion },
    servings: input.servings,
    grams: input.portion.grams * input.servings,
    per100g: { ...input.food.per100g },
  };
  await db.diary.add(row);
  return row;
}

/** FR-FOOD-5 quick add: calories and macros only, logged as one entry of 100 "g" holding them. */
export async function quickAdd(input: {
  date: string;
  meal: MealSlot;
  name: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  now?: number;
}): Promise<DiaryRow> {
  const per100g: Nutrients = {
    ...emptyNutrients(),
    kcal: input.kcal,
    protein: input.protein ?? null,
    carbs: input.carbs ?? null,
    fat: input.fat ?? null,
  };
  return logFood({
    date: input.date,
    meal: input.meal,
    food: { id: `q:${uid()}`, name: input.name, aliases: [], source: 'custom', per100g, portions: [] },
    portion: { label: '1 entry', grams: 100 },
    servings: 1,
    now: input.now,
  });
}

export async function updateEntry(
  id: string,
  patch: Partial<Pick<DiaryRow, 'portion' | 'servings' | 'meal' | 'date'>>,
): Promise<void> {
  const cur = await db.diary.get(id);
  if (!cur) return;
  const next = { ...cur, ...patch };
  next.grams = next.portion.grams * next.servings;
  await db.diary.put(next);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.diary.delete(id);
}

export async function entriesFor(date: string): Promise<DiaryRow[]> {
  return (await db.diary.where('date').equals(date).toArray()).sort((a, b) => a.loggedAt - b.loggedAt);
}

/** Entries with from ≤ date < to (local 'YYYY-MM-DD' keys). */
export async function entriesBetween(from: string, to: string): Promise<DiaryRow[]> {
  return db.diary.where('date').between(from, to, true, false).toArray();
}

/** FR-DIARY-3: copy a meal (or, without `meal`, the whole day) to another date. */
export async function copyEntries(input: {
  fromDate: string;
  toDate: string;
  meal?: MealSlot;
  toMeal?: MealSlot;
  now?: number;
}): Promise<number> {
  const src = (await entriesFor(input.fromDate)).filter((e) => !input.meal || e.meal === input.meal);
  const now = input.now ?? Date.now();
  const rows = src.map((e, i) => ({
    ...e,
    id: uid(),
    date: input.toDate,
    meal: input.toMeal ?? e.meal,
    loggedAt: now + i,
  }));
  if (rows.length) await db.diary.bulkAdd(rows);
  return rows.length;
}

// ---------- saved meals ----------

export async function saveMeal(name: string, entries: DiaryRow[], now = Date.now()): Promise<SavedMealRow> {
  const row: SavedMealRow = {
    id: uid(),
    name,
    items: entries.map((e) => ({ foodId: e.foodId, portion: e.portion, servings: e.servings })),
    createdAt: now,
  };
  await db.savedMeals.add(row);
  return row;
}

/** Logs a saved meal; foods that no longer exist are skipped and counted. */
export async function logSavedMeal(
  id: string,
  date: string,
  meal: MealSlot,
  now = Date.now(),
): Promise<{ logged: number; missing: number }> {
  const saved = await db.savedMeals.get(id);
  if (!saved) return { logged: 0, missing: 0 };
  let logged = 0;
  let missing = 0;
  for (const [i, item] of saved.items.entries()) {
    const food = await getFood(item.foodId);
    if (!food) {
      missing++;
      continue;
    }
    await logFood({ date, meal, food, portion: item.portion, servings: item.servings, now: now + i });
    logged++;
  }
  return { logged, missing };
}

// ---------- the user's own foods ----------

export interface CustomFoodInput {
  name: string;
  brand?: string;
  barcode?: string;
  portions: Portion[];
  per100g: Nutrients;
}

export interface RecipeInput {
  name: string;
  ingredients: { food: FoodItem; grams: number }[];
  /** Cooked weight of the whole recipe; defaults to the raw total. */
  yieldGrams?: number;
  portions: Portion[];
}

function baseRow(name: string, id: string | undefined, now: number) {
  return {
    id: id ?? `c:${uid()}`,
    name: name.trim(),
    aliases: [],
    source: 'custom' as const,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveCustomFood(
  input: CustomFoodInput,
  id?: string,
  now = Date.now(),
): Promise<CustomFoodRow> {
  const prev = id ? await db.foods.get(id) : undefined;
  const gtin = input.barcode ? normalizeGtin(input.barcode) : null;
  const row: CustomFoodRow = withTerms({
    ...baseRow(input.name, id, now),
    ...(prev ? { createdAt: prev.createdAt } : {}),
    ...(input.brand ? { brand: input.brand.trim() } : {}),
    ...(gtin ? { gtin } : {}),
    per100g: { ...input.per100g },
    portions: input.portions.length ? input.portions : [{ label: '100 g', grams: 100 }],
    isRecipe: 0 as const,
  });
  await db.foods.put(row);
  return row;
}

/** FR-FOOD-5: a recipe's per-100 g values come from its ingredients and cooked yield. */
export async function saveRecipe(input: RecipeInput, id?: string, now = Date.now()): Promise<CustomFoodRow> {
  const prev = id ? await db.foods.get(id) : undefined;
  const per100g = recipePer100g(
    input.ingredients.map((i) => ({ per100g: i.food.per100g, grams: i.grams })),
    input.yieldGrams,
  );
  const total = input.yieldGrams ?? input.ingredients.reduce((n, i) => n + i.grams, 0);
  const row: CustomFoodRow = withTerms({
    ...baseRow(input.name, id, now),
    ...(prev ? { createdAt: prev.createdAt } : {}),
    per100g,
    portions: input.portions.length ? input.portions : [{ label: 'whole recipe', grams: total }],
    isRecipe: 1 as const,
    ingredients: input.ingredients.map((i) => ({ foodId: i.food.id, grams: i.grams })),
    ...(input.yieldGrams ? { yieldGrams: input.yieldGrams } : {}),
  });
  await db.foods.put(row);
  return row;
}

/** Soft delete: the food leaves search, but past diary entries keep their snapshot and name. */
export async function deleteCustomFood(id: string, now = Date.now()): Promise<void> {
  await db.foods.update(id, { deletedAt: now });
}

export async function customFoods(): Promise<CustomFoodRow[]> {
  return (await db.foods.toArray()).filter((f) => !f.deletedAt);
}

// ---------- recent and frequent (search ranking, FR-FOOD-3) ----------

/** Food ids by how often they were logged in the last `days` days, most first. */
export async function frequentFoodIds(today: string, days = 28, limit = 50): Promise<string[]> {
  const from = new Date(`${today}T12:00:00`);
  from.setDate(from.getDate() - days);
  const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  const counts = new Map<string, number>();
  for (const e of await db.diary.where('date').aboveOrEqual(fromKey).toArray())
    if (!e.foodId.startsWith('q:')) counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

/** Most recently logged distinct foods. */
export async function recentFoodIds(limit = 20): Promise<string[]> {
  const out: string[] = [];
  await db.diary
    .orderBy('loggedAt')
    .reverse()
    .until(() => out.length >= limit)
    .each((e) => {
      if (!e.foodId.startsWith('q:') && !out.includes(e.foodId)) out.push(e.foodId);
    });
  return out;
}

export type { FoodLibRow };

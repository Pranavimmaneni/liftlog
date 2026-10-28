/**
 * FR-FOOD-6: Indian dishes computed from standard recipes (data/indian-dishes.json): per 100 g =
 * the sum of the ingredients' nutrients ÷ the cooked yield. FR-FOOD-7: portions come from the dish
 * or from data/food-portions.json by kind.
 */
import {
  NUTRIENTS,
  emptyNutrients,
  type FoodItem,
  type Nutrients,
  type Portion,
} from '../../src/engine/food-types';
import { roundNutrients, sortFoods } from './common';

export interface IngredientRef {
  sr?: number;
  fndds?: number;
}

export interface Dish {
  slug: string;
  name: string;
  aliases: string[];
  kind: string;
  recipe: [string, number][];
  serve?: [string, number][];
  loss?: number;
}

export interface DishFile {
  lossByKind: Record<string, number>;
  ingredients: Record<string, IngredientRef>;
  dishes: Dish[];
}

export interface PortionFile {
  units: Record<string, { label: string; grams: number }>;
  defaultsByKind: Record<string, string[]>;
}

/**
 * A nutrient that some ingredients don't list counts as known when the ingredients that do list it
 * make up at least this share of the recipe's non-water weight (spices often lack vitamin D or B12).
 */
export const KNOWN_SHARE = 0.9;

export function dishYield(d: Dish, lossByKind: Record<string, number>): number {
  const total = d.recipe.reduce((s, [, g]) => s + g, 0);
  const loss = d.loss ?? lossByKind[d.kind] ?? 0;
  return total * (1 - loss);
}

/** FR-FOOD-6: per-100 g nutrients of a recipe; `per100g(key)` gives an ingredient's per-100 g values. */
export function recipeNutrients(
  d: Dish,
  lossByKind: Record<string, number>,
  per100g: (key: string) => Nutrients | null,
): Nutrients {
  const yieldG = dishYield(d, lossByKind);
  const out = emptyNutrients();
  const solids = d.recipe.filter(([k]) => k !== 'water');
  const solidMass = solids.reduce((s, [, g]) => s + g, 0);
  for (const n of NUTRIENTS) {
    let sum = 0;
    let knownMass = 0;
    for (const [k, g] of solids) {
      const v = per100g(k)?.[n];
      if (v === null || v === undefined) continue;
      sum += (v * g) / 100;
      knownMass += g;
    }
    out[n] =
      solidMass > 0 && knownMass / solidMass >= KNOWN_SHARE && yieldG > 0 ? (sum / yieldG) * 100 : null;
  }
  return roundNutrients(out);
}

/** FR-FOOD-7: the dish's own servings, else the defaults for its kind; "100 g" always last. */
export function dishPortions(d: Dish, portions: PortionFile): Portion[] {
  const own = d.serve?.map(([label, grams]) => ({ label, grams }));
  const byKind = (portions.defaultsByKind[d.kind] ?? [])
    .filter((u) => u !== 'piece')
    .map((u) => portions.units[u])
    .filter((u): u is { label: string; grams: number } => !!u)
    .map((u) => ({ label: u.label, grams: u.grams }));
  const list = own?.length ? own : byKind;
  return [...list, { label: '100 g', grams: 100 }];
}

export function buildIndian(
  file: DishFile,
  portions: PortionFile,
  ingredient: (ref: IngredientRef) => Nutrients | null,
): { foods: FoodItem[]; missing: string[] } {
  const missing = new Set<string>();
  const cache = new Map<string, Nutrients | null>();
  const per100g = (key: string): Nutrients | null => {
    if (key === 'water') return null;
    if (!cache.has(key)) {
      const ref = file.ingredients[key];
      const n = ref ? ingredient(ref) : null;
      if (!n) missing.add(key);
      cache.set(key, n);
    }
    return cache.get(key) ?? null;
  };
  const foods = file.dishes.map((d) => ({
    id: `in:${d.slug}`,
    name: d.name,
    aliases: d.aliases,
    source: 'indian' as const,
    per100g: recipeNutrients(d, file.lossByKind, per100g),
    portions: dishPortions(d, portions),
    category: `Indian dish · ${d.kind}`,
  }));
  return { foods: sortFoods(foods), missing: [...missing].sort() };
}

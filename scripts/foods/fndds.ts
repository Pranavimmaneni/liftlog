/**
 * FR-FOOD-1: generic foods from USDA FNDDS 2021–2023 ("as eaten" foods with household portions).
 */
import type { FoodItem, Portion } from '../../src/engine/food-types';
import { dropCounter, hasCore, pickNutrients, sortFoods, type DropCounter } from './common';

export interface FdcFoodNutrient {
  nutrient: { id: number };
  amount?: number;
}
export interface FdcPortion {
  portionDescription?: string;
  modifier?: string;
  gramWeight?: number;
  sequenceNumber?: number;
  amount?: number;
  measureUnit?: { name?: string };
}
export interface FdcFood {
  fdcId: number;
  description: string;
  foodNutrients: FdcFoodNutrient[];
  foodPortions?: FdcPortion[];
  wweiaFoodCategory?: { wweiaFoodCategoryDescription?: string };
  foodCategory?: { description?: string };
}

/** Categories that aren't food a lifter logs (FNDDS has baby food and formula). */
export const SKIP_CATEGORIES = [/^Baby food/i, /^Infant formula/i, /^Human milk/i];

/** FNDDS portions: drop "Quantity not specified" (modifier 90000) and zero-gram rows; keep source order. */
export function fnddsPortions(portions: FdcPortion[] = []): Portion[] {
  const out: Portion[] = [];
  const seen = new Set<string>();
  for (const p of [...portions].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0))) {
    const label = (p.portionDescription ?? '').trim();
    const grams = p.gramWeight ?? 0;
    if (!label || grams <= 0 || p.modifier === '90000' || /quantity not specified/i.test(label)) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, grams: Math.round(grams * 10) / 10 });
  }
  return out.length ? out : [{ label: '100 g', grams: 100 }];
}

export function fnddsFood(f: FdcFood): FoodItem {
  return {
    id: `g:${f.fdcId}`,
    name: f.description.trim(),
    aliases: [],
    source: 'generic',
    per100g: pickNutrients(f.foodNutrients.map((n) => [n.nutrient.id, n.amount ?? NaN])),
    portions: fnddsPortions(f.foodPortions),
    category: f.wweiaFoodCategory?.wweiaFoodCategoryDescription ?? undefined,
  };
}

export function buildGeneric(foods: FdcFood[], drops: DropCounter = dropCounter()): FoodItem[] {
  const out: FoodItem[] = [];
  for (const f of foods) {
    const cat = f.wweiaFoodCategory?.wweiaFoodCategoryDescription ?? '';
    if (SKIP_CATEGORIES.some((r) => r.test(cat))) {
      drops.add(`category skipped: ${cat}`);
      continue;
    }
    const item = fnddsFood(f);
    if (!hasCore(item.per100g)) {
      drops.add('missing kcal, protein, carbs or fat');
      continue;
    }
    out.push(item);
  }
  return sortFoods(out);
}

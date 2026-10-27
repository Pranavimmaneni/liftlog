/**
 * Nutrient maths for the Food section (PRD-1.2 FR-DIARY-2, FR-FOOD-5). Values are per 100 g;
 * `null` is unknown and stays unknown: a total is only as known as its parts.
 */
import { emptyNutrients, NUTRIENTS, type NutrientKey, type Nutrients, type Portion } from './food-types';

export interface Measured {
  per100g: Nutrients;
  grams: number;
}

/** FR-DIARY-2: nutrients in `grams` of a food. */
export function scale(per100g: Nutrients, grams: number): Nutrients {
  const out = emptyNutrients();
  for (const k of NUTRIENTS) {
    const v = per100g[k];
    out[k] = v === null ? null : (v * grams) / 100;
  }
  return out;
}

export function portionGrams(portion: Portion, servings: number): number {
  return portion.grams * servings;
}

export interface Totals {
  total: Nutrients;
  /** How many of the items had a value for each nutrient (the rest are unknown). */
  known: Record<NutrientKey, number>;
  items: number;
}

/**
 * Sums items. A nutrient no item knows stays `null`; a partly known one sums what is known and
 * `known[k] < items` says so, so reviews can tell "low" from "not on the label".
 */
export function sumNutrients(items: Measured[]): Totals {
  const total = emptyNutrients();
  const known = Object.fromEntries(NUTRIENTS.map((k) => [k, 0])) as Record<NutrientKey, number>;
  for (const it of items) {
    for (const k of NUTRIENTS) {
      const v = it.per100g[k];
      if (v === null) continue;
      total[k] = (total[k] ?? 0) + (v * it.grams) / 100;
      known[k]++;
    }
  }
  return { total, known, items: items.length };
}

/**
 * FR-FOOD-5 / FR-FOOD-6: per-100 g values of a recipe from its ingredients and cooked yield (water
 * lost or gained in cooking changes the weight, not the nutrients). A nutrient any ingredient lacks
 * is unknown for the whole recipe.
 */
export function recipePer100g(ingredients: Measured[], yieldGrams?: number): Nutrients {
  const out = emptyNutrients();
  const raw = ingredients.reduce((n, i) => n + i.grams, 0);
  const weight = yieldGrams && yieldGrams > 0 ? yieldGrams : raw;
  if (!ingredients.length || weight <= 0) return out;
  for (const k of NUTRIENTS) {
    if (ingredients.some((i) => i.grams > 0 && i.per100g[k] === null)) continue;
    const sum = ingredients.reduce((n, i) => n + ((i.per100g[k] ?? 0) * i.grams) / 100, 0);
    out[k] = (sum / weight) * 100;
  }
  return out;
}

/** Energy implied by the macros (4/4/9 kcal per g); used when a label gives macros but no kcal. */
export function kcalFromMacros(n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>): number | null {
  if (n.protein === null || n.carbs === null || n.fat === null) return null;
  return n.protein * 4 + n.carbs * 4 + n.fat * 9;
}

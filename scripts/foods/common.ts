/**
 * Helpers shared by the food library builders (FR-FOOD-1). Pure functions only.
 */
import {
  NUTRIENTS,
  emptyNutrients,
  type FoodItem,
  type NutrientKey,
  type Nutrients,
} from '../../src/engine/food-types';

/** USDA FoodData Central nutrient ids for the app's nutrient set (units match food-types.ts). */
export const FDC_NUTRIENT_IDS: Record<NutrientKey, number[]> = {
  kcal: [1008, 2047, 2048], // Energy kcal; Atwater general / specific as fallbacks (branded)
  protein: [1003],
  carbs: [1005],
  fat: [1004],
  fibre: [1079],
  sugars: [2000],
  satFat: [1258],
  sodium: [1093],
  potassium: [1092],
  calcium: [1087],
  iron: [1089],
  magnesium: [1090],
  vitD: [1114],
  b12: [1178],
};

/** Decimal places kept per nutrient: enough for the app, small for the download. */
export const DECIMALS: Record<NutrientKey, number> = {
  kcal: 0,
  protein: 1,
  carbs: 1,
  fat: 1,
  fibre: 1,
  sugars: 1,
  satFat: 1,
  sodium: 0,
  potassium: 0,
  calcium: 0,
  iron: 2,
  magnesium: 0,
  vitD: 2,
  b12: 2,
};

export function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

export function roundNutrients(n: Nutrients): Nutrients {
  const out = emptyNutrients();
  for (const k of NUTRIENTS) {
    const v = n[k];
    out[k] = v === null || !Number.isFinite(v) ? null : round(v, DECIMALS[k]);
  }
  return out;
}

/**
 * Picks the app's nutrients from FDC `{ id, amount }` pairs. A nutrient the source doesn't list stays
 * `null` (unknown), never 0. For kcal the first id in FDC_NUTRIENT_IDS that is present wins.
 */
export function pickNutrients(pairs: Iterable<[number, number]>): Nutrients {
  const byId = new Map<number, number>();
  for (const [id, amount] of pairs) if (Number.isFinite(amount) && !byId.has(id)) byId.set(id, amount);
  const out = emptyNutrients();
  for (const k of NUTRIENTS) {
    for (const id of FDC_NUTRIENT_IDS[k]) {
      const v = byId.get(id);
      if (v !== undefined) {
        out[k] = v;
        break;
      }
    }
  }
  return roundNutrients(out);
}

export function hasCore(n: Nutrients): boolean {
  return n.kcal !== null && n.protein !== null && n.carbs !== null && n.fat !== null;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Title-ish case for ALL-CAPS label names ("GREEK YOGURT" → "Greek Yogurt"); mixed case is kept. */
export function tidyName(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .replace(/(^|[\s\-/(&.,])([a-z])/g, (_m, pre: string, c: string) => pre + c.toUpperCase())
    .replace(/(\s)(Of|And|With|In|Or)(?=\s)/g, (_m, sp: string, w: string) => sp + w.toLowerCase());
}

/** Deterministic order: by id. */
export function sortFoods(foods: FoodItem[]): FoodItem[] {
  return [...foods].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface DropCounter {
  add(reason: string, n?: number): void;
  entries(): [string, number][];
}

export function dropCounter(): DropCounter {
  const m = new Map<string, number>();
  return {
    add(reason, n = 1) {
      m.set(reason, (m.get(reason) ?? 0) + n);
    },
    entries() {
      return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    },
  };
}

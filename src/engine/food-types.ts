/**
 * Food data shared by the food library seed (scripts/foods), the database and the Food engines
 * (PRD-1.2 FR-FOOD-*). Pure data, no React or Dexie.
 *
 * Nutrients are per 100 g in the units below. `null` means unknown (not on the label, not in the
 * source), never zero: reviews judge only known values.
 */

export const NUTRIENTS = [
  'kcal', // kcal
  'protein', // g
  'carbs', // g
  'fat', // g
  'fibre', // g
  'sugars', // g
  'satFat', // g
  'sodium', // mg
  'potassium', // mg
  'calcium', // mg
  'iron', // mg
  'magnesium', // mg
  'vitD', // µg
  'b12', // µg
] as const;
export type NutrientKey = (typeof NUTRIENTS)[number];
export type Nutrients = Record<NutrientKey, number | null>;

/** The 8 tracked micros (PRD-1.2 answer 4); sodium is a limit, the rest are targets. */
export const MICROS = [
  'fibre',
  'sodium',
  'potassium',
  'calcium',
  'iron',
  'magnesium',
  'vitD',
  'b12',
] as const;
export type MicroKey = (typeof MICROS)[number];

export type FoodSource = 'generic' | 'branded' | 'indian' | 'custom';

export interface Portion {
  /** "1 katori", "1 cup", "1 bar (60 g)". Grams always come separately. */
  label: string;
  grams: number;
}

export interface FoodItem {
  /** `g:<fdcId>` generic, `b:<fdcId>` branded, `in:<slug>` Indian dish, `c:<uid>` the user's own. */
  id: string;
  name: string;
  brand?: string;
  aliases: string[];
  source: FoodSource;
  per100g: Nutrients;
  /** First portion is the default. Every food has at least one ("100 g" if nothing else). */
  portions: Portion[];
  /** GTIN padded to 14 digits (branded and scanned custom foods). */
  gtin?: string;
  category?: string;
}

/**
 * Compact chunk format written by `scripts/seed-foods.ts` into `src/data/foods/*.json`:
 * `{ v, source, nutrients, foods: [[id, name, brand, aliases, per100g, portions, gtin, category]] }`
 * with `per100g` aligned to `nutrients` and `portions` as `[label, grams]` pairs.
 */
export type FoodRow = [
  id: string,
  name: string,
  brand: string | null,
  aliases: string[],
  per100g: (number | null)[],
  portions: [string, number][],
  gtin: string | null,
  category: string | null,
];

export interface FoodChunk {
  /** Library version, e.g. "2026-10-27.1"; a new version triggers a re-import. */
  v: string;
  source: Exclude<FoodSource, 'custom'>;
  nutrients: NutrientKey[];
  foods: FoodRow[];
}

export function emptyNutrients(): Nutrients {
  return Object.fromEntries(NUTRIENTS.map((k) => [k, null])) as Nutrients;
}

/** Decodes one compact row; nutrient order comes from the chunk, so it survives reordering. */
export function decodeRow(row: FoodRow, keys: readonly NutrientKey[], source: FoodItem['source']): FoodItem {
  const [id, name, brand, aliases, values, portions, gtin, category] = row;
  const per100g = emptyNutrients();
  keys.forEach((k, i) => {
    const v = values[i];
    per100g[k] = v === undefined ? null : v;
  });
  return {
    id,
    name,
    ...(brand ? { brand } : {}),
    aliases,
    source,
    per100g,
    portions: portions.map(([label, grams]) => ({ label, grams })),
    ...(gtin ? { gtin } : {}),
    ...(category ? { category } : {}),
  };
}

export function encodeRow(f: FoodItem, keys: readonly NutrientKey[] = NUTRIENTS): FoodRow {
  return [
    f.id,
    f.name,
    f.brand ?? null,
    f.aliases,
    keys.map((k) => f.per100g[k]),
    f.portions.map((p) => [p.label, p.grams]),
    f.gtin ?? null,
    f.category ?? null,
  ];
}

/** GTIN/UPC/EAN padded to 14 digits so 8-, 12- and 13-digit codes match (FR-FOOD-4). */
export function normalizeGtin(code: string): string | null {
  const digits = code.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits.padStart(14, '0');
}

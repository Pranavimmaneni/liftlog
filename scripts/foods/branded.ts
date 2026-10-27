/**
 * FR-FOOD-1, FR-FOOD-4: branded foods from USDA Branded Foods (CSV), filtered to the store and
 * national brands in data/food-sources.json, one row per GTIN, capped per brand and category.
 * Label nutrients only: what the label doesn't list stays null ("not on label").
 */
import { normalizeGtin, type FoodItem, type Portion } from '../../src/engine/food-types';
import { dropCounter, hasCore, pickNutrients, tidyName, type DropCounter } from './common';
import { streamZipCsv } from './csv';

export interface BrandGroup {
  id: string;
  label: string;
  owner?: string;
  brand?: string;
  cap: number;
  perCategoryCap?: number;
}

export interface BrandedConfig {
  minAvailableDate: string;
  markets: string[];
  servingUnits: { g: string[]; ml: string[] };
  genericServingText: string;
  skipCategories: string;
  perCategoryCap: number;
  groups: BrandGroup[];
}

/** One branded_food.csv row, reduced to what the filter needs. */
export interface BrandedRecord {
  fdcId: number;
  owner: string;
  brand: string;
  gtin: string;
  servingGrams: number;
  servingIsMl: boolean;
  household: string;
  category: string;
  available: string;
  group: string;
}

export function matchGroup(owner: string, brand: string, groups: BrandGroup[]): BrandGroup | undefined {
  return groups.find(
    (g) =>
      (g.owner !== undefined && new RegExp(g.owner, 'i').test(owner.trim())) ||
      (g.brand !== undefined && brand.trim() !== '' && new RegExp(g.brand, 'i').test(brand.trim())),
  );
}

/** FR-FOOD-1: one row per GTIN — the latest available_date wins, then the highest fdc_id. */
export function dedupeByGtin(records: BrandedRecord[]): BrandedRecord[] {
  const best = new Map<string, BrandedRecord>();
  for (const r of records) {
    const cur = best.get(r.gtin);
    if (!cur || r.available > cur.available || (r.available === cur.available && r.fdcId > cur.fdcId))
      best.set(r.gtin, r);
  }
  return [...best.values()];
}

/** Caps per group and per category within a group, newest first; deterministic. */
export function applyCaps(records: BrandedRecord[], cfg: Pick<BrandedConfig, 'groups' | 'perCategoryCap'>) {
  const byGroup = new Map<string, BrandedRecord[]>();
  for (const r of records) byGroup.set(r.group, [...(byGroup.get(r.group) ?? []), r]);
  const kept: BrandedRecord[] = [];
  const stats: { group: string; candidates: number; kept: number }[] = [];
  for (const g of cfg.groups) {
    const rows = (byGroup.get(g.id) ?? []).sort((a, b) =>
      a.available < b.available ? 1 : a.available > b.available ? -1 : b.fdcId - a.fdcId,
    );
    const perCat = new Map<string, number>();
    const catCap = g.perCategoryCap ?? cfg.perCategoryCap;
    let n = 0;
    for (const r of rows) {
      if (n >= g.cap) break;
      const c = perCat.get(r.category) ?? 0;
      if (c >= catCap) continue;
      perCat.set(r.category, c + 1);
      kept.push(r);
      n++;
    }
    stats.push({ group: g.id, candidates: rows.length, kept: n });
  }
  return { kept, stats };
}

export function brandedPortion(
  r: Pick<BrandedRecord, 'household' | 'servingGrams' | 'servingIsMl'>,
  generic: RegExp,
): Portion {
  const text = r.household.replace(/\s+/g, ' ').trim();
  const grams = Math.round(r.servingGrams * 10) / 10;
  const unit = r.servingIsMl ? 'ml' : 'g';
  const base = !text || generic.test(text) ? '1 serving' : text;
  const label = /\d\s*(g|ml|oz)\b/i.test(base) ? base : `${base} (${grams} ${unit})`;
  return { label, grams };
}

/** First pass over branded_food.csv: filter rows to candidates. */
export function toRecord(
  get: (name: string) => string,
  cfg: BrandedConfig,
  drops: DropCounter,
): BrandedRecord | null {
  const owner = get('brand_owner');
  const brand = get('brand_name');
  const group = matchGroup(owner, brand, cfg.groups);
  if (!group) return null; // not a kept brand (not counted as a drop)
  const market = get('market_country');
  if (market && !cfg.markets.includes(market)) return (drops.add('not sold in the United States'), null);
  if (get('discontinued_date')) return (drops.add('discontinued'), null);
  const available = get('available_date') || get('modified_date');
  if (!available || available < cfg.minAvailableDate)
    return (drops.add(`available before ${cfg.minAvailableDate}`), null);
  const category = get('branded_food_category');
  if (new RegExp(cfg.skipCategories, 'i').test(category))
    return (drops.add('category skipped (baby, pet, alcohol, supplements, water)'), null);
  const gtin = normalizeGtin(get('gtin_upc'));
  if (!gtin) return (drops.add('no valid GTIN'), null);
  const unit = get('serving_size_unit');
  const size = Number(get('serving_size'));
  const isG = cfg.servingUnits.g.includes(unit);
  const isMl = cfg.servingUnits.ml.includes(unit);
  if (!(isG || isMl) || !(size > 0)) return (drops.add('serving size not in g or ml'), null);
  const household = get('household_serving_fulltext');
  if (!household.trim()) return (drops.add('no household serving'), null);
  return {
    fdcId: Number(get('fdc_id')),
    owner,
    brand,
    gtin,
    servingGrams: size,
    servingIsMl: isMl,
    household,
    category,
    available,
    group: group.id,
  };
}

const NUTRIENT_IDS = new Set([
  1008, 2047, 2048, 1003, 1004, 1005, 1079, 2000, 1258, 1093, 1092, 1087, 1089, 1090, 1114, 1178,
]);

export interface BrandedResult {
  foods: FoodItem[];
  stats: { group: string; label: string; candidates: number; kept: number; final: number }[];
  scanned: number;
}

/** Streams the three big CSVs out of the zip: branded_food → food (names) → food_nutrient. */
export async function buildBranded(
  zip: string,
  dir: string,
  cfg: BrandedConfig,
  drops: DropCounter = dropCounter(),
  log: (s: string) => void = () => {},
): Promise<BrandedResult> {
  const candidates: BrandedRecord[] = [];
  const scanned = await streamZipCsv(zip, `${dir}/branded_food.csv`, (row, col) => {
    const r = toRecord((n) => row[col(n)] ?? '', cfg, drops);
    if (r) candidates.push(r);
  });
  log(`branded: ${scanned} rows scanned, ${candidates.length} candidates`);
  const unique = dedupeByGtin(candidates);
  drops.add('older duplicate of the same GTIN', candidates.length - unique.length);
  const { kept, stats } = applyCaps(unique, cfg);
  drops.add('over the brand or category cap', unique.length - kept.length);
  const byId = new Map(kept.map((r) => [r.fdcId, r]));
  log(`branded: ${unique.length} unique GTINs, ${kept.length} after caps`);

  const names = new Map<number, string>();
  await streamZipCsv(zip, `${dir}/food.csv`, (row, col) => {
    const id = Number(row[col('fdc_id')]);
    if (byId.has(id)) names.set(id, row[col('description')] ?? '');
  });
  const nutrients = new Map<number, [number, number][]>();
  await streamZipCsv(zip, `${dir}/food_nutrient.csv`, (row, col) => {
    const id = Number(row[col('fdc_id')]);
    if (!byId.has(id)) return;
    const nid = Number(row[col('nutrient_id')]);
    if (!NUTRIENT_IDS.has(nid)) return;
    const list = nutrients.get(id) ?? [];
    list.push([nid, Number(row[col('amount')])]);
    nutrients.set(id, list);
  });
  log(`branded: names for ${names.size}, nutrients for ${nutrients.size}`);

  const generic = new RegExp(cfg.genericServingText, 'i');
  const foods: FoodItem[] = [];
  const finalPerGroup = new Map<string, number>();
  for (const r of kept) {
    const name = tidyName(names.get(r.fdcId) ?? '');
    if (!name) {
      drops.add('no product name');
      continue;
    }
    const per100g = pickNutrients(nutrients.get(r.fdcId) ?? []);
    if (!hasCore(per100g)) {
      drops.add('missing kcal, protein, carbs or fat');
      continue;
    }
    foods.push({
      id: `b:${r.fdcId}`,
      name,
      brand: tidyName(r.brand || r.owner),
      aliases: [],
      source: 'branded',
      per100g,
      portions: [brandedPortion(r, generic), { label: '100 g', grams: 100 }],
      gtin: r.gtin,
      category: r.category || undefined,
    });
    finalPerGroup.set(r.group, (finalPerGroup.get(r.group) ?? 0) + 1);
  }
  return {
    foods: foods.sort((a, b) => (a.id < b.id ? -1 : 1)),
    stats: stats.map((s) => ({
      ...s,
      label: cfg.groups.find((g) => g.id === s.group)!.label,
      final: finalPerGroup.get(s.group) ?? 0,
    })),
    scanned,
  };
}

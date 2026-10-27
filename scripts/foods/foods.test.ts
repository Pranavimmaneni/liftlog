import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeRow, emptyNutrients, NUTRIENTS, type Nutrients } from '../../src/engine/food-types';
import { serializeChunk, toChunk } from '../seed-foods';
import {
  applyCaps,
  brandedPortion,
  dedupeByGtin,
  matchGroup,
  toRecord,
  type BrandedConfig,
  type BrandedRecord,
} from './branded';
import { dropCounter, pickNutrients, tidyName } from './common';
import { parseCsv, CsvParser } from './csv';
import { buildGeneric, fnddsPortions, type FdcFood } from './fndds';
import { dishPortions, recipeNutrients, type Dish, type DishFile, type PortionFile } from './indian';

const root = process.cwd();
const read = <T>(p: string): T => JSON.parse(readFileSync(join(root, p), 'utf8')) as T;
const sources = read<{ branded: BrandedConfig }>('data/food-sources.json');
const dishes = read<DishFile>('data/indian-dishes.json');
const portions = read<PortionFile>('data/food-portions.json');

const rec = (p: Partial<BrandedRecord>): BrandedRecord => ({
  fdcId: 1,
  owner: 'Costco Companies Inc.',
  brand: 'KIRKLAND SIGNATURE',
  gtin: '00000000000001',
  servingGrams: 30,
  servingIsMl: false,
  household: '1 bar',
  category: 'Snacks',
  available: '2024-01-01',
  group: 'costco',
  ...p,
});

const fdc = (
  id: number,
  description: string,
  nutrients: [number, number][],
  portionsList = [] as FdcFood['foodPortions'],
): FdcFood => ({
  fdcId: id,
  description,
  foodNutrients: nutrients.map(([nid, amount]) => ({ nutrient: { id: nid }, amount })),
  foodPortions: portionsList,
  wweiaFoodCategory: { wweiaFoodCategoryDescription: 'Test' },
});

describe('food library seed (FR-FOOD-1)', () => {
  it('FR-FOOD-1: one row per GTIN keeps the latest publication (then the highest fdc_id)', () => {
    const kept = dedupeByGtin([
      rec({ fdcId: 10, available: '2021-05-01' }),
      rec({ fdcId: 11, available: '2023-02-01' }),
      rec({ fdcId: 9, available: '2023-02-01' }),
      rec({ fdcId: 20, gtin: '00000000000002', available: '2020-01-01' }),
    ]);
    expect(kept.map((r) => r.fdcId).sort()).toEqual([11, 20]);
  });

  it('FR-FOOD-1: a nutrient the source does not list is null (unknown), never 0', () => {
    const n = pickNutrients([
      [1008, 120],
      [1003, 5],
      [1093, 0],
    ]);
    expect(n.kcal).toBe(120);
    expect(n.sodium).toBe(0);
    expect(n.vitD).toBeNull();
    expect(n.carbs).toBeNull();
  });

  it('FR-FOOD-1: branded energy falls back to the Atwater kcal when 1008 is missing', () => {
    expect(pickNutrients([[2047, 250]]).kcal).toBe(250);
    expect(
      pickNutrients([
        [2048, 240],
        [1008, 230],
      ]).kcal,
    ).toBe(230);
  });

  it('FR-FOOD-1: same input → byte-equal chunk, whatever the input order', () => {
    const a = [
      fdc(2, 'Rice, white, cooked', [
        [1008, 130],
        [1003, 2.7],
        [1005, 28],
        [1004, 0.3],
      ]),
      fdc(1, 'Dal', [
        [1008, 110],
        [1003, 6],
        [1005, 15],
        [1004, 3],
      ]),
    ];
    const one = serializeChunk(toChunk('t', 'generic', buildGeneric(a)));
    const two = serializeChunk(toChunk('t', 'generic', buildGeneric([...a].reverse())));
    expect(one).toBe(two);
    const parsed = JSON.parse(one) as ReturnType<typeof toChunk>;
    expect(parsed.foods.map((r) => r[0])).toEqual(['g:1', 'g:2']);
    expect(decodeRow(parsed.foods[0]!, parsed.nutrients, 'generic').per100g.kcal).toBe(110);
  });

  it('FR-FOOD-1: foods without kcal, protein, carbs and fat are dropped and counted', () => {
    const drops = dropCounter();
    const baby = {
      ...fdc(3, 'Baby food, peas', [
        [1008, 50],
        [1003, 3],
        [1005, 8],
        [1004, 0],
      ]),
      wweiaFoodCategory: { wweiaFoodCategoryDescription: 'Baby food: vegetable' },
    };
    const out = buildGeneric([fdc(1, 'Water', [[1008, 0]]), baby], drops);
    expect(out).toHaveLength(0);
    expect(
      drops
        .entries()
        .map(([w]) => w)
        .join(),
    ).toMatch(/missing kcal.*|category skipped/);
    expect(drops.entries()).toHaveLength(2);
  });

  it('FR-FOOD-1: the branded filter keeps US, current, served-in-grams products of a kept brand', () => {
    const drops = dropCounter();
    const row: Record<string, string> = {
      fdc_id: '5',
      brand_owner: 'Costco Companies Inc.',
      brand_name: 'KIRKLAND SIGNATURE',
      market_country: 'United States',
      discontinued_date: '',
      available_date: '2024-03-01',
      modified_date: '',
      branded_food_category: 'Snack, Energy & Granola Bars',
      gtin_upc: '096619123456',
      serving_size: '60',
      serving_size_unit: 'g',
      household_serving_fulltext: '1 bar',
    };
    const get = (k: string) => row[k] ?? '';
    expect(toRecord(get, sources.branded, drops)).toMatchObject({ gtin: '00096619123456', group: 'costco' });
    expect(
      toRecord((k) => (k === 'available_date' ? '2018-01-01' : get(k)), sources.branded, drops),
    ).toBeNull();
    expect(toRecord((k) => (k === 'serving_size_unit' ? 'IU' : get(k)), sources.branded, drops)).toBeNull();
    expect(
      toRecord(
        (k) => (k === 'brand_owner' ? 'Acme' : k === 'brand_name' ? 'ACME' : get(k)),
        sources.branded,
        drops,
      ),
    ).toBeNull();
    expect(matchGroup('Wal-Mart Stores, Inc.', 'GREAT VALUE', sources.branded.groups)?.id).toBe('walmart');
    expect(matchGroup('Sam’s Club West', "MEMBER'S MARK", sources.branded.groups)?.id).toBe('sams-club');
  });

  it('FR-FOOD-1: caps hold per group and per category, newest first', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      rec({ fdcId: i, gtin: `${i}`.padStart(14, '0'), available: `2024-01-0${i + 1}` }),
    );
    const { kept } = applyCaps(rows, {
      perCategoryCap: 2,
      groups: [{ id: 'costco', label: 'Costco', cap: 10 }],
    });
    expect(kept.map((r) => r.fdcId)).toEqual([4, 3]);
  });

  it('reads quoted CSV fields, "" escapes and newlines inside quotes, across chunks', () => {
    expect(parseCsv('a,b\n"x, ""y""","line1\nline2"\n')).toEqual([
      ['a', 'b'],
      ['x, "y"', 'line1\nline2'],
    ]);
    const p = new CsvParser();
    const rows = [...p.push('"ab'), ...p.push('c","d"\r\n1,'), ...p.push('2\n'), ...p.end()];
    expect(rows).toEqual([
      ['abc', 'd'],
      ['1', '2'],
    ]);
  });

  it('tidies ALL-CAPS label names and keeps mixed case', () => {
    expect(tidyName('GREEK YOGURT WITH HONEY')).toBe('Greek Yogurt with Honey');
    expect(tidyName('Fairlife 2% Milk')).toBe('Fairlife 2% Milk');
    expect(tidyName("TRADER JOE'S")).toBe("Trader Joe's");
    expect(tidyName("MEMBER'S MARK")).toBe("Member's Mark");
  });
});

describe('Indian dishes and portions (FR-FOOD-6, FR-FOOD-7)', () => {
  const nutr = (p: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...p });

  it('FR-FOOD-6: per 100 g = summed ingredient nutrients ÷ cooked yield', () => {
    const d: Dish = {
      slug: 't',
      name: 'T',
      aliases: [],
      kind: 'dal',
      recipe: [
        ['a', 100],
        ['water', 300],
        ['b', 50],
      ],
      loss: 0.2,
    };
    const table: Record<string, Nutrients> = {
      a: nutr({ kcal: 340, protein: 22, carbs: 60, fat: 1.5, vitD: 0 }),
      b: nutr({ kcal: 900, protein: 0, carbs: 0, fat: 100 }),
    };
    const n = recipeNutrients(d, {}, (k) => table[k] ?? null);
    const yieldG = 450 * 0.8; // 360 g
    expect(n.kcal).toBe(Math.round(((340 + 450) / yieldG) * 100));
    expect(n.protein).toBeCloseTo((22 / yieldG) * 100, 1);
    expect(n.fat).toBeCloseTo(((1.5 + 50) / yieldG) * 100, 1);
    // vitamin D is listed for only 100 of 150 g of solids (67% < 90%): unknown.
    expect(n.vitD).toBeNull();
  });

  it('FR-FOOD-6: every dish uses known ingredients, has a positive yield and unique slug', () => {
    const slugs = new Set<string>();
    for (const d of dishes.dishes) {
      expect(slugs.has(d.slug), d.slug).toBe(false);
      slugs.add(d.slug);
      for (const [k, g] of d.recipe) {
        expect(dishes.ingredients[k], `${d.slug}: ${k}`).toBeDefined();
        expect(g).toBeGreaterThan(0);
      }
      expect(dishes.lossByKind[d.kind], d.kind).toBeDefined();
    }
    expect(dishes.dishes.length).toBeGreaterThanOrEqual(140);
  });

  it('FR-FOOD-7: dishes get their own servings or the defaults for their kind, then 100 g', () => {
    const dal = dishes.dishes.find((d) => d.slug === 'dal-tadka')!;
    expect(dishPortions(dal, portions)).toEqual([
      { label: '1 katori', grams: 150 },
      { label: '1 small katori', grams: 100 },
      { label: '100 g', grams: 100 },
    ]);
    const samosa = dishes.dishes.find((d) => d.slug === 'samosa')!;
    expect(dishPortions(samosa, portions)[0]).toEqual({ label: '1 samosa', grams: 70 });
    for (const d of dishes.dishes) expect(dishPortions(d, portions).length, d.slug).toBeGreaterThanOrEqual(2);
  });

  it('FR-FOOD-7: FNDDS portions drop "Quantity not specified" and zero grams; branded labels carry grams', () => {
    expect(
      fnddsPortions([
        { portionDescription: '1 cup, cooked', gramWeight: 163, sequenceNumber: 1 },
        {
          portionDescription: 'Quantity not specified',
          modifier: '90000',
          gramWeight: 122,
          sequenceNumber: 2,
        },
        { portionDescription: '1 tbsp', gramWeight: 0, sequenceNumber: 3 },
      ]),
    ).toEqual([{ label: '1 cup, cooked', grams: 163 }]);
    expect(fnddsPortions([])).toEqual([{ label: '100 g', grams: 100 }]);
    const generic = new RegExp(sources.branded.genericServingText, 'i');
    expect(brandedPortion({ household: '1 bar', servingGrams: 60, servingIsMl: false }, generic)).toEqual({
      label: '1 bar (60 g)',
      grams: 60,
    });
    expect(
      brandedPortion({ household: '1 cup (240 ml)', servingGrams: 240, servingIsMl: true }, generic).label,
    ).toBe('1 cup (240 ml)');
    expect(
      brandedPortion({ household: 'Amount per serving', servingGrams: 30, servingIsMl: false }, generic)
        .label,
    ).toBe('1 serving (30 g)');
  });

  it('every unit in food-portions.json has a label and positive grams', () => {
    for (const [k, u] of Object.entries(portions.units)) {
      expect(u.label, k).toBeTruthy();
      expect(u.grams, k).toBeGreaterThan(0);
    }
    expect(NUTRIENTS).toHaveLength(14);
  });
});

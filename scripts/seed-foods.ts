/**
 * FR-FOOD-1, FR-FOOD-6: builds the food library chunks in src/data/foods/ from the pinned USDA
 * FoodData Central downloads (data/food-sources.json) and writes FOOD-SEED-REPORT.md.
 * Deterministic: same inputs → byte-equal outputs (sorted rows, no timestamps).
 *
 *   npm run seed:foods        (downloads into .cache/usda/ on first run, ~470 MB; ~12 min)
 *
 * The full branded catalogue (FR-FOOD-8, D120) goes to public/food/<version>/catalogue-NN.json:
 * served as is by the site, outside the precache and the APK.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  NUTRIENTS,
  encodeRow,
  type FoodChunk,
  type FoodItem,
  type Nutrients,
} from '../src/engine/food-types';
import { buildBranded, type BrandedConfig, type BrandedResult } from './foods/branded';
import { dropCounter, pickNutrients } from './foods/common';
import { CACHE, fetchAll, type SourceFile } from './foods/fetch';
import { buildGeneric, type FdcFood } from './foods/fndds';
import { buildIndian, type DishFile, type PortionFile } from './foods/indian';

const root = process.cwd();
const read = <T>(p: string): T => JSON.parse(readFileSync(join(root, p), 'utf8')) as T;

interface SourcesFile {
  version: string;
  licence: string;
  attribution: string;
  sources: SourceFile[];
  branded: BrandedConfig;
}

/** One row per line so a library update reads as a reviewable diff. */
export function serializeChunk(chunk: FoodChunk): string {
  const head = JSON.stringify({ v: chunk.v, source: chunk.source, nutrients: chunk.nutrients });
  const rows = chunk.foods.map((r) => JSON.stringify(r)).join(',\n');
  return `${head.slice(0, -1)},"foods":[\n${rows}\n]}\n`;
}

/** FR-FOOD-8: the catalogue cut into fixed-size shards, in id order (deterministic). */
export function shard<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const catalogueFile = (i: number) => `catalogue-${String(i).padStart(2, '0')}.json`;

export function toChunk(v: string, source: FoodChunk['source'], foods: FoodItem[]): FoodChunk {
  return { v, source, nutrients: [...NUTRIENTS], foods: foods.map((f) => encodeRow(f)) };
}

function unzipJson<T>(file: string): T {
  const buf = execFileSync('unzip', ['-p', join(CACHE, file)], { maxBuffer: 1024 * 1024 * 1024 });
  return JSON.parse(buf.toString('utf8')) as T;
}

function nutrientIndex(foods: FdcFood[]): Map<number, Nutrients> {
  return new Map(
    foods.map((f) => [f.fdcId, pickNutrients(f.foodNutrients.map((n) => [n.nutrient.id, n.amount ?? NaN]))]),
  );
}

async function main() {
  const cfg = read<SourcesFile>('data/food-sources.json');
  await fetchAll();
  const file = (id: string) => cfg.sources.find((s) => s.id === id)!.file;

  const genericDrops = dropCounter();
  const fnddsRaw = unzipJson<{ SurveyFoods: FdcFood[] }>(file('fndds')).SurveyFoods;
  const generic = buildGeneric(fnddsRaw, genericDrops);
  console.log(`generic: ${generic.length} of ${fnddsRaw.length}`);

  const srRaw = unzipJson<{ SRLegacyFoods: FdcFood[] }>(file('sr')).SRLegacyFoods;
  const sr = nutrientIndex(srRaw);
  const fndds = nutrientIndex(fnddsRaw);
  const dishes = read<DishFile>('data/indian-dishes.json');
  const portions = read<PortionFile>('data/food-portions.json');
  const indian = buildIndian(dishes, portions, (ref) =>
    ref.sr !== undefined
      ? (sr.get(ref.sr) ?? null)
      : ref.fndds !== undefined
        ? (fndds.get(ref.fndds) ?? null)
        : null,
  );
  if (indian.missing.length) throw new Error(`indian: unresolved ingredients ${indian.missing.join(', ')}`);
  console.log(`indian: ${indian.foods.length} dishes`);

  const brandedDrops = dropCounter();
  const brandedFile = file('branded');
  const dir = brandedFile.replace(/\.zip$/, '');
  const branded = await buildBranded(join(CACHE, brandedFile), dir, cfg.branded, brandedDrops, (s) =>
    console.log(s),
  );
  console.log(`branded: ${branded.foods.length} core, ${branded.catalogue.length} catalogue`);

  const outDir = join(root, 'src', 'data', 'foods');
  mkdirSync(outDir, { recursive: true });
  const chunks = [
    { file: 'foods-generic.json', chunk: toChunk(cfg.version, 'generic', generic) },
    { file: 'foods-indian.json', chunk: toChunk(cfg.version, 'indian', indian.foods) },
    { file: 'foods-branded.json', chunk: toChunk(cfg.version, 'branded', branded.foods) },
  ];
  const manifest = {
    v: cfg.version,
    attribution: cfg.attribution,
    chunks: chunks.map(({ file, chunk }) => {
      const text = serializeChunk(chunk);
      writeFileSync(join(outDir, file), text);
      return {
        file,
        source: chunk.source,
        count: chunk.foods.length,
        bytes: Buffer.byteLength(text),
        gzipBytes: gzipSync(text, { level: 9 }).length,
      };
    }),
  };
  // FR-FOOD-8: the catalogue shards, one folder per library version (old versions removed).
  const pubRoot = join(root, 'public', 'food');
  rmSync(pubRoot, { recursive: true, force: true });
  const catDir = join(pubRoot, cfg.version);
  mkdirSync(catDir, { recursive: true });
  const catalogue = {
    path: `food/${cfg.version}/`,
    shards: shard(branded.catalogue, cfg.branded.catalogue?.shardSize ?? 25_000).map((foods, i) => {
      const file = catalogueFile(i);
      const text = serializeChunk(toChunk(cfg.version, 'branded', foods));
      writeFileSync(join(catDir, file), text);
      return {
        file,
        source: 'branded',
        count: foods.length,
        bytes: Buffer.byteLength(text),
        gzipBytes: gzipSync(text, { level: 9 }).length,
      };
    }),
  };
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify({ ...manifest, catalogue }, null, 2)}\n`);
  writeFileSync(
    join(root, 'FOOD-SEED-REPORT.md'),
    report(cfg, manifest.chunks, catalogue.shards, {
      fnddsTotal: fnddsRaw.length,
      genericDrops: genericDrops.entries(),
      branded,
      brandedDrops: brandedDrops.entries(),
      dishCount: dishes.dishes.length,
      generic,
      indian: indian.foods,
    }),
  );
  console.log(
    'seed:foods done',
    manifest.chunks.map((c) => `${c.file} ${c.count}`).join(', '),
    `+ ${catalogue.shards.length} catalogue shards (${branded.catalogue.length})`,
  );
}

/** Store-brand names per retailer, for the report only. */
const STORE_BRANDS: [string, RegExp][] = [
  ['Walmart', /^(great value|marketside|sam'?s choice|freshness guaranteed|bettergoods|clear american)$/i],
  ['Target', /^(good & gather|market pantry|favorite day|archer farms|simply balanced|wondershop)$/i],
  ['Costco', /^kirkland/i],
  ["Sam's Club", /^member'?s mark$/i],
  ['Kroger', /^(kroger|simple truth|simple truth organic|private selection|heritage farm)$/i],
  ['Whole Foods', /^(365|whole foods market|365 whole foods market|365 everyday value)$/i],
  [
    'Albertsons / Safeway',
    /^(signature select|o organics|open nature|lucerne|signature cafe|signature farms)$/i,
  ],
  [
    'Aldi',
    /^(millville|clancy'?s|friendly farms|happy farms|simply nature|l'oven fresh|fit & active|southern grove|baker'?s corner|savoritz|specially selected|never any!?)$/i,
  ],
  ["Trader Joe's", /trader joe/i],
  ['Publix', /^(publix|greenwise)$/i],
  ['H-E-B', /^(h-e-b|hill country fare|central market)$/i],
  ['Meijer', /^meijer/i],
  ['Wegmans', /^wegmans/i],
  ['Lidl', /^lidl$/i],
];

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

function report(
  cfg: SourcesFile,
  chunks: { file: string; count: number; bytes: number; gzipBytes: number }[],
  shards: { file: string; count: number; bytes: number; gzipBytes: number }[],
  r: {
    fnddsTotal: number;
    genericDrops: [string, number][];
    branded: BrandedResult;
    brandedDrops: [string, number][];
    dishCount: number;
    generic: FoodItem[];
    indian: FoodItem[];
  },
): string {
  const all = [...chunks, ...shards];
  const total = all.reduce((s, c) => s + c.count, 0);
  const countBrands = (foods: FoodItem[]) => {
    const m = new Map<string, number>();
    for (const f of foods) m.set(f.brand ?? '', (m.get(f.brand ?? '') ?? 0) + 1);
    return m;
  };
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .filter(([b]) => b)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n);
  const topBrands = top(countBrands(r.branded.foods), 40);
  const everyBranded = [...r.branded.foods, ...r.branded.catalogue];
  const allBrands = countBrands(everyBranded);
  const catBytes = shards.reduce((s, c) => s + c.bytes, 0);
  const catGz = shards.reduce((s, c) => s + c.gzipBytes, 0);
  const storeRows = STORE_BRANDS.map(([store, re]) => {
    const hit = [...allBrands.entries()].filter(([b]) => re.test(b)).sort((a, b) => b[1] - a[1]);
    const n = hit.reduce((s, [, c]) => s + c, 0);
    return `| ${store} | ${n} | ${hit
      .slice(0, 6)
      .map(([b, c]) => `${b} (${c})`)
      .join(', ')} |`;
  });
  const known = (foods: FoodItem[], k: keyof Nutrients) => foods.filter((f) => f.per100g[k] !== null).length;
  const lines = [
    '# Food library seed report',
    '',
    `Generated by \`npm run seed:foods\` (scripts/seed-foods.ts), library version **${cfg.version}**. FR-FOOD-1, FR-FOOD-6, FR-FOOD-7.`,
    '',
    `Source data: ${cfg.attribution} Licence: ${cfg.licence}. No Open Food Facts (ODbL) data is included (NFR-LIC-2).`,
    '',
    '## Totals',
    '',
    '| Chunk | Foods | Raw | Gzipped |',
    '|---|---|---|---|',
    ...chunks.map((c) => `| ${c.file} | ${c.count} | ${kb(c.bytes)} | ${kb(c.gzipBytes)} |`),
    `| catalogue (${shards.length} shards in public/food/${cfg.version}/) | ${shards.reduce((s, c) => s + c.count, 0)} | ${kb(catBytes)} | ${kb(catGz)} |`,
    `| **All** | **${total}** | **${kb(all.reduce((s, c) => s + c.bytes, 0))}** | **${kb(all.reduce((s, c) => s + c.gzipBytes, 0))}** |`,
    '',
    '## Sources',
    '',
    '| Id | Dataset | Release | sha256 |',
    '|---|---|---|---|',
    ...cfg.sources.map((s) => `| ${s.id} | ${s.dataset} | ${s.release} | \`${s.sha256.slice(0, 16)}…\` |`),
    '',
    '## Generic foods (FNDDS 2021–2023)',
    '',
    `${r.generic.length} of ${r.fnddsTotal} FNDDS foods kept, with their household portions ("Quantity not specified" and zero-gram portions dropped).`,
    '',
    '| Dropped | Rows |',
    '|---|---|',
    ...r.genericDrops.map(([why, n]) => `| ${why} | ${n} |`),
    '',
    '## Indian dishes',
    '',
    `${r.indian.length} dishes from \`data/indian-dishes.json\`, computed from standard recipes of USDA SR Legacy / FNDDS ingredients (per 100 g = ingredient sum ÷ cooked yield). A nutrient counts as known when ingredients listing it make up ≥ 90% of the non-water weight. Values are estimates of typical home recipes. The Indian Food Composition Tables (IFCT 2017, ICMR-NIN) were not used: no open licence for redistribution could be found.`,
    '',
    `Known values: vitamin D ${known(r.indian, 'vitD')}/${r.indian.length}, B12 ${known(r.indian, 'b12')}/${r.indian.length}, iron ${known(r.indian, 'iron')}/${r.indian.length}.`,
    '',
    '## Branded foods (USDA Branded Foods)',
    '',
    `${r.branded.scanned} rows scanned. Core filter (data/food-sources.json \`branded\`): brand groups below, sold in the United States, not discontinued, available on or after ${cfg.branded.minAvailableDate}, a household serving and a serving size in g or ml (ml counted as g), one row per GTIN (latest wins), at most ${cfg.branded.perCategoryCap} per category per group unless the group says otherwise, and kcal, protein, carbs and fat present. Label nutrients only: values a label doesn't list stay unknown.`,
    '',
    '| Group | Cap | Unique candidates | After caps | Final |',
    '|---|---|---|---|---|',
    ...r.branded.stats.map((s) => {
      const g = cfg.branded.groups.find((x) => x.id === s.group)!;
      return `| ${s.label} | ${g.cap}${g.perCategoryCap ? ` (${g.perCategoryCap}/category)` : ''} | ${s.candidates} | ${s.kept} | ${s.final} |`;
    }),
    '',
    '| Dropped | Rows |',
    '|---|---|',
    ...r.brandedDrops.map(([why, n]) => `| ${why} | ${n} |`),
    '',
    '### Top brands kept',
    '',
    topBrands.map(([b, n]) => `${b} (${n})`).join(', '),
    '',
    '## Full catalogue (FR-FOOD-8)',
    '',
    `Every other product that passes the same filter, any brand, plus the core groups' overflow over their caps: ${r.branded.catalogue.length} products in ${shards.length} shards of ${cfg.branded.catalogue?.shardSize ?? 25_000}. With the core set that is **${everyBranded.length} branded products from ${allBrands.size} brands**. Brand names like "Not a branded item" or "N/A" fall back to the brand owner.`,
    '',
    'USDA Branded Foods is built from label data that brand owners and retailers submit (mostly through GS1 US). It is the most complete openly licensed US label database, but not every product on every shelf: a product is missing when its brand owner never submitted it, or only submitted a label older than 2020.',
    '',
    '### Store brands',
    '',
    '| Store | Products | Biggest brands |',
    '|---|---|---|',
    ...storeRows,
    '',
    'National brands (Kraft, General Mills, PepsiCo, Coca-Cola …) are sold at every store and are counted under their own names below, not under a store.',
    '',
    '### Top 60 brands overall',
    '',
    top(allBrands, 60)
      .map(([b, n]) => `${b} (${n})`)
      .join(', '),
    '',
    `Known label values: fibre ${known(r.branded.foods, 'fibre')}, sodium ${known(r.branded.foods, 'sodium')}, potassium ${known(r.branded.foods, 'potassium')}, calcium ${known(r.branded.foods, 'calcium')}, iron ${known(r.branded.foods, 'iron')}, vitamin D ${known(r.branded.foods, 'vitD')}, B12 ${known(r.branded.foods, 'b12')} of ${r.branded.foods.length}.`,
    '',
  ];
  return lines.join('\n');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed-foods.ts')) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}

import { db } from './schema';
import { logError } from './errors';
import type { FoodLibRow, FoodSearchRow } from './types';
import { isNative } from '@/platform';
import {
  decodeRow,
  encodeRow,
  NUTRIENTS,
  type FoodChunk,
  type FoodItem,
  type FoodRow,
} from '@/engine/food-types';
import { toColumns, type SearchColumns } from '@/engine/food-search';

/**
 * PRD-1.2 FR-FOOD-2, FR-FOOD-8, NFR-OFF-3: the food library is downloaded once from LiftLog's own
 * site and stored in IndexedDB, chunk by chunk, so an interrupted download resumes where it stopped.
 * The core chunks (src/data/foods/foods-*.json, emitted as plain assets, kept out of the precache)
 * come first; then the full branded catalogue (public/food/<version>/catalogue-NN.json, ~400,000
 * products). The APK carries the core chunks and fetches the catalogue from the site (D123).
 * A new library version re-imports everything.
 */

export interface LibraryChunk {
  file: string;
  source: string;
  count: number;
}

export interface LibraryManifest {
  v: string;
  chunks: LibraryChunk[];
  /** FR-FOOD-8: catalogue shards, served from `path` (relative to the site root). */
  catalogue?: { path: string; shards: LibraryChunk[] };
}

/**
 * `foodSearch` key of an imported chunk. The key carries the library version, so what is imported
 * is read from the library itself: wiping `meta` (demo data, a restored backup) can't make it
 * re-download or skip anything (D122).
 */
export const searchKey = (v: string, file: string) => `${v}/${file}`;

const urls = import.meta.glob<string>('../data/foods/foods-*.json', {
  query: '?url',
  import: 'default',
  eager: true,
});
const manifests = import.meta.glob<LibraryManifest>('../data/foods/manifest.json', {
  import: 'default',
  eager: true,
});

export const LIBRARY_MANIFEST: LibraryManifest | null = Object.values(manifests)[0] ?? null;

/** Chunk file name → URL of the emitted asset. */
export function chunkUrls(): Record<string, string> {
  return Object.fromEntries(Object.entries(urls).map(([path, url]) => [path.split('/').pop()!, url]));
}

/** Where a catalogue shard is served: this site, or for the APK, LiftLog's site (D123). */
export function catalogueUrl(path: string, file: string): string {
  return isNative ? `${__SITE_URL__}/${path}${file}` : `${import.meta.env.BASE_URL}${path}${file}`;
}

const BATCH = 2000;

/** Compact rows for `foodLib`, nutrients in NUTRIENTS order whatever the chunk's order. */
export function chunkToRows(chunk: FoodChunk): FoodLibRow[] {
  const same =
    chunk.nutrients.length === NUTRIENTS.length && chunk.nutrients.every((k, i) => k === NUTRIENTS[i]);
  const pos = NUTRIENTS.map((k) => chunk.nutrients.indexOf(k));
  return chunk.foods.map((r) => {
    const row: FoodRow = same
      ? r
      : [r[0], r[1], r[2], r[3], pos.map((i) => (i < 0 ? null : (r[4][i] ?? null))), r[5], r[6], r[7]];
    return { id: r[0], ...(r[6] ? { gtin: r[6] } : {}), s: chunk.source, r: row };
  });
}

export function decodeLibRow(row: FoodLibRow): FoodItem {
  return decodeRow(row.r, NUTRIENTS, row.s);
}

/** FR-FOOD-8: the search columns of one chunk (names, brands, aliases; normalised once here). */
export function chunkToColumns(file: string, chunk: FoodChunk): FoodSearchRow {
  const cols = toColumns(
    chunk.foods.map((r) => ({ id: r[0], name: r[1], ...(r[2] ? { brand: r[2] } : {}), aliases: r[3] })),
    chunk.source,
  );
  return { file, ...cols };
}

export interface ImportOptions {
  manifest?: LibraryManifest | null;
  load?: (file: string, chunk: LibraryChunk) => Promise<FoodChunk>;
  onProgress?: (done: number, total: number) => void;
  /** FR-FOOD-8: also import the catalogue shards (default: yes). */
  catalogue?: boolean;
}

/** `partial`: the core library is in, but a catalogue shard couldn't be downloaded (offline). */
export type ImportResult = 'up-to-date' | 'imported' | 'partial' | 'no-library';

/** The chunk files imported for library version `v`, and whether rows of another version exist. */
export async function importedFiles(v: string): Promise<{ files: Set<string>; stale: boolean }> {
  const keys = (await db.foodSearch.toCollection().primaryKeys()) as string[];
  const prefix = searchKey(v, '');
  return {
    files: new Set(keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length))),
    stale: keys.some((k) => !k.startsWith(prefix)),
  };
}

let running: Promise<ImportResult> | null = null;

/**
 * Imports whatever this library version still lacks. A new version clears the old rows first.
 * `foodLibVersion` is set once the core chunks are in (Food search works from then on); the
 * catalogue follows. Two calls at once share one run.
 */
export function importLibrary(opts: ImportOptions = {}): Promise<ImportResult> {
  running ??= runImport(opts).finally(() => {
    running = null;
  });
  return running;
}

async function runImport(opts: ImportOptions): Promise<ImportResult> {
  const manifest = opts.manifest === undefined ? LIBRARY_MANIFEST : opts.manifest;
  if (!manifest || !manifest.chunks.length) return 'no-library';
  const core = manifest.chunks;
  const shards = opts.catalogue === false ? [] : (manifest.catalogue?.shards ?? []);

  const imported = await importedFiles(manifest.v);
  let done = imported.files;
  const stale = imported.stale;
  // A new library version (or rows from no import at all) starts from scratch.
  if (stale || (done.size === 0 && (await db.foodLib.count()) > 0)) {
    await db.transaction('rw', db.foodLib, db.foodSearch, db.meta, async () => {
      await db.foodLib.clear();
      await db.foodSearch.clear();
      await db.meta.delete('foodLibVersion');
    });
    done = new Set();
  }
  const todo = [...core, ...shards].filter((c) => !done.has(c.file));
  const markReady = async () => {
    if (core.every((c) => done.has(c.file)) && (await db.meta.get('foodLibVersion'))?.value !== manifest.v)
      await db.meta.put({ key: 'foodLibVersion', value: manifest.v });
  };
  if (!todo.length) {
    await markReady();
    return 'up-to-date';
  }

  const map = chunkUrls();
  const load =
    opts.load ??
    (async (file: string) => {
      const isCore = core.some((c) => c.file === file);
      const url = isCore ? map[file] : catalogueUrl(manifest.catalogue!.path, file);
      if (!url) throw new Error(`food library chunk missing: ${file}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`food library ${file}: HTTP ${res.status}`);
      return (await res.json()) as FoodChunk;
    });

  const total = todo.reduce((n, c) => n + c.count, 0);
  let written = 0;
  for (const c of todo) {
    let chunk: FoodChunk;
    try {
      chunk = await load(c.file, c);
    } catch (e) {
      // The core library must import; a missing catalogue shard waits for the next start.
      if (core.includes(c)) throw e;
      void logError(e, 'food-catalogue');
      return 'partial';
    }
    const rows = chunkToRows(chunk);
    // Small batches: one huge transaction can stall low-end phones.
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.foodLib.bulkPut(rows.slice(i, i + BATCH));
      opts.onProgress?.(written + Math.min(i + BATCH, rows.length), total);
    }
    written += rows.length;
    // Written last: the chunk counts as imported only once all its rows are in.
    await db.foodSearch.put(chunkToColumns(searchKey(manifest.v, c.file), chunk));
    done.add(c.file);
    await markReady();
  }
  return 'imported';
}

/** NFR-OFF-3: started after the app has loaded, while online, so Food works offline later. */
export function scheduleLibraryImport(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false && !isNative) return;
  // FR-FOOD-8: the ~20 MB catalogue waits when the phone asks to save data (D123).
  const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const run = () =>
    void importLibrary({ catalogue: !saveData }).catch((e: unknown) => logError(e, 'food-library'));
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 2000);
}

/** FR-FOOD-8: the search columns of every imported chunk, for the in-memory index. */
export async function librarySearchParts(): Promise<SearchColumns[]> {
  return (await db.foodSearch.toArray()).map(({ file: _file, ...cols }) => cols);
}

/** The user's own (non-deleted) foods, for the small own-foods index and quick lookups. */
export async function ownFoods(): Promise<FoodItem[]> {
  return (await db.foods.toArray()).filter((f) => !f.deletedAt);
}

/** Library foods by id, in the given order (missing ids are skipped). */
export async function libraryFoods(ids: string[]): Promise<FoodItem[]> {
  const rows = await db.foodLib.bulkGet(ids);
  return rows.filter((r): r is FoodLibRow => !!r).map(decodeLibRow);
}

/**
 * Writes library foods directly, as an import would (tests and demo data): compact rows, their
 * search columns under `file`, and a library version if none is set.
 */
export async function putLibraryFoods(foods: FoodItem[], file = 'local'): Promise<void> {
  await db.foodLib.bulkPut(
    foods.map((f) => ({
      id: f.id,
      ...(f.gtin ? { gtin: f.gtin } : {}),
      s: f.source === 'custom' ? 'generic' : f.source,
      r: encodeRow(f),
    })),
  );
  await db.foodSearch.put({ file, ...toColumns(foods) });
  if (!(await db.meta.get('foodLibVersion'))) await db.meta.put({ key: 'foodLibVersion', value: file });
}

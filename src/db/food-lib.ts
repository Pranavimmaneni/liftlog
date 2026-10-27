import { db } from './schema';
import { logError } from './errors';
import type { FoodLibRow } from './types';
import { decodeRow, type FoodChunk, type FoodItem } from '@/engine/food-types';

/**
 * PRD-1.2 FR-FOOD-2, NFR-OFF-3: the bundled food library (src/data/foods/foods-*.json, emitted as
 * plain assets and kept out of the precache) is downloaded once from LiftLog's own site and stored
 * in IndexedDB. It re-imports only when the library version changes.
 */

export interface LibraryManifest {
  v: string;
  chunks: { file: string; source: string; count: number }[];
}

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

const BATCH = 2000;

export function chunkToRows(chunk: FoodChunk): FoodLibRow[] {
  return chunk.foods.map((r) => decodeRow(r, chunk.nutrients, chunk.source));
}

export interface ImportOptions {
  manifest?: LibraryManifest | null;
  load?: (file: string) => Promise<FoodChunk>;
  onProgress?: (done: number, total: number) => void;
}

export type ImportResult = 'up-to-date' | 'imported' | 'no-library';

/** Imports the library unless this version is already stored. Old rows are replaced in one go. */
export async function importLibrary(opts: ImportOptions = {}): Promise<ImportResult> {
  const manifest = opts.manifest === undefined ? LIBRARY_MANIFEST : opts.manifest;
  if (!manifest || !manifest.chunks.length) return 'no-library';
  const have = (await db.meta.get('foodLibVersion'))?.value;
  if (have === manifest.v && (await db.foodLib.count()) > 0) return 'up-to-date';

  const map = chunkUrls();
  const load =
    opts.load ??
    (async (file: string) => {
      const url = map[file];
      if (!url) throw new Error(`food library chunk missing: ${file}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`food library ${file}: HTTP ${res.status}`);
      return (await res.json()) as FoodChunk;
    });

  const rows: FoodLibRow[] = [];
  for (const c of manifest.chunks) rows.push(...chunkToRows(await load(c.file)));

  // Clear and refill in batches: one huge transaction can stall low-end phones.
  await db.foodLib.clear();
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.foodLib.bulkPut(rows.slice(i, i + BATCH));
    opts.onProgress?.(Math.min(i + BATCH, rows.length), rows.length);
  }
  await db.meta.put({ key: 'foodLibVersion', value: manifest.v });
  return 'imported';
}

/** NFR-OFF-3: started after the app has loaded, while online, so Food works offline later. */
export function scheduleLibraryImport(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const run = () => void importLibrary().catch((e: unknown) => logError(e, 'food-library'));
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 2000);
}

/** All library rows plus the user's own (non-deleted) foods, for the in-memory search index. */
export async function searchableFoods(): Promise<FoodItem[]> {
  const [lib, own] = await Promise.all([db.foodLib.toArray(), db.foods.toArray()]);
  return [...own.filter((f) => !f.deletedAt), ...lib];
}

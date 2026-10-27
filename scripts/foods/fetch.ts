/**
 * FR-FOOD-1: downloads the pinned USDA FoodData Central files named in data/food-sources.json into
 * the git-ignored .cache/usda/ and checks their sha256. Idempotent: a file whose hash already matches
 * is kept. Dev only (the app never fetches USDA at runtime, NFR-SEC-1).
 *
 *   npx tsx scripts/foods/fetch.ts
 */
import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface SourceFile {
  id: string;
  dataset: string;
  release: string;
  url: string;
  file: string;
  sha256: string;
}

export const CACHE = join(process.cwd(), '.cache', 'usda');

export function sourceFiles(): SourceFile[] {
  const cfg = JSON.parse(readFileSync(join(process.cwd(), 'data', 'food-sources.json'), 'utf8')) as {
    sources: SourceFile[];
  };
  return cfg.sources;
}

export async function sha256(path: string): Promise<string> {
  const h = createHash('sha256');
  await pipeline(createReadStream(path), h);
  return h.digest('hex');
}

async function download(url: string, to: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  const tmp = `${to}.part`;
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
  renameSync(tmp, to);
}

export async function fetchAll(): Promise<void> {
  mkdirSync(CACHE, { recursive: true });
  for (const s of sourceFiles()) {
    const path = join(CACHE, s.file);
    if (!existsSync(path)) {
      console.log(`fetch: ${s.id} ← ${s.url}`);
      await download(s.url, path);
    }
    const hash = await sha256(path);
    if (s.sha256 && hash !== s.sha256) throw new Error(`${s.file}: sha256 ${hash} ≠ pinned ${s.sha256}`);
    console.log(`fetch: ${s.id} ok ${s.sha256 ? '(sha256 verified)' : `(sha256 ${hash}, pin it)`}`);
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/foods/fetch.ts')) {
  fetchAll().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}

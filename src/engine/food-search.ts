/**
 * PRD-1.2 FR-FOOD-3, FR-FOOD-8, NFR-PERF-5: food search over the whole library (about 425,000
 * foods with the full branded catalogue) in under 150 ms, in little memory.
 *
 * Same matching as the exercise search (FR-LIB-3: case/punctuation-insensitive, prefix, one typo per
 * word) plus brand and alias words. The index is columnar: normalised names, one string of extra
 * words per food, and an inverted word index in typed arrays, so a phone holds no per-food objects.
 * A query finds candidates through the word index and scores only those. Hits are ids: the caller
 * loads the few foods it shows (D121). Own, favourite and frequent foods rank first via `boost`.
 */
import { normalize } from './search';
import type { FoodSource } from './food-types';
import { NUTRITION } from './food-data';

export interface SearchableFood {
  id: string;
  name: string;
  brand?: string;
  aliases: string[];
  source?: FoodSource;
}

/** Normalised search words for a food (also the Dexie `terms` multi-entry index of own foods). */
export function foodTerms(f: SearchableFood): string[] {
  const words = new Set<string>();
  for (const s of [f.name, f.brand ?? '', ...f.aliases])
    for (const w of normalize(s).split(' ')) if (w) words.add(w);
  return [...words];
}

/**
 * The search fields of a block of foods (a library chunk or the user's own foods), one entry per
 * food. Stored as is in IndexedDB (`foodSearch`), so the index builds without reading every food.
 */
export interface SearchColumns {
  ids: string[];
  /** Normalised names. */
  names: string[];
  /** Normalised brand and alias words that aren't name words, space-separated ("" for none). */
  extra: string[];
  /** One source for the whole block, or one per food. */
  source: FoodSource | FoodSource[];
}

export function toColumns(foods: SearchableFood[], source?: FoodSource): SearchColumns {
  const names = foods.map((f) => normalize(f.name));
  return {
    ids: foods.map((f) => f.id),
    names,
    extra: foods.map((f, i) => {
      const own = new Set(names[i]!.split(' '));
      return foodTerms(f)
        .filter((w) => !own.has(w))
        .join(' ');
    }),
    source: source ?? foods.map((f) => f.source ?? 'generic'),
  };
}

const SOURCES: FoodSource[] = ['generic', 'branded', 'indian', 'custom'];

export interface FoodIndex {
  size: number;
  ids: string[];
  names: string[];
  extra: string[];
  /** Index into SOURCES per food. */
  sources: Uint8Array;
  /** Sorted unique words; the foods containing words[i] are postings[starts[i] .. starts[i+1]). */
  words: string[];
  starts: Uint32Array;
  postings: Uint32Array;
}

function* wordsOf(name: string, extra: string): Generator<string> {
  let seen: string[] | null = null;
  for (const part of [name, extra]) {
    if (!part) continue;
    for (const w of part.split(' ')) {
      if (!w) continue;
      if (seen?.includes(w)) continue;
      (seen ??= []).push(w);
      yield w;
    }
  }
}

/**
 * Builds the index in slices; `yield` marks a point where an async caller may let the screen paint.
 * Two passes over the words (count, then fill) keep the postings in two flat typed arrays.
 */
function* buildSteps(parts: SearchColumns[], slice: number): Generator<void, FoodIndex> {
  const ids: string[] = [];
  const names: string[] = [];
  const extra: string[] = [];
  for (const p of parts) {
    // No push(...p.ids): a 25,000-row chunk overflows the call stack.
    for (let i = 0; i < p.ids.length; i++) {
      ids.push(p.ids[i]!);
      names.push(p.names[i]!);
      extra.push(p.extra[i]!);
    }
  }
  const size = ids.length;
  const sources = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    for (let i = 0; i < p.ids.length; i++) {
      const s = typeof p.source === 'string' ? p.source : (p.source[i] ?? 'generic');
      sources[at++] = Math.max(0, SOURCES.indexOf(s));
    }
  }
  const counts = new Map<string, number>();
  for (let e = 0; e < size; e++) {
    for (const w of wordsOf(names[e]!, extra[e]!)) counts.set(w, (counts.get(w) ?? 0) + 1);
    if (e % slice === slice - 1) yield;
  }
  const words = [...counts.keys()].sort();
  const wordId = new Map<string, number>();
  const starts = new Uint32Array(words.length + 1);
  words.forEach((w, i) => {
    wordId.set(w, i);
    starts[i + 1] = starts[i]! + counts.get(w)!;
  });
  counts.clear();
  yield;
  const postings = new Uint32Array(starts[words.length]!);
  const cursor = starts.slice(0, words.length);
  for (let e = 0; e < size; e++) {
    for (const w of wordsOf(names[e]!, extra[e]!)) postings[cursor[wordId.get(w)!]!++] = e;
    if (e % slice === slice - 1) yield;
  }
  return { size, ids, names, extra, sources, words, starts, postings };
}

export function buildFoodIndex(parts: SearchColumns | SearchColumns[] | SearchableFood[]): FoodIndex {
  const steps = buildSteps(asParts(parts), Number.MAX_SAFE_INTEGER);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

/** Same index, built in slices with `pause()` between them (a big library on a phone). */
export async function buildFoodIndexAsync(
  parts: SearchColumns[],
  pause: () => Promise<void>,
  slice = NUTRITION.search.buildSlice,
): Promise<FoodIndex> {
  const steps = buildSteps(parts, slice);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
    await pause();
  }
}

function asParts(parts: SearchColumns | SearchColumns[] | SearchableFood[]): SearchColumns[] {
  if (!Array.isArray(parts)) return [parts];
  if (parts.length && 'name' in parts[0]!) return [toColumns(parts as SearchableFood[])];
  return parts as SearchColumns[];
}

function lowerBound(words: string[], q: string): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid]! < q) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * True when `a` and the first `bLen` letters of `b` are at most one edit apart (substitution,
 * insertion, deletion or swap of neighbours): `editDistance(a, b.slice(0, bLen)) <= 1` without the
 * allocation, so it can run over every word in the index.
 */
export function withinOneEdit(a: string, b: string, bLen = b.length): boolean {
  const la = a.length;
  const lb = Math.min(bLen, b.length);
  if (la - lb > 1 || lb - la > 1) return false;
  let i = 0;
  while (i < la && i < lb && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  if (i === la && i === lb) return true;
  const same = (ai: number, bi: number) => {
    if (la - ai !== lb - bi) return false;
    for (; ai < la; ai++, bi++) if (a.charCodeAt(ai) !== b.charCodeAt(bi)) return false;
    return true;
  };
  if (la === lb)
    return same(i + 1, i + 1) || (i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && same(i + 2, i + 2));
  return la > lb ? same(i + 1, i) : same(i, i + 1);
}

/** Marks foods with a word that starts with `w` (2) or, for 3+ letters, is one typo away (1). */
function mark(index: FoodIndex, w: string, out: Uint8Array, fuzzyBelow: number): number {
  let exact = 0;
  const first = lowerBound(index.words, w);
  for (let i = first; i < index.words.length && index.words[i]!.startsWith(w); i++)
    for (let p = index.starts[i]!; p < index.starts[i + 1]!; p++) {
      if (out[index.postings[p]!] !== 2) exact++;
      out[index.postings[p]!] = 2;
    }
  if (w.length < 3 || exact >= fuzzyBelow) return exact;
  const len = w.length;
  for (let i = 0; i < index.words.length; i++) {
    const word = index.words[i]!;
    if (word.length < len - 1) continue;
    const near =
      (word.length <= len + 1 && withinOneEdit(w, word)) || (len >= 4 && withinOneEdit(w, word, len));
    if (!near || word.startsWith(w)) continue;
    for (let p = index.starts[i]!; p < index.starts[i + 1]!; p++)
      if (out[index.postings[p]!] === 0) out[index.postings[p]!] = 1;
  }
  return exact;
}

export interface FoodHit {
  id: string;
  source: FoodSource;
  score: number;
}

export interface SearchOptions {
  limit?: number;
  boost?: (id: string) => number;
  /** Keep only these foods (a tab), applied before the limit. */
  filter?: (id: string, source: FoodSource) => boolean;
  fuzzyBelow?: number;
}

interface Scored extends FoodHit {
  len: number;
  name: string;
}

/** One index's hits: entry numbers and their scores, in typed arrays (no object per hit). */
interface Pool {
  index: FoodIndex;
  entries: Uint32Array;
  scores: Float64Array;
}

function searchOne(index: FoodIndex, q: string, qWords: string[], opts: SearchOptions): Pool | null {
  if (!index.size) return null;
  const fuzzyBelow = opts.fuzzyBelow ?? NUTRITION.search.fuzzyBelow;
  // clean[k]: 1 = every word so far matched without a typo, 0 = with a typo.
  let pool: Uint32Array | null = null;
  let clean = new Uint8Array(0);
  for (const w of qWords) {
    const m = new Uint8Array(index.size);
    mark(index, w, m, fuzzyBelow);
    if (!pool) {
      let n = 0;
      for (let e = 0; e < index.size; e++) if (m[e]) n++;
      pool = new Uint32Array(n);
      clean = new Uint8Array(n);
      n = 0;
      for (let e = 0; e < index.size; e++)
        if (m[e]) {
          pool[n] = e;
          clean[n++] = m[e] === 2 ? 1 : 0;
        }
    } else {
      let n = 0;
      for (let k = 0; k < pool.length; k++) {
        const e = pool[k]!;
        if (!m[e]) continue;
        pool[n] = e;
        clean[n++] = clean[k]! & (m[e] === 2 ? 1 : 0);
      }
      pool = pool.subarray(0, n);
    }
    if (!pool.length) return null;
  }
  const boost = opts.boost ?? (() => 0);
  const scores = new Float64Array(pool!.length);
  let n = 0;
  for (let k = 0; k < pool!.length; k++) {
    const e = pool![k]!;
    const id = index.ids[e]!;
    if (opts.filter && !opts.filter(id, SOURCES[index.sources[e]!]!)) continue;
    const name = index.names[e]!;
    const ok = clean[k] === 1;
    let score: number;
    if (name === q) score = 100;
    else if (ok && name.startsWith(q)) score = 90;
    else if (ok && qWords.every((w) => name.startsWith(w) || name.includes(` ${w}`))) score = 80;
    else if (ok)
      score = 65; // matched through brand or alias words
    else score = 45; // a typo somewhere
    pool![n] = e;
    scores[n++] = score + boost(id);
  }
  return n ? { index, entries: pool!.subarray(0, n), scores: scores.subarray(0, n) } : null;
}

const byRank = (a: Scored, b: Scored) =>
  b.score - a.score || a.len - b.len || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** The value (in `order`) at which `need` items have been counted: a cut that keeps at least `need`. */
function cutAt(values: number[], need: number, order: (a: number, b: number) => number): number {
  const per = new Map<number, number>();
  for (const v of values) per.set(v, (per.get(v) ?? 0) + 1);
  let n = 0;
  let cut = 0;
  for (const v of [...per.keys()].sort(order)) {
    n += per.get(v)!;
    cut = v;
    if (n >= need) break;
  }
  return cut;
}

/**
 * The best `limit` hits without sorting or even creating all of them: cut at the score the limit
 * falls on (scores are a few integers); with many ties there (a one-letter query), cut those again
 * by name length; only the survivors become objects and get sorted.
 */
function top(pools: Pool[], limit: number): Scored[] {
  const total = pools.reduce((s, p) => s + p.entries.length, 0);
  let minScore = -Infinity;
  let maxTiedLen = Infinity;
  if (total > limit * 4) {
    const all: number[] = [];
    for (const p of pools) for (const sc of p.scores) all.push(sc);
    minScore = cutAt(all, limit, (a, b) => b - a);
    const above = all.filter((sc) => sc > minScore).length;
    const tiedLens: number[] = [];
    for (const p of pools)
      p.scores.forEach((sc, k) => {
        if (sc === minScore) tiedLens.push(p.index.names[p.entries[k]!]!.length);
      });
    if (tiedLens.length > limit * 4) maxTiedLen = cutAt(tiedLens, limit - above, (a, b) => a - b);
  }
  const out: Scored[] = [];
  for (const p of pools)
    p.scores.forEach((score, k) => {
      if (score < minScore) return;
      const e = p.entries[k]!;
      const name = p.index.names[e]!;
      if (score === minScore && name.length > maxTiedLen) return;
      out.push({ id: p.index.ids[e]!, source: SOURCES[p.index.sources[e]!]!, score, len: name.length, name });
    });
  return out.sort(byRank).slice(0, limit);
}

export function searchFoods(
  index: FoodIndex | (FoodIndex | null)[],
  query: string,
  opts: SearchOptions = {},
): FoodHit[] {
  const q = normalize(query);
  if (!q) return [];
  const qWords = q.split(' ');
  const indexes = (Array.isArray(index) ? index : [index]).filter((x): x is FoodIndex => !!x);
  const pools = indexes.map((ix) => searchOne(ix, q, qWords, opts)).filter((p): p is Pool => !!p);
  return top(pools, opts.limit ?? 50).map(({ id, source, score }) => ({ id, source, score }));
}

/** Foods of one source by name, A to Z (the Generic / Indian / Mine tabs without a query). */
export function listFoods(index: FoodIndex | null, source: FoodSource, limit = 100): FoodHit[] {
  if (!index) return [];
  const code = SOURCES.indexOf(source);
  const out: Scored[] = [];
  for (let e = 0; e < index.size; e++)
    if (index.sources[e] === code)
      out.push({ id: index.ids[e]!, source, score: 0, len: 0, name: index.names[e]! });
  return out
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, limit)
    .map(({ id, score }) => ({ id, source, score }));
}

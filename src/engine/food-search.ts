/**
 * PRD-1.2 FR-FOOD-3, NFR-PERF-5: food search over the whole library (~30,000 rows) in under 150 ms.
 * Same matching as the exercise search (FR-LIB-3: case/punctuation-insensitive, prefix, one typo per
 * word) plus brand and alias words. An inverted word index finds candidates first, so a query only
 * scores the foods that can match. Own, favourite and frequent foods rank first via `boost`.
 */
import { editDistance, normalize } from './search';

export interface SearchableFood {
  id: string;
  name: string;
  brand?: string;
  aliases: string[];
}

/** Normalised search words for a food (also the Dexie `terms` multi-entry index). */
export function foodTerms(f: SearchableFood): string[] {
  const words = new Set<string>();
  for (const s of [f.name, f.brand ?? '', ...f.aliases])
    for (const w of normalize(s).split(' ')) if (w) words.add(w);
  return [...words];
}

interface Entry<T> {
  food: T;
  name: string;
  nameWords: string[];
  otherWords: string[];
}

export interface FoodIndex<T extends SearchableFood> {
  entries: Entry<T>[];
  /** Sorted unique words, each with the entries that contain it. */
  words: string[];
  postings: number[][];
}

export function buildFoodIndex<T extends SearchableFood>(foods: T[]): FoodIndex<T> {
  const entries: Entry<T>[] = foods.map((food) => {
    const name = normalize(food.name);
    const nameWords = name.split(' ').filter(Boolean);
    const otherWords = foodTerms(food).filter((w) => !nameWords.includes(w));
    return { food, name, nameWords, otherWords };
  });
  const map = new Map<string, number[]>();
  entries.forEach((e, i) => {
    for (const w of new Set([...e.nameWords, ...e.otherWords])) {
      const list = map.get(w);
      if (list) list.push(i);
      else map.set(w, [i]);
    }
  });
  const words = [...map.keys()].sort();
  return { entries, words, postings: words.map((w) => map.get(w)!) };
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

/** Entries with a word that starts with `w` or (for 3+ letters) is one typo away from it. */
function candidates<T extends SearchableFood>(
  index: FoodIndex<T>,
  w: string,
): { exact: Set<number>; fuzzy: Set<number> } {
  const exact = new Set<number>();
  const fuzzy = new Set<number>();
  for (let i = lowerBound(index.words, w); i < index.words.length && index.words[i]!.startsWith(w); i++)
    for (const e of index.postings[i]!) exact.add(e);
  if (w.length >= 3) {
    index.words.forEach((word, i) => {
      if (word.startsWith(w)) return;
      const near =
        editDistance(w, word) <= 1 || (w.length >= 4 && editDistance(w, word.slice(0, w.length)) <= 1);
      if (near) for (const e of index.postings[i]!) if (!exact.has(e)) fuzzy.add(e);
    });
  }
  return { exact, fuzzy };
}

export interface FoodHit<T> {
  food: T;
  score: number;
}

export function searchFoods<T extends SearchableFood>(
  index: FoodIndex<T>,
  query: string,
  opts: { limit?: number; boost?: (id: string) => number } = {},
): FoodHit<T>[] {
  const q = normalize(query);
  if (!q) return [];
  const qWords = q.split(' ');
  let pool: Map<number, boolean> | null = null; // entry → every word matched without a typo
  for (const w of qWords) {
    const { exact, fuzzy } = candidates(index, w);
    const next = new Map<number, boolean>();
    const consider = (e: number, clean: boolean) => {
      if (pool && !pool.has(e)) return;
      next.set(e, clean && (pool ? pool.get(e)! : true));
    };
    exact.forEach((e) => consider(e, true));
    fuzzy.forEach((e) => consider(e, false));
    pool = next;
    if (!pool.size) return [];
  }
  const boost = opts.boost ?? (() => 0);
  const hits: (FoodHit<T> & { len: number })[] = [];
  for (const [i, clean] of pool!) {
    const e = index.entries[i]!;
    let score: number;
    if (e.name === q) score = 100;
    else if (clean && e.name.startsWith(q)) score = 90;
    else if (clean && qWords.every((w) => e.nameWords.some((nw) => nw.startsWith(w)))) score = 80;
    else if (clean)
      score = 65; // matched through brand or alias words
    else score = 45; // a typo somewhere
    hits.push({ food: e.food, score: score + boost(e.food.id), len: e.name.length });
  }
  hits.sort((a, b) => b.score - a.score || a.len - b.len || a.food.name.localeCompare(b.food.name));
  return hits.slice(0, opts.limit ?? 50).map(({ food, score }) => ({ food, score }));
}

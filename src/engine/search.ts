/**
 * FR-LIB-3: search names and aliases, case- and punctuation-insensitive, prefix and fuzzy
 * (tolerates one typo). NFR-PERF-4: under 100 ms for 600 exercises; the index is built once.
 */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Damerau–Levenshtein distance capped at max+1 (optimal string alignment). */
export function editDistance(a: string, b: string, max = 1): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n]!;
}

interface Entry<T> {
  item: T;
  order: number;
  name: string;
  terms: { text: string; compact: string; words: string[]; isAlias: boolean }[];
}

export interface SearchIndex<T> {
  entries: Entry<T>[];
}

export function buildIndex<T>(
  items: T[],
  name: (t: T) => string,
  aliases: (t: T) => string[],
): SearchIndex<T> {
  return {
    entries: items.map((item, order) => {
      const terms = [name(item), ...aliases(item)].map((raw, i) => {
        const text = normalize(raw);
        return {
          text,
          compact: text.replace(/ /g, ''),
          words: text.split(' ').filter(Boolean),
          isAlias: i > 0,
        };
      });
      return { item, order, name: normalize(name(item)), terms };
    }),
  };
}

export interface SearchHit<T> {
  item: T;
  score: number;
  order: number;
  /** The alias that matched, when the match came from an alias. */
  viaAlias?: string;
}

function scoreTerm(
  q: string,
  qCompact: string,
  qWords: string[],
  t: Entry<unknown>['terms'][number],
): number {
  if (t.text === q || t.compact === qCompact) return 100;
  if (t.text.startsWith(q) || t.compact.startsWith(qCompact)) return 90;
  // Every query word is a prefix of some term word ("inc db" → "incline db press").
  if (qWords.every((w) => t.words.some((tw) => tw.startsWith(w)))) return 80;
  if (qCompact.length >= 3 && t.compact.includes(qCompact)) return 60;
  // One typo per word: against the whole word, or against a same-length prefix of it.
  const wordMatches = (w: string) =>
    t.words.some(
      (tw) =>
        tw.startsWith(w) ||
        (w.length >= 3 && editDistance(w, tw) <= 1) ||
        (w.length >= 4 && editDistance(w, tw.slice(0, w.length)) <= 1),
    );
  if (qWords.every(wordMatches)) return 45;
  if (qCompact.length >= 4 && editDistance(qCompact, t.compact.slice(0, qCompact.length)) <= 1) return 40;
  return 0;
}

export function search<T>(index: SearchIndex<T>, query: string, limit = Infinity): SearchHit<T>[] {
  const q = normalize(query);
  if (!q) return [];
  const qCompact = q.replace(/ /g, '');
  const qWords = q.split(' ');
  const hits: SearchHit<T>[] = [];
  for (const e of index.entries) {
    let best = 0;
    let via: string | undefined;
    for (const t of e.terms) {
      const s = scoreTerm(q, qCompact, qWords, t) - (t.isAlias ? 5 : 0);
      if (s > best) {
        best = s;
        via = t.isAlias ? t.text : undefined;
      }
    }
    if (best > 0) hits.push({ item: e.item, score: best, order: e.order, viaAlias: via });
  }
  hits.sort((a, b) => b.score - a.score || a.order - b.order);
  return hits.slice(0, limit);
}

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import type { BodyweightRow, DiaryRow, ProfileRow, SessionRow } from '@/db/types';
import { getRawSetting } from '@/db/settings';
import { LIBRARY_MANIFEST, libraryFoods, librarySearchParts, ownFoods, searchKey } from '@/db/food-lib';
import { frequentFoodIds, recentFoodIds } from '@/db/food';
import { energyTarget, ageFrom, type DietPhase, type EnergyTarget } from '@/engine/energy';
import { applyOverrides, macroTargets, type MacroOverrides, type Overridden } from '@/engine/macros';
import { microTargets, type MicroTargets } from '@/engine/micros';
import { sumNutrients, type Totals } from '@/engine/nutrition';
import type { DayTargets } from '@/engine/food-review';
import { buildFoodIndex, buildFoodIndexAsync, toColumns, type FoodIndex } from '@/engine/food-search';
import { usualTrainingTime } from '@/engine/training-link';
import { foodStreak } from '@/engine/food-quests';
import type { FoodItem } from '@/engine/food-types';
import type { GoalKind } from '@/engine/types';
import { NUTRITION } from '@/engine/food-data';
import { normalize } from '@/engine/search';
import { addDays, dateKey, parseDateKey } from '@/engine/week';

/** Settings keys owned by the Food section. */
export const FOOD_KEYS = { overrides: 'foodOverrides', carbCycling: 'foodCarbCycling' } as const;

/**
 * Without a chosen phase: build muscle → slow gain, everything else → maintain (D115). The user
 * changes it on Targets (F05).
 */
export function defaultPhase(goal: GoalKind): { phase: DietPhase; rateKgPerWeek: number } {
  const phase: DietPhase = goal === 'build_muscle' ? 'gain' : 'maintain';
  return { phase, rateKgPerWeek: NUTRITION.phase.defaultRate[phase] };
}

/** The weigh-in on or before `date`; before the first one, the first one; none → null. */
export function weightOn(date: string, weighIns: Pick<BodyweightRow, 'date' | 'kg'>[]): number | null {
  if (!weighIns.length) return null;
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const before = sorted.filter((w) => w.date <= date);
  return (before[before.length - 1] ?? sorted[0]!).kg;
}

export interface FoodTargets {
  energy: EnergyTarget;
  macros: Overridden;
  micros: MicroTargets;
  day: DayTargets;
  phase: DietPhase;
  rateKgPerWeek: number;
  weightKg: number;
  age: number | null;
}

export interface TargetContext {
  profile: ProfileRow;
  weighIns: Pick<BodyweightRow, 'date' | 'kg'>[];
  /** null: carb cycling off or unknown day. */
  trainingDay: boolean | null;
  overrides: MacroOverrides;
  now: number;
}

/** FR-TGT-1..4, FR-TGT-6: the full targets for one date, from the shared profile and weigh-ins. */
export function targetsFor(date: string, c: TargetContext): FoodTargets | null {
  const weightKg = weightOn(date, c.weighIns);
  if (weightKg === null) return null;
  const p = c.profile;
  const d = defaultPhase(p.goal);
  const phase = p.diet?.phase ?? d.phase;
  const rateKgPerWeek = p.diet ? p.diet.rateKgPerWeek : d.rateKgPerWeek;
  const sex = p.sex === 'male' || p.sex === 'female' ? p.sex : undefined;
  const energy = energyTarget({
    weightKg,
    sex,
    birthYear: p.birthYear,
    heightCm: p.heightCm,
    activity: p.activity,
    sessionsPerWeek: p.daysPerWeek,
    phase,
    rateKgPerWeek,
    now: c.now,
  });
  const base = macroTargets({ kcal: energy.kcal, weightKg, goal: p.goal, phase, trainingDay: c.trainingDay });
  const macros = applyOverrides(base, c.overrides);
  const age = ageFrom(p.birthYear, c.now);
  const micros = microTargets({ sex, age, kcal: macros.kcal });
  return { energy, macros, micros, day: { ...macros, micros }, phase, rateKgPerWeek, weightKg, age };
}

export function useToday(): string {
  const [today, setToday] = useState(() => dateKey(Date.now()));
  useEffect(() => {
    const t = window.setInterval(() => setToday(dateKey(Date.now())), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return today;
}

export function shiftDate(date: string, days: number): string {
  return dateKey(addDays(parseDateKey(date).getTime() + 12 * 3_600_000, days));
}

/** Finished and open sessions, oldest first (what Food reads from LiftLog, FR-COACH-3). */
export function useSessions(): SessionRow[] | undefined {
  return useLiveQuery(() => db.sessions.orderBy('startedAt').toArray(), []);
}

export function useFoodTargets(date: string): { targets: FoodTargets | null; loading: boolean } {
  const data = useLiveQuery(async () => {
    const [profile, weighIns, overrides, cycling, sessions] = await Promise.all([
      db.profile.get('me'),
      db.bodyweights.toArray(),
      getRawSetting<MacroOverrides>(FOOD_KEYS.overrides),
      getRawSetting<boolean>(FOOD_KEYS.carbCycling),
      db.sessions
        .where('startedAt')
        .between(parseDateKey(date).getTime(), parseDateKey(shiftDate(date, 1)).getTime())
        .count(),
    ]);
    return { profile, weighIns, overrides: overrides ?? {}, cycling: !!cycling, trained: sessions > 0 };
  }, [date]);
  return useMemo(() => {
    if (!data) return { targets: null, loading: true };
    if (!data.profile) return { targets: null, loading: false };
    return {
      loading: false,
      targets: targetsFor(date, {
        profile: data.profile,
        weighIns: data.weighIns,
        // D116: a day counts as a training day once a LiftLog session started on it.
        trainingDay: data.cycling ? data.trained : null,
        overrides: data.overrides,
        now: Date.now(),
      }),
    };
  }, [data, date]);
}

export interface DayData {
  entries: DiaryRow[];
  totals: Totals;
  byMeal: Record<string, DiaryRow[]>;
}

export function useDay(date: string): DayData | undefined {
  return useLiveQuery(async () => {
    const entries = (await db.diary.where('date').equals(date).toArray()).sort(
      (a, b) => a.loggedAt - b.loggedAt,
    );
    const byMeal: Record<string, DiaryRow[]> = {};
    for (const e of entries) (byMeal[e.meal] ??= []).push(e);
    return { entries, totals: sumNutrients(entries), byMeal };
  }, [date]);
}

/** FR-GAME-1 food streak, from the last 60 days of the diary. */
export function useFoodStreak(today: string): number {
  return (
    useLiveQuery(async () => {
      const from = shiftDate(today, -60);
      const meals = new Map<string, Set<string>>();
      await db.diary
        .where('date')
        .aboveOrEqual(from)
        .each((e) => {
          const s = meals.get(e.date) ?? new Set<string>();
          s.add(e.meal);
          meals.set(e.date, s);
        });
      const counts = new Map([...meals].map(([d, s]) => [d, s.size]));
      return foodStreak(counts, today, (d) => shiftDate(d, -1));
    }, [today]) ?? 0
  );
}

/** Usual training time in minutes after midnight, or null (D104). */
export function useUsualTrainingTime(): number | null {
  const sessions = useSessions();
  return useMemo(() => (sessions ? usualTrainingTime(sessions, Date.now()) : null), [sessions]);
}

export interface FoodSearch {
  /** The library index (null while it builds) and the own-foods index, for `searchFoods`. */
  indexes: (FoodIndex | null)[];
  libIndex: FoodIndex | null;
  ownIndex: FoodIndex;
  /** The user's own (non-deleted) foods by id. */
  own: Map<string, FoodItem>;
  boost: (id: string) => number;
  recent: string[];
  /** The core library is imported (FR-FOOD-2). */
  libraryReady: boolean;
  /** FR-FOOD-8: catalogue shards imported so far, while the catalogue is still downloading. */
  catalogue: { done: number; total: number } | null;
}

let libCache: { key: string; index: Promise<FoodIndex> } | null = null;
const paint = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * FR-FOOD-3, FR-FOOD-8: the in-memory search indexes. The library index is built from the stored
 * search columns, in slices so the screen stays responsive, once when the core library is in and
 * once more when the whole catalogue is (D121); the own-foods index follows every edit. Own,
 * frequent and recent foods rank first.
 */
export function useFoodSearch(today: string): FoodSearch {
  const sig = useLiveQuery(async () => {
    const [keys, own] = await Promise.all([
      db.foodSearch.toCollection().primaryKeys() as Promise<string[]>,
      ownFoods(),
    ]);
    // What is imported is read from the library itself (D122).
    const shardKeys = new Set(
      (LIBRARY_MANIFEST?.catalogue?.shards ?? []).map((s) => searchKey(LIBRARY_MANIFEST!.v, s.file)),
    );
    const shardsDone = keys.filter((k) => shardKeys.has(k)).length;
    const core = keys.filter((k) => !shardKeys.has(k));
    const ready = core.length > 0;
    return {
      // Rebuilt as core chunks arrive and once more when the whole catalogue is in.
      libKey: ready ? `${core.join(',')}|${shardsDone === shardKeys.size ? 'all' : 'core'}` : '',
      own,
      ready,
      catalogue: ready && shardsDone < shardKeys.size ? { done: shardsDone, total: shardKeys.size } : null,
    };
  }, []);
  const ranks = useLiveQuery(
    async () => ({ frequent: await frequentFoodIds(today), recent: await recentFoodIds(30) }),
    [today],
  );
  const [lib, setLib] = useState<{ key: string; index: FoodIndex } | null>(null);
  useEffect(() => {
    const key = sig?.libKey;
    if (!key || lib?.key === key) return;
    if (libCache?.key !== key)
      libCache = { key, index: librarySearchParts().then((parts) => buildFoodIndexAsync(parts, paint)) };
    let alive = true;
    void libCache.index.then((index) => alive && setLib({ key, index }));
    return () => {
      alive = false;
    };
  }, [sig?.libKey, lib?.key]);
  const ownList = sig?.own;
  const { own, ownIndex } = useMemo(
    () => ({
      own: new Map((ownList ?? []).map((f) => [f.id, f])),
      ownIndex: buildFoodIndex(toColumns(ownList ?? [], 'custom')),
    }),
    [ownList],
  );
  const boost = useMemo(() => {
    const freq = new Map((ranks?.frequent ?? []).map((id, i) => [id, 25 - Math.min(i, 20)]));
    const rec = new Set(ranks?.recent ?? []);
    return (id: string) => (id.startsWith('c:') ? 30 : 0) + (freq.get(id) ?? 0) + (rec.has(id) ? 5 : 0);
  }, [ranks]);
  // While a bigger index builds, the previous one keeps answering.
  const libIndex = lib?.index ?? null;
  return {
    indexes: [libIndex, ownIndex],
    libIndex,
    ownIndex,
    own,
    boost,
    recent: ranks?.recent ?? [],
    libraryReady: sig?.ready ?? false,
    catalogue: sig?.catalogue ?? null,
  };
}

/**
 * FR-FOOD-8 (D121): the indexes a query searches. A one-letter query would score ~300,000 library
 * foods for results nobody wants ("Cod", "Chai"), so the library joins from the second letter.
 */
export function indexesFor(search: Pick<FoodSearch, 'libIndex' | 'ownIndex'>, q: string): FoodIndex[] {
  const lib = normalize(q).length >= NUTRITION.search.minLibraryChars ? search.libIndex : null;
  return lib ? [lib, search.ownIndex] : [search.ownIndex];
}

/**
 * The foods behind search hits or ids, in order: own foods from memory, library foods from
 * IndexedDB (only the few on screen). Keeps the last list while the next one loads.
 */
export function useFoodsById(ids: string[], own: Map<string, FoodItem>): FoodItem[] {
  const key = ids.join(',');
  const [state, setState] = useState<{ key: string; foods: FoodItem[] }>({ key: '', foods: [] });
  useEffect(() => {
    let alive = true;
    const list = key ? key.split(',') : [];
    void libraryFoods(list.filter((id) => !own.has(id))).then((lib) => {
      const byId = new Map(lib.map((f) => [f.id, f]));
      const foods = list.map((id) => own.get(id) ?? byId.get(id)).filter((f): f is FoodItem => !!f);
      if (alive) setState({ key, foods });
    });
    return () => {
      alive = false;
    };
  }, [key, own]);
  return key ? state.foods : [];
}

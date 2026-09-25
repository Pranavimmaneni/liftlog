/**
 * PRD §6.6 / FR-STR-1…3: strength levels from the benchmark lifts in standards.json only.
 * Ratio = best e1RM of the last 8 weeks ÷ bodyweight (pull-ups: best reps). Thresholds by sex × age.
 * Bar segment k fills when threshold k is reached; the marker sits in the first unreached segment
 * (DECISIONS D59). ETA from the linear e1RM slope over the last 6 weeks.
 */
import { STANDARDS } from './data';
import { DAY_MS } from './week';
import type { MuscleGroup } from './types';

export type Sex = 'male' | 'female' | 'unspecified';

/** Benchmark key → exercises that count for it (DECISIONS D60). */
export const BENCHMARK_EXERCISES: Record<string, string[]> = {
  back_squat: ['back-squat'],
  bench_press: ['bench-press', 'bench-press-powerlifting'],
  incline_db_press_per_hand: ['incline-dumbbell-press'],
  deadlift: ['deadlift'],
  romanian_deadlift: ['romanian-deadlift'],
  overhead_press: ['overhead-press', 'barbell-shoulder-press'],
  barbell_row: ['bent-over-barbell-row'],
  pull_up_reps: ['pull-up', 'chin-up'],
};

/** Display groups for S11, in mockup order. */
export const STRENGTH_GROUPS: {
  id: 'chest' | 'back' | 'legs' | 'hinge' | 'shoulders';
  benchmarks: string[];
}[] = [
  { id: 'chest', benchmarks: ['bench_press', 'incline_db_press_per_hand'] },
  { id: 'back', benchmarks: ['pull_up_reps', 'barbell_row'] },
  { id: 'legs', benchmarks: ['back_squat'] },
  { id: 'hinge', benchmarks: ['deadlift', 'romanian_deadlift'] },
  { id: 'shoulders', benchmarks: ['overhead_press'] },
];

/** Muscles that make a group count as "trained" for the machine-only card (FR-STR-2). */
export const GROUP_MUSCLES: Record<(typeof STRENGTH_GROUPS)[number]['id'], MuscleGroup[]> = {
  chest: ['chest'],
  back: ['lats', 'upper back'],
  legs: ['quads'],
  hinge: ['hamstrings'],
  shoulders: ['shoulders'],
};

export function isRepsBenchmark(key: string): boolean {
  return STANDARDS.benchmarks[key]?.unit === 'bodyweight reps';
}

export function ageFactor(birthYear: number | undefined, now: number): number {
  if (!birthYear) return 1;
  const age = new Date(now).getFullYear() - birthYear;
  const a = STANDARDS.ageAdjust as Record<string, number>;
  if (age < 18) return a.under_18!;
  if (age < 40) return a['18_39']!;
  if (age < 50) return a['40_49']!;
  if (age < 60) return a['50_59']!;
  if (age < 70) return a['60_69']!;
  return a['70_plus']!;
}

/**
 * Band thresholds for a benchmark. "Prefer not to say" uses the lower of the two band sets (S19).
 * Rep benchmarks (pull-ups) are not age-adjusted: a rep count can't be scaled meaningfully.
 */
export function thresholds(key: string, sex: Sex, birthYear: number | undefined, now: number): number[] {
  const b = STANDARDS.benchmarks[key]!;
  const base =
    sex === 'male' ? b.male : sex === 'female' ? b.female : b.male.map((m, i) => Math.min(m, b.female[i]!));
  const k = isRepsBenchmark(key) ? 1 : ageFactor(birthYear, now);
  return base.map((t) => Math.round(t * k * 1000) / 1000);
}

export interface Level {
  /** Highest band reached (-1 = below the first threshold). */
  reached: number;
  /** Segment the marker sits in (= reached + 1, capped at the last band). */
  segment: number;
  /** 0…1 position inside that segment. */
  position: number;
  /** Next band index to reach, or null at the top. */
  next: number | null;
}

export function levelFor(value: number, t: number[]): Level {
  let reached = -1;
  for (let i = 0; i < t.length; i++) if (value >= t[i]!) reached = i;
  if (reached === t.length - 1) return { reached, segment: reached, position: 1, next: null };
  const segment = reached + 1;
  const lo = reached < 0 ? 0 : t[reached]!;
  const hi = t[segment]!;
  const position = hi > lo ? Math.max(0, Math.min(1, (value - lo) / (hi - lo))) : 0;
  return { reached, segment, position, next: segment };
}

export interface Point {
  at: number;
  value: number;
}

/** Least-squares slope in value per week (null with < 2 points or no time spread). */
export function weeklySlope(points: Point[]): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.at / (7 * DAY_MS));
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export type Eta = { weeks: number } | { months: number } | null;

/** §6.6: "~N weeks", "~N months" past 12 weeks, or null ("Keep logging…") when not improving. */
export function eta(current: number, target: number, slopePerWeek: number | null): Eta {
  if (slopePerWeek === null || slopePerWeek <= 0 || target <= current) return null;
  const weeks = Math.ceil((target - current) / slopePerWeek);
  return weeks > 12 ? { months: Math.round(weeks / 4.345) } : { weeks };
}

export interface BenchmarkResult {
  key: string;
  exerciseId: string;
  /** e1RM in kg (per hand for dumbbells) or reps for pull-ups. */
  best: number;
  ratio: number;
  thresholds: number[];
  level: Level;
  /** Next milestone in the benchmark's own unit (kg e1RM or reps). */
  nextValue: number | null;
  eta: Eta;
}

export interface BenchmarkInput {
  key: string;
  exerciseId: string;
  /** Per-session best (e1RM kg, or reps for rep benchmarks), any age. */
  points: Point[];
}

const EIGHT_WEEKS = 56 * DAY_MS;
const SIX_WEEKS = 42 * DAY_MS;

export function benchmarkResult(
  input: BenchmarkInput,
  body: { sex: Sex; birthYear?: number; bodyweightKg: number },
  now: number,
): BenchmarkResult | null {
  const recent = input.points.filter((p) => p.at >= now - EIGHT_WEEKS && p.at <= now);
  if (!recent.length) return null;
  const reps = isRepsBenchmark(input.key);
  const best = Math.max(...recent.map((p) => p.value));
  const t = thresholds(input.key, body.sex, body.birthYear, now);
  const ratio = reps ? best : best / body.bodyweightKg;
  const level = levelFor(ratio, t);
  const nextValue = level.next === null ? null : reps ? t[level.next]! : t[level.next]! * body.bodyweightKg;
  const slope = weeklySlope(input.points.filter((p) => p.at >= now - SIX_WEEKS && p.at <= now));
  return {
    key: input.key,
    exerciseId: input.exerciseId,
    best,
    ratio,
    thresholds: t,
    level,
    nextValue,
    eta: nextValue === null ? null : eta(best, nextValue, slope),
  };
}

/** The benchmark to show for a group: the one furthest along (highest band + position). */
export function pickGroupResult(results: BenchmarkResult[]): BenchmarkResult | null {
  if (!results.length) return null;
  const score = (r: BenchmarkResult) => r.level.reached + 1 + (r.level.next === null ? 1 : r.level.position);
  return [...results].sort((a, b) => score(b) - score(a))[0]!;
}

/** Overall label for S12's "Strength" card: the median group's band, "+" when past halfway. */
export function overallLevel(
  results: BenchmarkResult[],
): { band: number; plus: boolean; next: number | null } | null {
  if (!results.length) return null;
  const sorted = [...results].sort(
    (a, b) => a.level.reached + a.level.position / 2 - (b.level.reached + b.level.position / 2),
  );
  const mid = sorted[Math.floor((sorted.length - 1) / 2)]!;
  return {
    band: mid.level.reached,
    plus: mid.level.next !== null && mid.level.position >= 0.5,
    next: mid.level.next,
  };
}

export function isGuidelineSource(source: string): boolean {
  return !source.trim() || source.trim().toUpperCase().startsWith('TODO');
}

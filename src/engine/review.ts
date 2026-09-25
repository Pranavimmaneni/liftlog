/**
 * FR-REV-1/2/3: weekly and monthly review numbers, the rule-based insights of PRD §6.7 and the
 * recomp check of §6.8. Pure: the db layer gathers the inputs.
 */
import { INTENSITY } from './data';
import { weeklySlope, type Point } from './strength';
import { MUSCLE_GROUPS, type Exercise, type GoalKind, type MuscleGroup, type SetKind } from './types';

/** Hard sets actually done per muscle: work sets count 1 for primary, 0.5 for secondary (§6.5). */
export function hardSetsByMuscle(
  sets: { exerciseId: string; kind: SetKind }[],
  exercises: Map<string, Exercise>,
): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map((m) => [m, 0]));
  for (const s of sets) {
    if (s.kind === 'warmup') continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    for (const m of ex.primary) out.set(m, out.get(m)! + 1);
    for (const m of ex.secondary) out.set(m, out.get(m)! + INTENSITY.secondaryMuscleSetWeight);
  }
  return out;
}

// ---------- §6.7 insights ----------

export interface InsightInput {
  sessionsDone: number;
  sessionsPlanned: number;
  goalSetsMet: number;
  goalSetsTotal: number;
  newPrs: number;
  /** e1RM change over the last 4 weeks for benchmark lifts that have data (fraction, 0.05 = +5%). */
  benchmarkChanges: { exerciseId: string; change: number; weeks: number }[];
  /** Hard sets done per muscle in the period, with the weekly target lower bound (scaled to the period). */
  muscleSets: { muscle: MuscleGroup; sets: number; target: number }[];
  /** Exercises whose last 3 exposures didn't move the target. */
  stalled: string[];
  /** Exercises with a "Hurts" flag in the period. */
  hurts: string[];
}

export type GoingWell =
  | { code: 'e1rm_up'; exerciseId: string; pct: number; weeks: number }
  | { code: 'all_sessions'; done: number }
  | { code: 'goal_rate'; pct: number }
  | { code: 'prs'; count: number };

export type NeedsWork =
  | { code: 'muscle_low'; muscle: MuscleGroup; sets: number; target: number; fix: 'add' }
  | { code: 'stalled'; exerciseId: string; fix: 'swap' }
  | { code: 'missed'; missed: number; fix: 'days' }
  | { code: 'hurts'; exerciseId: string; fix: 'swap' };

/** Going well: first matching rule of §6.7. */
export function goingWell(i: InsightInput): GoingWell | null {
  const up = [...i.benchmarkChanges].filter((c) => c.change >= 0.05).sort((a, b) => b.change - a.change)[0];
  if (up)
    return { code: 'e1rm_up', exerciseId: up.exerciseId, pct: Math.round(up.change * 100), weeks: up.weeks };
  if (i.sessionsPlanned > 0 && i.sessionsDone >= i.sessionsPlanned)
    return { code: 'all_sessions', done: i.sessionsDone };
  if (i.goalSetsTotal > 0 && i.goalSetsMet / i.goalSetsTotal >= 0.9)
    return { code: 'goal_rate', pct: Math.round((i.goalSetsMet / i.goalSetsTotal) * 100) };
  if (i.newPrs >= 2) return { code: 'prs', count: i.newPrs };
  return null;
}

/** Needs work: first matching rule of §6.7, each with its one-tap fix. */
export function needsWork(i: InsightInput): NeedsWork | null {
  const low = i.muscleSets
    .filter((m) => m.target > 0 && m.sets < 0.6 * m.target)
    .sort((a, b) => a.sets / a.target - b.sets / b.target)[0];
  if (low) return { code: 'muscle_low', muscle: low.muscle, sets: low.sets, target: low.target, fix: 'add' };
  if (i.stalled.length) return { code: 'stalled', exerciseId: i.stalled[0]!, fix: 'swap' };
  const missed = i.sessionsPlanned - i.sessionsDone;
  if (missed >= 2) return { code: 'missed', missed, fix: 'days' };
  if (i.hurts.length) return { code: 'hurts', exerciseId: i.hurts[0]!, fix: 'swap' };
  return null;
}

/** Relative change between the first and last point (null without two points or a zero start). */
export function relativeChange(points: Point[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.at - b.at);
  const first = sorted[0]!.value;
  if (first <= 0) return null;
  return sorted[sorted.length - 1]!.value / first - 1;
}

// ---------- §6.8 recomp check ----------

export type RecompStatus =
  | { status: 'empty'; weighIns: number }
  | {
      status: 'on_track' | 'watch';
      reason:
        | 'on_track'
        | 'strength_flat'
        | 'losing_fast'
        | 'gaining_fast'
        | 'not_gaining'
        | 'consistency_low'
        | 'no_strength_data';
      bodyweightChangePerWeek: number | null;
      strengthChange: number | null;
    };

export interface RecompInput {
  goal: GoalKind;
  /** Weigh-ins in the last 6 weeks. */
  weighIns: Point[];
  /** Weekly average strength index (e1RM relative to each lift's first week, averaged), last 6 weeks. */
  strength: Point[];
  sessionsDone: number;
  sessionsPlanned: number;
}

/**
 * §6.8. Bodyweight change is the regression slope as a fraction of the average weight, per week.
 * Recomp: strength up and bodyweight within ±1%/week. Build muscle: strength up and +0.25…0.5%/week.
 * Get stronger: strength only. General fitness: consistency only (≥ 75% of planned sessions, D61).
 */
export function recompCheck(i: RecompInput): RecompStatus {
  if (i.weighIns.length < 3) return { status: 'empty', weighIns: i.weighIns.length };
  const avg = i.weighIns.reduce((a, p) => a + p.value, 0) / i.weighIns.length;
  const slope = weeklySlope(i.weighIns);
  const bw = slope === null || avg <= 0 ? null : slope / avg;
  const sSlope = weeklySlope(i.strength);
  const strengthChange = relativeChange(i.strength);
  const base = { bodyweightChangePerWeek: bw, strengthChange };
  const up = sSlope !== null && sSlope > 0;
  if (i.goal === 'general_fitness') {
    const ok = i.sessionsPlanned === 0 || i.sessionsDone / i.sessionsPlanned >= 0.75;
    return { status: ok ? 'on_track' : 'watch', reason: ok ? 'on_track' : 'consistency_low', ...base };
  }
  if (sSlope === null) return { status: 'watch', reason: 'no_strength_data', ...base };
  if (!up) return { status: 'watch', reason: 'strength_flat', ...base };
  if (i.goal === 'get_stronger' || bw === null) return { status: 'on_track', reason: 'on_track', ...base };
  if (i.goal === 'build_muscle') {
    if (bw < 0.0025) return { status: 'watch', reason: 'not_gaining', ...base };
    if (bw > 0.005) return { status: 'watch', reason: 'gaining_fast', ...base };
    return { status: 'on_track', reason: 'on_track', ...base };
  }
  // recomp (and any other goal): hold bodyweight within ±1% a week.
  if (bw < -0.01) return { status: 'watch', reason: 'losing_fast', ...base };
  if (bw > 0.01) return { status: 'watch', reason: 'gaining_fast', ...base };
  return { status: 'on_track', reason: 'on_track', ...base };
}

/**
 * Strength index per week: each lift's weekly best e1RM relative to its first week in the window,
 * averaged over lifts present that week (×100). Lifts need at least two weeks of data to count.
 */
export function strengthIndex(perExercise: Map<string, Point[]>, weekStarts: number[]): Point[] {
  const out: Point[] = [];
  const weekOf = (t: number) => {
    let w = -1;
    for (let k = 0; k < weekStarts.length; k++) if (t >= weekStarts[k]!) w = k;
    return w;
  };
  const series: Map<number, number>[] = [];
  for (const pts of perExercise.values()) {
    const best = new Map<number, number>();
    for (const p of pts) {
      const w = weekOf(p.at);
      if (w < 0) continue;
      best.set(w, Math.max(best.get(w) ?? 0, p.value));
    }
    if (best.size < 2) continue;
    const firstWeek = Math.min(...best.keys());
    const base = best.get(firstWeek)!;
    if (base <= 0) continue;
    series.push(new Map([...best].map(([w, v]) => [w, (v / base) * 100])));
  }
  for (let w = 0; w < weekStarts.length; w++) {
    const vals = series.map((s) => s.get(w)).filter((v): v is number => v !== undefined);
    if (vals.length) out.push({ at: weekStarts[w]!, value: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
  return out;
}

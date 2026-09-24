/**
 * FR-WRK-8: goal sets and bonus. FR-WRK-3: the goal meter. FR-WRK-14: unilateral pairs.
 * Bonus reps use rep-equivalents at the target load (DECISIONS D15).
 */
import { equivalentReps } from './e1rm';
import type { LoadType, LoggedSet, Target } from './types';

const EPS = 0.01;

/** Load-based comparison applies to every load type except pure bodyweight and timed. */
function usesLoad(loadType: LoadType, target: Target): target is Target & { loadKg: number } {
  return target.loadKg !== null && loadType !== 'bodyweight' && loadType !== 'timed';
}

/** reps ≥ repMin and load ≥ target (assisted: assistance ≤ target). Calibration (no load target) → reps only. */
export function isGoalSet(
  set: Pick<LoggedSet, 'kind' | 'loadKg' | 'reps'>,
  target: Target,
  loadType: LoadType,
): boolean {
  if (set.kind === 'warmup') return false;
  if (set.reps < target.repMin) return false;
  if (!usesLoad(loadType, target)) return true;
  if (loadType === 'assisted') return set.loadKg <= target.loadKg + EPS;
  return set.loadKg >= target.loadKg - EPS;
}

/** Bonus reps on a goal set: reps above repMax plus extra load as rep-equivalents. */
export function bonusReps(
  set: Pick<LoggedSet, 'kind' | 'loadKg' | 'reps'>,
  target: Target,
  loadType: LoadType,
  bodyweightKg: number | null = null,
): number {
  if (!isGoalSet(set, target, loadType)) return 0;
  if (!usesLoad(loadType, target) || target.loadKg <= 0) return Math.max(0, set.reps - target.repMax);
  let load = set.loadKg;
  let tgt = target.loadKg;
  if (loadType === 'assisted') {
    if (bodyweightKg === null) return Math.max(0, set.reps - target.repMax);
    load = bodyweightKg - set.loadKg;
    tgt = bodyweightKg - target.loadKg;
    if (tgt <= 0) return Math.max(0, set.reps - target.repMax);
  }
  const eq = equivalentReps(load, set.reps, tgt);
  return Math.max(0, Math.floor(eq - target.repMax + 1e-9));
}

export interface ExerciseProgress {
  /** Goal sets met, capped at target.sets. */
  goalMet: number;
  /** Work sets logged (pairs for unilateral). */
  logged: number;
  bonusReps: number;
  /** One extra set beyond the plan that met the goal (FR-WRK-8). */
  bonusSet: boolean;
  /** Per planned set index: 'met' | 'bonus' | 'missed' | null (not logged). */
  dots: ('met' | 'bonus' | 'missed' | null)[];
}

/**
 * Groups an exercise's work sets by idx (a unilateral set needs both sides, FR-WRK-14)
 * and scores them against the target.
 */
export function exerciseProgress(
  sets: Pick<LoggedSet, 'kind' | 'idx' | 'loadKg' | 'reps' | 'side'>[],
  target: Target,
  loadType: LoadType,
  unilateral: boolean,
  bodyweightKg: number | null = null,
): ExerciseProgress {
  const work = sets.filter((s) => s.kind !== 'warmup');
  const byIdx = new Map<number, typeof work>();
  for (const s of work) byIdx.set(s.idx, [...(byIdx.get(s.idx) ?? []), s]);
  const idxs = [...byIdx.keys()].sort((a, b) => a - b);
  const dots: ExerciseProgress['dots'] = Array.from({ length: target.sets }, () => null);
  let goalMet = 0;
  let logged = 0;
  let bonus = 0;
  let bonusSet = false;
  for (const idx of idxs) {
    const group = byIdx.get(idx)!;
    const complete = !unilateral || (group.some((s) => s.side === 'L') && group.some((s) => s.side === 'R'));
    if (!complete) continue;
    logged++;
    const met = group.every((s) => isGoalSet(s, target, loadType));
    const b = met ? Math.min(...group.map((s) => bonusReps(s, target, loadType, bodyweightKg))) : 0;
    if (idx <= target.sets) {
      if (met) goalMet++;
      bonus += b;
      dots[idx - 1] = met ? (b > 0 ? 'bonus' : 'met') : 'missed';
    } else if (met && !bonusSet) {
      bonusSet = true;
    }
  }
  return { goalMet: Math.min(goalMet, target.sets), logged, bonusReps: bonus, bonusSet, dots };
}

export interface Meter {
  done: number;
  total: number;
  bonus: boolean;
  bonusReps: number;
  /** One boolean per goal set, in exercise order (the segmented bar). */
  segments: boolean[];
}

/** FR-WRK-3: goal meter across the planned exercises. Unplanned exercises don't count (FR-WRK-10). */
export function goalMeter(items: { target: Target; progress: ExerciseProgress; planned: boolean }[]): Meter {
  const segments: boolean[] = [];
  let bonusReps = 0;
  let bonus = false;
  for (const it of items) {
    if (!it.planned) continue;
    for (let i = 0; i < it.target.sets; i++) segments.push(i < it.progress.goalMet);
    bonusReps += it.progress.bonusReps;
    if (it.progress.bonusReps > 0 || it.progress.bonusSet) bonus = true;
  }
  return { done: segments.filter(Boolean).length, total: segments.length, bonus, bonusReps, segments };
}

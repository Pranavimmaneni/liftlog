/** FR-SUM-1: session ticket numbers. Tonnage is a fun stat; goal sets and e1RM are the headline. */
import { setE1rm } from './e1rm';
import { setVolume } from './load';
import type { Exercise, LoggedSet } from './types';

export interface SessionTotals {
  tonnageKg: number;
  /** Some bodyweight-based sets were left out because no bodyweight was recorded (§6.1). */
  tonnageExcluded: boolean;
  workSets: number;
  reps: number;
  durationMin: number;
}

export function sessionTotals(
  sets: LoggedSet[],
  exercises: Map<string, Exercise>,
  bodyweightKg: number | null,
  startedAt: number,
  endedAt: number,
): SessionTotals {
  let tonnage = 0;
  let excluded = false;
  let workSets = 0;
  let reps = 0;
  for (const s of sets) {
    if (s.kind === 'warmup') continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    const v = setVolume(s, ex.loadType, bodyweightKg);
    tonnage += v.kg;
    excluded ||= v.excluded;
    reps += s.reps;
    // A unilateral pair counts as one set.
    if (!(ex.unilateral && s.side === 'R')) workSets++;
  }
  return {
    tonnageKg: Math.round(tonnage),
    tonnageExcluded: excluded,
    workSets,
    reps,
    durationMin: Math.max(1, Math.round((endedAt - startedAt) / 60_000)),
  };
}

export interface PrHit {
  exerciseId: string;
  setId: string;
  e1rm: number;
  prevE1rm: number;
  loadKg: number;
  reps: number;
}

/**
 * FR-XP-3: a PR is a new best e1RM from a work set with reps ≥ repMin. Warm-ups never count.
 * DECISIONS D14: the first exposure sets the baseline and is not a PR.
 */
export function findPrs(
  sessionSets: LoggedSet[],
  priorBest: Map<string, number>,
  exercises: Map<string, Exercise>,
  repMinFor: (exerciseId: string) => number,
  bodyweightKg: number | null,
): PrHit[] {
  const best = new Map<string, PrHit>();
  for (const s of sessionSets) {
    if (s.kind === 'warmup' || s.hurts) continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    const prev = priorBest.get(s.exerciseId);
    if (prev === undefined) continue;
    if (s.reps < repMinFor(s.exerciseId)) continue;
    const e = setE1rm(s, ex.loadType, bodyweightKg);
    if (e === null || e <= prev + 1e-6) continue;
    const cur = best.get(s.exerciseId);
    if (!cur || e > cur.e1rm)
      best.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        setId: s.id,
        e1rm: e,
        prevE1rm: prev,
        loadKg: s.loadKg,
        reps: s.reps,
      });
  }
  return [...best.values()];
}

/** Best e1RM per exercise over a set list (e.g. everything before a session). */
export function bestE1rmByExercise(
  sets: LoggedSet[],
  exercises: Map<string, Exercise>,
  bodyweightFor: (s: LoggedSet) => number | null,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sets) {
    if (s.hurts) continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    const e = setE1rm(s, ex.loadType, bodyweightFor(s));
    if (e !== null && e > (out.get(s.exerciseId) ?? 0)) out.set(s.exerciseId, e);
  }
  return out;
}

/** Bonus as a share of the planned reps (DECISIONS D16). */
export function bonusPercent(bonusReps: number, goalTotal: number, repMaxAvg: number): number {
  const denom = goalTotal * repMaxAvg;
  return denom > 0 ? Math.round((bonusReps / denom) * 100) : 0;
}

/** Minutes for a planned session (S05 "~55 min"): sets × secondsPerSetIncludingRest. */
export function estimateMinutes(
  items: { role: Exercise['role']; sets: number }[],
  secondsPerSet: Record<Exercise['role'], number>,
): number {
  const sec = items.reduce((t, i) => t + i.sets * secondsPerSet[i.role], 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

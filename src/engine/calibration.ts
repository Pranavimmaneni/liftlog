/**
 * FR-WRK-9 / §6.4 in-session nudges (calibration and auto-adjust). Evaluated after each set:
 * step up when reps ≥ repMax + 2, or effort = Easy with reps ≥ repMax (DECISIONS D3);
 * step down when reps < repMin. One increment. Never on (or for) the last set.
 */
import { incrementIn, lbToKg, roundLoadKg } from './units';
import type { Effort, Exercise, ProfileLike, Target } from './types';

export interface Nudge {
  dir: 1 | -1;
  /** Suggested load for the next set (kg). */
  loadKg: number;
  /** The set that triggered it (1-based). */
  fromSet: number;
  why: 'easy' | 'reps_high' | 'reps_low';
}

export function nudgeAfterSet(
  last: { idx: number; loadKg: number; reps: number; effort?: Effort },
  target: Pick<Target, 'sets' | 'repMin' | 'repMax'>,
  ex: Pick<Exercise, 'loadType' | 'incrementKg'>,
  units: ProfileLike['units'],
): Nudge | null {
  // The next set must exist, and must not be the last set's own nudge.
  if (last.idx >= target.sets) return null;
  if (ex.loadType === 'bodyweight' || ex.loadType === 'timed') return null;
  const incDisplay = incrementIn(units, ex.incrementKg, ex.loadType);
  if (incDisplay <= 0) return null;
  const inc = units === 'kg' ? incDisplay : lbToKg(incDisplay);
  const assisted = ex.loadType === 'assisted';
  let dir: 1 | -1 | 0 = 0;
  let why: Nudge['why'] = 'reps_high';
  if (last.reps >= target.repMax + 2) dir = 1;
  else if (last.effort === 'easy' && last.reps >= target.repMax) {
    dir = 1;
    why = 'easy';
  } else if (last.reps < target.repMin) {
    dir = -1;
    why = 'reps_low';
  }
  if (!dir) return null;
  // "Heavier" for assisted means less assistance.
  const signed = assisted ? -dir : dir;
  const next = roundLoadKg(Math.max(0, last.loadKg + signed * inc), units, ex.incrementKg, ex.loadType);
  if (next === last.loadKg) return null;
  return { dir, loadKg: next, fromSet: last.idx, why };
}

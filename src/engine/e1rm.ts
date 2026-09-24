/** PRD §6.2: Epley e1RM, only for work sets with reps ≤ 12, on effective load. */
import { STANDARDS } from './data';
import { effectiveLoadKg } from './load';
import type { LoadType, SetKind } from './types';

export const MAX_E1RM_REPS = STANDARDS.e1rm.maxRepsUsed;

export function epley(loadKg: number, reps: number): number {
  return loadKg * (1 + reps / 30);
}

/** e1RM for one set, or null when it doesn't qualify. */
export function setE1rm(
  set: { kind: SetKind; loadKg: number; reps: number },
  loadType: LoadType,
  bodyweightKg: number | null,
): number | null {
  if (set.kind === 'warmup' || set.reps < 1 || set.reps > MAX_E1RM_REPS) return null;
  const eff = effectiveLoadKg(set.loadKg, loadType, bodyweightKg);
  if (eff === null || eff <= 0) return null;
  return epley(eff, set.reps);
}

/** Reps you could do at `targetLoad` for the same e1RM as `load × reps` (used for bonus, DECISIONS D15). */
export function equivalentReps(loadKg: number, reps: number, targetLoadKg: number): number {
  if (targetLoadKg <= 0) return reps;
  return 30 * ((loadKg / targetLoadKg) * (1 + reps / 30) - 1);
}

/** FR-WRK-7: warm-up ramp from intensity.json, first compound per muscle group only. */
import { INTENSITY } from './data';
import { floorTo } from './units';
import type { Exercise, WarmupSet } from './types';

const NO_WARMUP_LOAD_TYPES = new Set(['bodyweight', 'assisted', 'timed', 'bodyweight_plus']);

/** Exercise ids that get warm-ups in a session: the first compound for each primary muscle. */
export function warmupEligible(exercisesInOrder: Exercise[]): Set<string> {
  const out = new Set<string>();
  const warmed = new Set<string>();
  for (const ex of exercisesInOrder) {
    if (ex.role !== 'compound' || NO_WARMUP_LOAD_TYPES.has(ex.loadType)) continue;
    const muscle = ex.primary[0];
    if (!muscle) continue;
    if (INTENSITY.warmup.onlyFirstCompoundPerMuscleGroup && warmed.has(muscle)) continue;
    warmed.add(muscle);
    out.add(ex.id);
  }
  return out;
}

/**
 * Warm-up sets for a working load. Loads round down to the exercise increment; sets that would
 * equal the working load or be empty are dropped. No warm-ups below `minWorkingKg`.
 */
export function warmupsFor(
  workingKg: number | null,
  incrementKg: number,
  enabled = INTENSITY.warmup.enabled,
): WarmupSet[] {
  if (!enabled || workingKg === null || workingKg < INTENSITY.warmup.minWorkingKg) return [];
  const out: WarmupSet[] = [];
  for (const step of INTENSITY.warmup.ramp) {
    const kg = floorTo(workingKg * step.pct, incrementKg);
    if (kg <= 0 || kg >= workingKg) continue;
    if (out.some((w) => w.loadKg === kg)) continue;
    out.push({ loadKg: kg, reps: step.reps });
  }
  return out;
}

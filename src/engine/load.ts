/** PRD §6.1 load handling: effective load and volume by load type. */
import { LOAD_TYPES } from './data';
import type { LoadType, SetKind } from './types';

export interface VolumeInput {
  kind: SetKind;
  loadKg: number;
  reps: number;
}

/**
 * The load the muscles moved for one rep (per hand for dumbbells).
 * Bodyweight types need the latest bodyweight on or before the session date; null when unknown.
 */
export function effectiveLoadKg(
  loadKg: number,
  loadType: LoadType,
  bodyweightKg: number | null,
): number | null {
  switch (loadType) {
    case 'bodyweight':
      return bodyweightKg;
    case 'bodyweight_plus':
      return bodyweightKg === null ? null : bodyweightKg + loadKg;
    case 'assisted':
      return bodyweightKg === null ? null : Math.max(0, bodyweightKg - loadKg);
    case 'timed':
      return null;
    default:
      return loadKg;
  }
}

export interface Volume {
  kg: number;
  /** True when a bodyweight-based set had no bodyweight on record (volume excluded and flagged). */
  excluded: boolean;
}

/** §6.1: dumbbell = load × 2 × reps; bodyweight uses bodyweight; assisted = (bw − assistance) × reps. Warm-ups = 0. */
export function setVolume(set: VolumeInput, loadType: LoadType, bodyweightKg: number | null): Volume {
  if (set.kind === 'warmup' || loadType === 'timed') return { kg: 0, excluded: false };
  const eff = effectiveLoadKg(set.loadKg, loadType, bodyweightKg);
  if (eff === null) return { kg: 0, excluded: true };
  const mult = LOAD_TYPES[loadType].volumeMultiplier ?? 1;
  return { kg: eff * mult * set.reps, excluded: false };
}

/** Latest bodyweight on or before `date` (YYYY-MM-DD), from rows sorted any way. */
export function bodyweightOn(rows: { date: string; kg: number }[], date: string): number | null {
  let best: { date: string; kg: number } | null = null;
  for (const r of rows) if (r.date <= date && (!best || r.date > best.date)) best = r;
  return best ? best.kg : null;
}

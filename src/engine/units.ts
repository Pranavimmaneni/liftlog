/** FR-SET-2: weights are stored in kg; the UI converts. Display rounding respects the unit's increments. */
import { LOAD_TYPES } from './data';
import type { LoadType, Units } from './types';

export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function toDisplay(kg: number, units: Units): number {
  return units === 'kg' ? kg : kgToLb(kg);
}

export function fromDisplay(v: number, units: Units): number {
  return units === 'kg' ? v : lbToKg(v);
}

/** Rounds to the nearest multiple of `inc` (inc ≤ 0 → 1 decimal). */
export function roundTo(v: number, inc: number): number {
  if (!(inc > 0)) return Math.round(v * 10) / 10;
  return Math.round(Math.round(v / inc) * inc * 1000) / 1000;
}

export function floorTo(v: number, inc: number): number {
  if (!(inc > 0)) return Math.floor(v * 10) / 10;
  return Math.round(Math.floor(v / inc + 1e-9) * inc * 1000) / 1000;
}

/**
 * Increment in the user's unit. A per-exercise or per-machine kg increment that differs from the load
 * type default is converted and rounded to 0.5 lb; otherwise the load type's lb default is used.
 */
export function incrementIn(units: Units, incrementKg: number, loadType: LoadType): number {
  if (units === 'kg') return incrementKg;
  const info = LOAD_TYPES[loadType];
  if (incrementKg <= 0) return 0;
  if (incrementKg === info.defaultIncrementKg && info.defaultIncrementLb) return info.defaultIncrementLb;
  return Math.max(0.5, Math.round(kgToLb(incrementKg) * 2) / 2);
}

/** Rounds a kg load onto the user's increment grid (in their unit) and returns kg (FR-GOAL-3). */
export function roundLoadKg(kg: number, units: Units, incrementKg: number, loadType: LoadType): number {
  const inc = incrementIn(units, incrementKg, loadType);
  if (units === 'kg') return roundTo(kg, inc);
  return lbToKg(roundTo(kgToLb(kg), inc));
}

/** Number for display in the user's unit, at most one decimal, no trailing zeros. */
export function displayNumber(kg: number, units: Units): string {
  const v = Math.round(toDisplay(kg, units) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Unit label for a load type, e.g. "kg / hand" for dumbbells (M1 phone check 5). */
export function loadUnitLabel(loadType: LoadType, units: Units): string {
  switch (loadType) {
    case 'dumbbell':
      return `${units} / hand`;
    case 'kettlebell':
      return `${units} / bell`;
    case 'assisted':
      return `${units} assist`;
    case 'bodyweight_plus':
      return `+${units}`;
    case 'bodyweight':
      return 'bodyweight';
    case 'timed':
      return 's';
    default:
      return units;
  }
}

/** "26 kg / hand", "55 kg", "BW", "BW +10 kg", "assist 20 kg", "45 s". */
export function formatLoad(kg: number | null, loadType: LoadType, units: Units): string {
  if (loadType === 'bodyweight') return 'BW';
  if (loadType === 'timed') return '';
  if (kg === null) return '–';
  const n = displayNumber(kg, units);
  if (loadType === 'bodyweight_plus') return kg > 0 ? `BW +${n} ${units}` : 'BW';
  if (loadType === 'assisted') return `${n} ${units} assist`;
  return `${n} ${loadUnitLabel(loadType, units)}`;
}

/** True when the load type has a load number the user enters (not pure bodyweight / timed). */
export function hasLoad(loadType: LoadType): boolean {
  return loadType !== 'bodyweight' && loadType !== 'timed';
}

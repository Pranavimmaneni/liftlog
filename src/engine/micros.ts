/**
 * PRD-1.2 FR-TGT-4: daily targets for the 8 tracked micros from the US Dietary Reference Intakes by
 * sex and age. Sodium is a limit. Without a sex, the lower of the two values is used (as S19 does).
 * Fibre follows the energy target (14 g per 1,000 kcal) when one is given.
 */
import { MICROS, type MicroKey, type Nutrients } from './food-types';
import { DRI, NUTRITION, type Sex } from './food-data';

export interface MicroTarget {
  value: number;
  kind: 'target' | 'limit';
  /** Tolerable upper intake, where one applies to food. */
  ul?: number;
}
export type MicroTargets = Record<MicroKey, MicroTarget>;

function band(age: number | null): number {
  const a = age ?? NUTRITION.energy.defaults.age;
  const i = DRI.ageBands.findIndex((b) => a >= b.from && a <= b.to);
  return i === -1 ? 0 : i;
}

export function microTargets(input: { sex?: Sex; age: number | null; kcal?: number }): MicroTargets {
  const b = band(input.age);
  const sex = input.sex ?? 'unspecified';
  const out = {} as MicroTargets;
  for (const k of MICROS) {
    const m = DRI.male[k][b]!;
    const f = DRI.female[k][b]!;
    let value = sex === 'male' ? m : sex === 'female' ? f : Math.min(m, f);
    if (k === 'fibre' && input.kcal)
      value = Math.round((NUTRITION.macros.fibrePer1000Kcal * input.kcal) / 1000);
    const ul = DRI.ul[k]?.[b];
    out[k] = { value, kind: DRI.limits.includes(k) ? 'limit' : 'target', ...(ul ? { ul } : {}) };
  }
  return out;
}

/** Micros over their upper limit (or over the sodium limit) for one day's intake. */
export function overLimit(intake: Nutrients, targets: MicroTargets): MicroKey[] {
  return MICROS.filter((k) => {
    const v = intake[k];
    if (v === null) return false;
    const t = targets[k];
    return t.kind === 'limit' ? v > t.value : t.ul !== undefined && v > t.ul;
  });
}

/**
 * PRD-1.2 FR-TGT-1/2: daily energy target. Mifflin-St Jeor resting energy × an activity factor that
 * adds each weekly training session, then the diet phase's surplus or deficit (≈ 7,700 kcal per kg).
 * Returns the parts so the screen can explain the number ("You burn about 2,700. Plus 250 …").
 */
import { NUTRITION, type Sex } from './food-data';

export type Activity = keyof typeof NUTRITION.energy.activity;
export type DietPhase = 'lose' | 'maintain' | 'gain';

export interface EnergyInput {
  weightKg: number;
  sex?: Sex;
  birthYear?: number;
  heightCm?: number;
  activity?: Activity;
  sessionsPerWeek: number;
  phase: DietPhase;
  rateKgPerWeek: number;
  now: number;
}

export interface EnergyTarget {
  kcal: number;
  bmr: number;
  factor: number;
  /** Estimated burn per day, rounded like the target. */
  burn: number;
  /** Surplus (+) or deficit (−) actually applied after the caps. */
  adjust: number;
  /** True when the floor raised the target. */
  floored: boolean;
  /** Inputs that fell back to defaults; the screen asks for them. */
  defaults: ('height' | 'age' | 'activity' | 'sex')[];
}

const E = NUTRITION.energy;
const P = NUTRITION.phase;

export function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function ageFrom(birthYear: number | undefined, now: number): number | null {
  if (!birthYear) return null;
  return new Date(now).getFullYear() - birthYear;
}

export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const m = E.mifflin;
  return m.perKg * weightKg + m.perCm * heightCm + m.perYear * age + m[sex];
}

export function activityFactor(activity: Activity, sessionsPerWeek: number): number {
  return Math.min(E.maxFactor, E.activity[activity] + E.perWeeklySession * Math.max(0, sessionsPerWeek));
}

export function energyTarget(i: EnergyInput): EnergyTarget {
  const defaults: EnergyTarget['defaults'] = [];
  const age = ageFrom(i.birthYear, i.now);
  if (age === null) defaults.push('age');
  if (!i.heightCm) defaults.push('height');
  if (!i.activity) defaults.push('activity');
  const sex: Sex = i.sex ?? 'unspecified';
  if (sex === 'unspecified') defaults.push('sex');

  const rest = bmr(i.weightKg, i.heightCm ?? E.defaults.heightCm, age ?? E.defaults.age, sex);
  const factor = activityFactor(i.activity ?? (E.defaults.activity as Activity), i.sessionsPerWeek);
  const burn = rest * factor;

  const perDay = (i.rateKgPerWeek * P.kcalPerKg) / 7;
  let adjust = i.phase === 'lose' ? -perDay : i.phase === 'gain' ? perDay : 0;
  adjust = Math.max(adjust, -P.maxDeficitFraction * burn);

  const floor = P.floorKcal[sex];
  const raw = roundTo(burn + adjust, P.roundTo);
  const kcal = Math.max(floor, raw);
  return {
    kcal,
    bmr: rest,
    factor,
    burn: roundTo(burn, P.roundTo),
    adjust: roundTo(kcal - burn, P.roundTo),
    floored: raw < floor,
    defaults,
  };
}

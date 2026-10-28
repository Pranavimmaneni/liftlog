/**
 * PRD-1.2 FR-TGT-3/6: macro targets from the energy target. Protein in g per kg by goal (more when
 * losing, ISSN range), a fat floor, carbs take the rest; fibre scales with energy. Optional carb
 * shift on training days; any target can be overridden and reset to the coach's pick.
 */
import type { GoalKind } from './types';
import type { DietPhase } from './energy';
import { NUTRITION } from './food-data';

const M = NUTRITION.macros;

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface MacroInput {
  kcal: number;
  weightKg: number;
  goal: GoalKind;
  phase: DietPhase;
  /** true / false applies the training-day carb shift; null or undefined leaves carbs flat. */
  trainingDay?: boolean | null;
}

const round5 = (v: number) => Math.round(v / 5) * 5;

export function proteinPerKg(goal: GoalKind, phase: DietPhase): number {
  return phase === 'lose' ? Math.max(M.proteinPerKgWhenLosing, M.proteinPerKg[goal]) : M.proteinPerKg[goal];
}

export function macroTargets(i: MacroInput): MacroTargets {
  const protein = round5(proteinPerKg(i.goal, i.phase) * i.weightKg);
  const fat = round5(Math.max(M.fatPerKg * i.weightKg, (M.fatMinFraction * i.kcal) / M.kcalPerG.fat));
  const flatCarbs = Math.max(
    0,
    (i.kcal - protein * M.kcalPerG.protein - fat * M.kcalPerG.fat) / M.kcalPerG.carbs,
  );
  const shift =
    i.trainingDay === true ? M.trainingDayCarbShiftG : i.trainingDay === false ? -M.trainingDayCarbShiftG : 0;
  const carbs = Math.max(0, round5(flatCarbs + shift));
  const kcal = i.kcal + (carbs - round5(flatCarbs)) * M.kcalPerG.carbs;
  return { kcal, protein, carbs, fat, fibre: Math.round((M.fibrePer1000Kcal * kcal) / 1000) };
}

export type MacroOverrides = Partial<Pick<MacroTargets, 'kcal' | 'protein' | 'carbs' | 'fat'>>;

export interface Overridden extends MacroTargets {
  overridden: (keyof MacroOverrides)[];
}

/**
 * FR-TGT-6: user overrides on top of the coach's pick. A new kcal with untouched macros moves carbs
 * so the parts still add up; an overridden macro without a kcal override changes kcal instead.
 */
export function applyOverrides(base: MacroTargets, o: MacroOverrides): Overridden {
  const overridden = (Object.keys(o) as (keyof MacroOverrides)[]).filter((k) => o[k] !== undefined);
  if (!overridden.length) return { ...base, overridden };
  const protein = o.protein ?? base.protein;
  const fat = o.fat ?? base.fat;
  let carbs = o.carbs ?? base.carbs;
  let kcal: number;
  if (o.kcal !== undefined) {
    kcal = o.kcal;
    if (o.carbs === undefined)
      carbs = Math.max(
        0,
        round5((kcal - protein * M.kcalPerG.protein - fat * M.kcalPerG.fat) / M.kcalPerG.carbs),
      );
  } else {
    kcal = protein * M.kcalPerG.protein + carbs * M.kcalPerG.carbs + fat * M.kcalPerG.fat;
  }
  return {
    kcal,
    protein,
    carbs,
    fat,
    fibre: Math.round((M.fibrePer1000Kcal * kcal) / 1000),
    overridden,
  };
}

/**
 * PRD-1.2 FR-NUT-1/2: a day against its targets, and the weekly / monthly food review. Only logged
 * days count; micros are judged on known values only ("not on the label" is not "low").
 */
import { MICROS, type MicroKey, type NutrientKey, type Nutrients } from './food-types';
import { scale, sumNutrients, type Totals } from './nutrition';
import type { MacroTargets } from './macros';
import type { MicroTargets } from './micros';
import { NUTRITION } from './food-data';

export interface DayEntry {
  foodId: string;
  name: string;
  meal: string;
  loggedAt: number;
  grams: number;
  per100g: Nutrients;
}

export interface DayTargets extends MacroTargets {
  micros: MicroTargets;
}

export interface DaySummary {
  date: string;
  entries: DayEntry[];
  totals: Totals;
  targets: DayTargets;
  meals: number;
  pct: { kcal: number; protein: number; carbs: number; fat: number };
  onTarget: boolean;
}

const pct = (v: number | null, t: number) => (t > 0 && v !== null ? v / t : 0);

/** FR-NUT-1: on target = calories within ±10% and protein at least 90% of target. */
export function summarizeDay(date: string, entries: DayEntry[], targets: DayTargets): DaySummary {
  const totals = sumNutrients(entries);
  const p = {
    kcal: pct(totals.total.kcal, targets.kcal),
    protein: pct(totals.total.protein, targets.protein),
    carbs: pct(totals.total.carbs, targets.carbs),
    fat: pct(totals.total.fat, targets.fat),
  };
  const o = NUTRITION.onTarget;
  return {
    date,
    entries,
    totals,
    targets,
    meals: new Set(entries.map((e) => e.meal)).size,
    pct: p,
    onTarget:
      entries.length > 0 && Math.abs(p.kcal - 1) <= o.kcalTolerance && p.protein >= o.proteinMinFraction,
  };
}

export interface MicroAdequacy {
  /** Average share of the target (or of the limit for sodium) on days with a known value. */
  avgPct: number | null;
  knownDays: number;
  kind: 'target' | 'limit';
}

export interface FoodReview {
  loggedDays: number;
  daysOnTarget: number;
  avgPct: DaySummary['pct'];
  avgKcal: number;
  avgProtein: number;
  micros: Record<MicroKey, MicroAdequacy>;
  /** Targets under 70% on average, lowest first. */
  low: MicroKey[];
  /** Limits over 100% on average (sodium). */
  over: MicroKey[];
}

/** FR-NUT-2: the review for the days given (a week or a calendar month). */
export function reviewPeriod(days: DaySummary[]): FoodReview {
  const logged = days.filter((d) => d.entries.length > 0);
  const avg = (f: (d: DaySummary) => number) =>
    logged.length ? logged.reduce((n, d) => n + f(d), 0) / logged.length : 0;
  const micros = {} as Record<MicroKey, MicroAdequacy>;
  for (const k of MICROS) {
    const known = logged.filter((d) => d.totals.known[k] > 0);
    const kind = logged[0]?.targets.micros[k].kind ?? (k === 'sodium' ? 'limit' : 'target');
    micros[k] = {
      avgPct: known.length
        ? known.reduce((n, d) => n + pct(d.totals.total[k], d.targets.micros[k].value), 0) / known.length
        : null,
      knownDays: known.length,
      kind,
    };
  }
  const low = MICROS.filter(
    (k) =>
      micros[k].kind === 'target' &&
      micros[k].avgPct !== null &&
      micros[k].avgPct! < NUTRITION.coach.lowMicroFraction,
  ).sort((a, b) => micros[a].avgPct! - micros[b].avgPct!);
  const over = MICROS.filter(
    (k) => micros[k].kind === 'limit' && micros[k].avgPct !== null && micros[k].avgPct! > 1,
  );
  return {
    loggedDays: logged.length,
    daysOnTarget: logged.filter((d) => d.onTarget).length,
    avgPct: {
      kcal: avg((d) => d.pct.kcal),
      protein: avg((d) => d.pct.protein),
      carbs: avg((d) => d.pct.carbs),
      fat: avg((d) => d.pct.fat),
    },
    avgKcal: avg((d) => d.totals.total.kcal ?? 0),
    avgProtein: avg((d) => d.totals.total.protein ?? 0),
    micros,
    low,
    over,
  };
}

/** FR-NUT-2: the foods that gave the most of a nutrient over the days, merged by food. */
export function topSources(
  days: DaySummary[],
  nutrient: NutrientKey,
  n = 3,
): { foodId: string; name: string; amount: number }[] {
  const by = new Map<string, { foodId: string; name: string; amount: number }>();
  for (const d of days)
    for (const e of d.entries) {
      const v = scale(e.per100g, e.grams)[nutrient];
      if (v === null || v <= 0) continue;
      const cur = by.get(e.foodId) ?? { foodId: e.foodId, name: e.name, amount: 0 };
      cur.amount += v;
      by.set(e.foodId, cur);
    }
  return [...by.values()].sort((a, b) => b.amount - a.amount).slice(0, n);
}

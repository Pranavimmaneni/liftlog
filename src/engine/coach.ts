/**
 * PRD-1.2 FR-COACH-1/2: combined food + training feedback for the Food review. Rule-based (no AI),
 * evaluated in order; the first match is "Needs work" / "Going well", like PRD §6.7. Every insight
 * carries its numbers (the screen words them) and, where possible, a one-tap fix.
 */
import type { MicroKey, NutrientKey, Nutrients, Portion } from './food-types';
import type { DaySummary, FoodReview } from './food-review';
import type { DietPhase } from './energy';
import { NUTRITION } from './food-data';

const C = NUTRITION.coach;
const HOUR = 3_600_000;

export type Fix =
  | { kind: 'suggest-foods'; nutrient: NutrientKey; foodIds: string[] }
  | { kind: 'raise-kcal'; by: number }
  | { kind: 'slow-rate'; to: number };

export type InsightId =
  | 'protein-short-training'
  | 'pre-lift-carbs-low'
  | 'gain-flat'
  | 'loss-too-fast'
  | 'micro-low'
  | 'pre-lift-carbs-good'
  | 'weight-on-track'
  | 'protein-on-target'
  | 'days-on-target';

export interface Insight {
  id: InsightId;
  data: Record<string, number | string>;
  fix?: Fix;
}

export interface CandidateFood {
  id: string;
  per100g: Nutrients;
  portion: Portion;
}

export interface CoachInput {
  days: DaySummary[];
  review: FoodReview;
  trainingDates: Set<string>;
  sessionStarts: number[];
  volumeChange: number | null;
  strengthChange: number | null;
  trendKgPerWeek: number | null;
  trendWeeks: number;
  bodyweightKg: number | null;
  phase: DietPhase;
  rateKgPerWeek: number;
  /** Foods to suggest from: the user's own frequent foods first, then library staples. */
  candidates: CandidateFood[];
}

/** Foods with the most of `nutrient` per default portion (candidates keep their order on ties). */
export function suggestFoods(
  candidates: CandidateFood[],
  nutrient: NutrientKey,
  n = C.suggestFoods,
): string[] {
  return candidates
    .map((c, i) => ({ id: c.id, i, amount: ((c.per100g[nutrient] ?? 0) * c.portion.grams) / 100 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.i - b.i)
    .slice(0, n)
    .map((c) => c.id);
}

/** Carbs (g) logged in the hours before each session start. */
export function preLiftCarbs(days: DaySummary[], starts: number[]): number[] {
  const entries = days.flatMap((d) => d.entries);
  return starts.map((s) =>
    entries
      .filter((e) => e.loggedAt < s && e.loggedAt >= s - C.preWorkoutHours * HOUR)
      .reduce((n, e) => n + ((e.per100g.carbs ?? 0) * e.grams) / 100, 0),
  );
}

export function coachInsights(i: CoachInput): {
  needsWork: Insight | null;
  goingWell: Insight | null;
  all: Insight[];
} {
  const logged = i.days.filter((d) => d.entries.length > 0);
  const trainingLogged = logged.filter((d) => i.trainingDates.has(d.date));
  const short = trainingLogged.filter((d) => d.pct.protein < C.proteinShortFraction);
  const carbs = preLiftCarbs(i.days, i.sessionStarts);
  const lowCarbs = carbs.filter((g) => g < C.preWorkoutCarbsG).length;
  const target = i.phase === 'gain' ? i.rateKgPerWeek : i.phase === 'lose' ? -i.rateKgPerWeek : 0;

  const needs: Insight[] = [];
  if (short.length >= C.proteinShortTrainingDays)
    needs.push({
      id: 'protein-short-training',
      data: {
        short: short.length,
        trainingDays: trainingLogged.length,
        volumePct: i.volumeChange === null ? '' : Math.round(i.volumeChange * 100),
      },
      fix: { kind: 'suggest-foods', nutrient: 'protein', foodIds: suggestFoods(i.candidates, 'protein') },
    });
  if (carbs.length && lowCarbs >= Math.min(2, carbs.length))
    needs.push({
      id: 'pre-lift-carbs-low',
      data: { low: lowCarbs, sessions: carbs.length, grams: C.preWorkoutCarbsG, hours: C.preWorkoutHours },
      fix: { kind: 'suggest-foods', nutrient: 'carbs', foodIds: suggestFoods(i.candidates, 'carbs') },
    });
  if (
    i.phase === 'gain' &&
    i.trendKgPerWeek !== null &&
    i.trendWeeks >= C.flatWeightWeeks &&
    i.trendKgPerWeek < C.flatWeightKgPerWeek
  )
    needs.push({
      id: 'gain-flat',
      data: { weeks: i.trendWeeks },
      fix: { kind: 'raise-kcal', by: C.raiseKcal },
    });
  if (
    i.phase === 'lose' &&
    i.trendKgPerWeek !== null &&
    i.bodyweightKg !== null &&
    -i.trendKgPerWeek > C.fastLossFractionPerWeek * i.bodyweightKg &&
    i.strengthChange !== null &&
    i.strengthChange < 0
  ) {
    const slower = NUTRITION.phase.rates.lose.filter((r) => r < i.rateKgPerWeek).pop() ?? i.rateKgPerWeek;
    needs.push({
      id: 'loss-too-fast',
      data: {
        kgPerWeek: Math.round(-i.trendKgPerWeek * 10) / 10,
        strengthPct: Math.round(i.strengthChange * 100),
      },
      fix: { kind: 'slow-rate', to: slower },
    });
  }
  const micro: MicroKey | undefined = i.review.low[0];
  if (micro)
    needs.push({
      id: 'micro-low',
      data: { nutrient: micro, pct: Math.round((i.review.micros[micro].avgPct ?? 0) * 100) },
      fix: { kind: 'suggest-foods', nutrient: micro, foodIds: suggestFoods(i.candidates, micro) },
    });

  const well: Insight[] = [];
  if (carbs.length && lowCarbs === 0)
    well.push({ id: 'pre-lift-carbs-good', data: { sessions: carbs.length } });
  if (
    i.trendKgPerWeek !== null &&
    i.trendWeeks >= C.flatWeightWeeks &&
    (target === 0
      ? Math.abs(i.trendKgPerWeek) < 0.1
      : i.trendKgPerWeek / target >= 0.5 && i.trendKgPerWeek / target <= 1.5)
  )
    well.push({ id: 'weight-on-track', data: { kgPerWeek: Math.round(i.trendKgPerWeek * 100) / 100 } });
  const proteinDays = logged.filter((d) => d.pct.protein >= C.proteinShortFraction).length;
  if (logged.length >= 5 && proteinDays >= logged.length - 1)
    well.push({ id: 'protein-on-target', data: { days: proteinDays, logged: logged.length } });
  if (i.review.daysOnTarget >= 5) well.push({ id: 'days-on-target', data: { days: i.review.daysOnTarget } });

  return { needsWork: needs[0] ?? null, goingWell: well[0] ?? null, all: [...needs, ...well] };
}

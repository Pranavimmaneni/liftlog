/**
 * PRD-1.2 FR-TGT-5: adaptive expenditure. A smoothed trend weight removes day-to-day water swings;
 * over at least 3 weeks, energy in minus the energy in the trend change estimates what the body
 * actually burns. A new target is offered only when it moves by more than 100 kcal.
 */
import { daysBetween, parseDateKey } from './week';
import { NUTRITION } from './food-data';

const A = NUTRITION.adaptive;

export interface WeighIn {
  date: string;
  kg: number;
}

/** Exponentially smoothed weight per weigh-in date (oldest first). */
export function trendWeights(weighIns: WeighIn[], alpha = A.trendAlpha): WeighIn[] {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const out: WeighIn[] = [];
  let t: number | null = null;
  for (const w of sorted) {
    t = t === null ? w.kg : t + alpha * (w.kg - t);
    out.push({ date: w.date, kg: t });
  }
  return out;
}

/** Trend change in kg per week between the first and last trend points, or null. */
export function trendRatePerWeek(trend: WeighIn[]): number | null {
  if (trend.length < 2) return null;
  const first = trend[0]!;
  const last = trend[trend.length - 1]!;
  const days = daysBetween(parseDateKey(first.date), parseDateKey(last.date));
  if (days <= 0) return null;
  return ((last.kg - first.kg) / days) * 7;
}

export interface ExpenditureEstimate {
  /** Estimated kcal burned per day. */
  burn: number;
  avgIntake: number;
  loggedDays: number;
  spanDays: number;
  trendKgPerWeek: number;
}

/**
 * `intake`: kcal per logged day (unlogged days are left out, not counted as 0).
 * Needs ≥ minDays between the first and last weigh-in in the window and ≥ minLoggedDays logged.
 */
export function estimateExpenditure(
  intake: { date: string; kcal: number }[],
  weighIns: WeighIn[],
): ExpenditureEstimate | null {
  const trend = trendWeights(weighIns);
  if (trend.length < 2) return null;
  const first = trend[0]!.date;
  const last = trend[trend.length - 1]!.date;
  const spanDays = daysBetween(parseDateKey(first), parseDateKey(last));
  const days = intake.filter((d) => d.date >= first && d.date <= last && d.kcal > 0);
  if (spanDays < A.minDays || days.length < A.minLoggedDays) return null;
  const avgIntake = days.reduce((n, d) => n + d.kcal, 0) / days.length;
  const changeKg = trend[trend.length - 1]!.kg - trend[0]!.kg;
  const burn = avgIntake - (changeKg * NUTRITION.phase.kcalPerKg) / spanDays;
  return { burn, avgIntake, loggedDays: days.length, spanDays, trendKgPerWeek: (changeKg / spanDays) * 7 };
}

/** The new daily target, or null when it moves by no more than `minChangeKcal`. */
export function adaptiveTarget(
  current: { kcal: number; adjust: number },
  est: ExpenditureEstimate | null,
): number | null {
  if (!est) return null;
  const next = Math.round((est.burn + current.adjust) / A.roundTo) * A.roundTo;
  return Math.abs(next - current.kcal) > A.minChangeKcal ? next : null;
}

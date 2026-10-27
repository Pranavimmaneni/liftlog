import { db } from '@/db/schema';
import { getSettings, getRawSetting } from '@/db/settings';
import { frequentFoodIds, getFood } from '@/db/food';
import { periodOf } from '@/db/insight';
import type { MacroOverrides } from '@/engine/macros';
import { summarizeDay, reviewPeriod, type DaySummary, type FoodReview } from '@/engine/food-review';
import { coachInsights, type CandidateFood, type Insight } from '@/engine/coach';
import { trainingDates, volumeChange, type SessionLite } from '@/engine/training-link';
import { trendRatePerWeek, trendWeights } from '@/engine/adaptive';
import { weeklyQuest, type Quest } from '@/engine/food-quests';
import { addDays, dateKey, daysBetween, parseDateKey } from '@/engine/week';
import { FOOD_KEYS, targetsFor, type FoodTargets } from './hooks';

export type PeriodKind = 'week' | 'month';

/** ISO-8601 week number (the mockup's "Week 43"), so the label matches any calendar. */
export function isoWeek(t: number): number {
  const d = new Date(t);
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - day); // the Thursday of this week decides the year
  const yearStart = Date.UTC(u.getUTCFullYear(), 0, 1);
  return Math.ceil(((u.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

export interface FoodReviewData {
  kind: PeriodKind;
  start: number;
  end: number;
  days: DaySummary[];
  review: FoodReview;
  needsWork: Insight | null;
  goingWell: Insight | null;
  quest: Quest | null;
  /** Today's targets, for the raise-kcal fix. */
  current: FoodTargets | null;
  hasTargets: boolean;
}

/** Work-set tonnage per session (load × reps; FR-COACH-3 volume change). */
function volumes(
  sets: { sessionId: string; kind: string; loadKg: number; reps: number }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sets)
    if (s.kind !== 'warmup') out.set(s.sessionId, (out.get(s.sessionId) ?? 0) + s.loadKg * s.reps);
  return out;
}

/**
 * PRD-1.2 FR-NUT-2, FR-COACH-1/2: everything the Food review shows for the period containing `t`.
 * Reads both sides: the diary and targets (Food) and sessions, sets and weigh-ins (LiftLog).
 */
export async function loadFoodReview(kind: PeriodKind, t: number, now = Date.now()): Promise<FoodReviewData> {
  const settings = await getSettings();
  const [start, end] = periodOf(kind, t, settings.weekStart);
  const from = dateKey(start);
  const to = dateKey(end);
  const [profile, weighIns, overrides, cycling, entries, sessions] = await Promise.all([
    db.profile.get('me'),
    db.bodyweights.toArray(),
    getRawSetting<MacroOverrides>(FOOD_KEYS.overrides),
    getRawSetting<boolean>(FOOD_KEYS.carbCycling),
    db.diary.where('date').between(from, to, true, false).toArray(),
    db.sessions.orderBy('startedAt').toArray(),
  ]);
  const prevStart = start - (end - start);
  const sets = await db.sets
    .where('sessionId')
    .anyOf(sessions.filter((s) => s.startedAt >= prevStart && s.startedAt < end).map((s) => s.id))
    .toArray();
  const vol = volumes(sets);
  const lite: SessionLite[] = sessions.map((s) => ({
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    volumeKg: vol.get(s.id) ?? 0,
  }));
  const trained = trainingDates(lite, start, end);

  const ctx = profile
    ? (date: string, trainingDay: boolean | null) =>
        targetsFor(date, { profile, weighIns, trainingDay, overrides: overrides ?? {}, now })
    : null;
  const current = ctx ? ctx(dateKey(now), null) : null;

  const days: DaySummary[] = [];
  const nDays = daysBetween(start, end);
  for (let i = 0; i < nDays; i++) {
    const date = dateKey(addDays(start, i));
    const targets = ctx?.(date, cycling ? trained.has(date) : null);
    if (!targets) continue;
    days.push(
      summarizeDay(
        date,
        entries.filter((e) => e.date === date),
        targets.day,
      ),
    );
  }
  const review = reviewPeriod(days);

  // Weight trend over the 4 weeks up to the period end.
  const trendFrom = dateKey(addDays(end, -28));
  const recent = weighIns.filter((w) => w.date >= trendFrom && w.date < to);
  const trend = trendWeights(recent);
  const trendWeeks =
    trend.length >= 2
      ? Math.floor(daysBetween(parseDateKey(trend[0]!.date), parseDateKey(trend[trend.length - 1]!.date)) / 7)
      : 0;

  const frequent = await frequentFoodIds(dateKey(now));
  const candidates: CandidateFood[] = [];
  for (const id of frequent.slice(0, 20)) {
    const f = await getFood(id);
    if (f?.portions[0]) candidates.push({ id: f.id, per100g: f.per100g, portion: f.portions[0] });
  }

  const insights =
    review.loggedDays && current
      ? coachInsights({
          days,
          review,
          trainingDates: trained,
          sessionStarts: lite
            .filter((s) => s.endedAt !== undefined && s.startedAt >= start && s.startedAt < end)
            .map((s) => s.startedAt),
          volumeChange: volumeChange(lite, start, end),
          strengthChange: null,
          trendKgPerWeek: trendRatePerWeek(trend),
          trendWeeks,
          bodyweightKg: current.weightKg,
          phase: current.phase,
          rateKgPerWeek: current.rateKgPerWeek,
          candidates,
        })
      : { needsWork: null, goingWell: null };

  return {
    kind,
    start,
    end,
    days,
    review,
    needsWork: insights.needsWork,
    goingWell: insights.goingWell,
    quest: kind === 'week' && review.loggedDays ? weeklyQuest(days) : null,
    current,
    hasTargets: !!current,
  };
}

/** Where a "suggest foods" fix lands: the next meal by the clock. */
export function nextMeal(now = new Date()): 'breakfast' | 'lunch' | 'snacks' | 'dinner' {
  const h = now.getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snacks' : 'dinner';
}

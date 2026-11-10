import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { en } from '@/copy/en';
import { db } from '@/db/schema';
import { useExerciseMap } from '@/db/catalog';
import {
  defaultReviewTime,
  getLiftSeries,
  getRecentPrs,
  getReview,
  getStrength,
  weeklyBest,
} from '@/db/insight';
import { useBodyweights, useProfile } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { relativeChange } from '@/engine/review';
import { displayNumber, loadUnitLabel, toDisplay } from '@/engine/units';
import { weekRange, weekNumber } from '@/engine/week';

/**
 * Everything the Lifts view of S12 shows (FR-PRO-1), shared by the classic and Rising Sun layouts:
 * the picked lift's weekly-best estimated 1-rep max, this week's count, the strength band and the
 * recent records. Null until the data has loaded.
 */
export function useLifts() {
  const map = useExerciseMap();
  const profile = useProfile();
  const settings = useSettings();
  const lifts = useLiveQuery(() => getLiftSeries(), []);
  const prs = useLiveQuery(() => getRecentPrs(10), []);
  const strength = useLiveQuery(() => getStrength(), []);
  const [pick, setPick] = useState<string | null>(null);
  const now = Date.now();
  const [wStart, wEnd] = weekRange(now, settings.weekStart);
  const week = useLiveQuery(async () => {
    const done = await db.sessions
      .filter((s) => s.endedAt !== undefined && s.startedAt >= wStart && s.startedAt < wEnd)
      .count();
    const first = (await db.sessions.filter((s) => s.endedAt !== undefined).toArray()).sort(
      (a, b) => a.startedAt - b.startedAt,
    )[0];
    return {
      done,
      number: first
        ? weekNumber(defaultReviewTime(now, settings.weekStart), first.startedAt, settings.weekStart)
        : 1,
    };
  }, [wStart]);
  const current = lifts?.find((l) => l.exerciseId === pick) ?? lifts?.[0];
  const ex = current ? map?.get(current.exerciseId) : undefined;
  const units = profile?.units ?? 'kg';
  const chart = useMemo(
    () => (current ? weeklyBest(current.points, now, settings.weekStart) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, settings.weekStart],
  );
  if (!lifts || !map || !profile) return null;
  const change = relativeChange(chart.map((c) => ({ at: c.at, value: c.value })));
  const spanWeeks =
    chart.length >= 2 ? Math.round((chart[chart.length - 1]!.at - chart[0]!.at) / (7 * 86_400_000)) : 0;
  const latest = current?.points[current.points.length - 1];
  const unit = ex ? loadUnitLabel(ex.loadType, units) : units;
  return {
    map,
    profile,
    units,
    lifts,
    prs,
    strength,
    week,
    current,
    ex,
    setPick,
    change,
    spanWeeks,
    /** The hero number: this week's best, or the last logged estimate. */
    value: latest ? displayNumber(chart[chart.length - 1]?.value ?? latest.value, units) : '–',
    /** First-to-last change over the chart, in kg (null without two points). */
    changeKg: chart.length >= 2 ? chart[chart.length - 1]!.value - chart[0]!.value : null,
    unit,
    points: chart.map((c) => ({ label: c.label, value: Math.round(toDisplay(c.value, units) * 10) / 10 })),
    chartTitle: ex ? `${en.progress.e1rm}, ${ex.name}` : en.progress.e1rm,
  };
}

/** The Body view: weigh-ins oldest first, the latest one and the recomp check (FR-REV-3). */
export function useBody() {
  const profile = useProfile();
  const weights = useBodyweights();
  const review = useLiveQuery(() => getReview('week', Date.now()), []);
  if (!profile || !weights) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return { units: profile.units, sorted, last: sorted[sorted.length - 1], review };
}

/** The History view: finished sessions, newest first. */
export function useHistory() {
  return useLiveQuery(
    async () =>
      (await db.sessions.filter((s) => s.endedAt !== undefined).toArray()).sort(
        (a, b) => b.startedAt - a.startedAt,
      ),
    [],
  );
}

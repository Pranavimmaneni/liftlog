/**
 * PRD-1.2 FR-FAST-1: fasting timer maths. Like the rest timer (FR-TMR-2), everything comes from
 * timestamps, so it stays right after the phone sleeps. No notifications (a web app can't fire them
 * while closed).
 */
import { addDays, dateKey } from './week';
import { NUTRITION } from './food-data';

const HOUR = 3_600_000;

export interface Fast {
  startedAt: number;
  endedAt?: number;
  planHours: number;
}

export interface FastState {
  elapsedMs: number;
  remainingMs: number;
  /** 0–1 of the plan (can pass 1 when the fast runs long). */
  progress: number;
  done: boolean;
  /** When eating may start (start + plan). */
  eatFrom: number;
}

export function fastState(f: Fast, now: number): FastState {
  const end = f.endedAt ?? now;
  const elapsedMs = Math.max(0, end - f.startedAt);
  const planMs = f.planHours * HOUR;
  return {
    elapsedMs,
    remainingMs: Math.max(0, planMs - elapsedMs),
    progress: planMs > 0 ? elapsedMs / planMs : 0,
    done: elapsedMs >= planMs,
    eatFrom: f.startedAt + planMs,
  };
}

/** A finished fast counts when it lasted at least `minHoursToCount`. */
export function counts(f: Fast): boolean {
  return f.endedAt !== undefined && f.endedAt - f.startedAt >= NUTRITION.fasting.minHoursToCount * HOUR;
}

/** "N in a row": counted fasts ending on consecutive days, up to today or yesterday. */
export function fastStreak(fasts: Fast[], now: number): number {
  const days = new Set(fasts.filter(counts).map((f) => dateKey(f.endedAt!)));
  let day = days.has(dateKey(now)) ? now : addDays(now, -1);
  let n = 0;
  while (days.has(dateKey(day))) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Hours fasted per day of the week starting `weekStart` (by the day the fast ended); null = none. */
export function weekStrip(fasts: Fast[], weekStart: number): { date: string; hours: number | null }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = dateKey(addDays(weekStart, i));
    const f = fasts.find((x) => x.endedAt !== undefined && dateKey(x.endedAt) === date && counts(x));
    return { date, hours: f ? Math.round((f.endedAt! - f.startedAt) / HOUR) : null };
  });
}

/**
 * Whether the usual training time today falls inside the fast (FR-FAST-1 note; FR-COACH-3).
 * `usualMinutes` is minutes after midnight from training-link.usualTrainingTime.
 */
export function trainingInFast(f: Fast, usualMinutes: number | null, now: number): boolean {
  if (usualMinutes === null) return false;
  const d = new Date(now);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, usualMinutes).getTime();
  const end = f.endedAt ?? f.startedAt + f.planHours * HOUR;
  return t >= f.startedAt && t < end;
}

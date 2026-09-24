/**
 * FR-PRG-7: deload per intensity.json.deload. Every N weeks by level (N = deloadEveryWeeks; beginners
 * never), or the week after 3+ exercises stall at once. Announced the week before (DECISIONS D17, D53).
 * Derived from the week number and stall counts, never stored.
 */
import { INTENSITY } from './data';
import type { Experience } from './types';

/** Scheduled deloads: after N normal weeks comes one deload week (weeks N+1, 2N+2, …). */
export function isScheduledDeload(week: number, level: Experience): boolean {
  const n = INTENSITY.levels[level].deloadEveryWeeks;
  if (!n || week < 1) return false;
  return week % (n + 1) === 0;
}

export interface DeloadInput {
  level: Experience;
  /** Current week number (1-based, from the routine anchor). */
  week: number;
  /** Exercises stalled as of the start of this week. */
  stalledAtWeekStart: number;
  /** Exercises stalled right now. */
  stalledNow: number;
  /** Week number of the most recent deload, if any. */
  lastDeloadWeek?: number;
}

export interface DeloadStatus {
  thisWeek: boolean;
  nextWeek: boolean;
  reason: 'scheduled' | 'stalls' | null;
}

const MIN_GAP_WEEKS = 3;

export function deloadStatus(i: DeloadInput): DeloadStatus {
  const trigger = INTENSITY.deload.triggerStalledExercises;
  const recent = (w: number) => i.lastDeloadWeek !== undefined && w - i.lastDeloadWeek < MIN_GAP_WEEKS;
  const scheduledNow = isScheduledDeload(i.week, i.level);
  const stallNow = !scheduledNow && i.stalledAtWeekStart >= trigger && !recent(i.week);
  const thisWeek = scheduledNow || stallNow;
  const nextWeek =
    !thisWeek && (isScheduledDeload(i.week + 1, i.level) || (i.stalledNow >= trigger && !recent(i.week + 1)));
  return {
    thisWeek,
    nextWeek,
    reason: thisWeek
      ? scheduledNow
        ? 'scheduled'
        : 'stalls'
      : nextWeek
        ? isScheduledDeload(i.week + 1, i.level)
          ? 'scheduled'
          : 'stalls'
        : null,
  };
}

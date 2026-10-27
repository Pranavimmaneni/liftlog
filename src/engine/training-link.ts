/**
 * PRD-1.2 FR-COACH-3, FR-SHR-1: what the Food section reads from LiftLog's training log. Read only:
 * LiftLog never reads food. LiftLog has no planned workout times, so the "usual training time" is
 * the median start time of the last few sessions.
 */
import { dateKey } from './week';
import { NUTRITION } from './food-data';

const T = NUTRITION.trainingLink;

export interface SessionLite {
  startedAt: number;
  endedAt?: number;
  /** Work-set tonnage in kg, when the caller has it. */
  volumeKg?: number;
}

/** Minutes after local midnight, or null with fewer than `minSessionsForUsualTime` finished sessions. */
export function usualTrainingTime(sessions: SessionLite[], now: number): number | null {
  const recent = sessions
    .filter((s) => s.endedAt !== undefined && s.startedAt <= now)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, T.sessionsForUsualTime)
    .map((s) => {
      const d = new Date(s.startedAt);
      return d.getHours() * 60 + d.getMinutes();
    })
    .sort((a, b) => a - b);
  if (recent.length < T.minSessionsForUsualTime) return null;
  const mid = recent.length >> 1;
  return recent.length % 2 ? recent[mid]! : Math.round((recent[mid - 1]! + recent[mid]!) / 2);
}

/** Local dates with a finished session in [from, to). */
export function trainingDates(sessions: SessionLite[], from: number, to: number): Set<string> {
  return new Set(
    sessions
      .filter((s) => s.endedAt !== undefined && s.startedAt >= from && s.startedAt < to)
      .map((s) => dateKey(s.startedAt)),
  );
}

function volumeIn(sessions: SessionLite[], from: number, to: number): number {
  return sessions
    .filter((s) => s.endedAt !== undefined && s.startedAt >= from && s.startedAt < to)
    .reduce((n, s) => n + (s.volumeKg ?? 0), 0);
}

/** Fractional change in training volume for [from, to) against the period of the same length before. */
export function volumeChange(sessions: SessionLite[], from: number, to: number): number | null {
  const now = volumeIn(sessions, from, to);
  const before = volumeIn(sessions, from - (to - from), from);
  return before > 0 ? now / before - 1 : null;
}

/** Fractional change between the first and last strength points in [from, to), or null. */
export function strengthChange(
  points: { at: number; value: number }[],
  from: number,
  to: number,
): number | null {
  const inRange = points.filter((p) => p.at >= from && p.at < to).sort((a, b) => a.at - b.at);
  if (inRange.length < 2 || inRange[0]!.value <= 0) return null;
  return inRange[inRange.length - 1]!.value / inRange[0]!.value - 1;
}

/** FR-TMR-1…4: rest timer computed from timestamps, so it survives backgrounding and locking. */
import type { Role, SettingsLike } from './types';

export interface RestTimer {
  startedAt: number;
  durationMs: number;
}

export const ADJUST_MS = 15_000;

export function restSecondsFor(
  role: Role,
  settings: Pick<SettingsLike, 'restCompoundSec' | 'restIsolationSec'>,
): number {
  return role === 'compound' ? settings.restCompoundSec : settings.restIsolationSec;
}

export function startTimer(now: number, seconds: number): RestTimer {
  return { startedAt: now, durationMs: seconds * 1000 };
}

export function remainingMs(t: RestTimer, now: number): number {
  return Math.max(0, t.startedAt + t.durationMs - now);
}

export function isDone(t: RestTimer, now: number): boolean {
  return remainingMs(t, now) === 0;
}

/** ±15 s (FR-TMR-3). Never goes below "done now". */
export function adjust(t: RestTimer, deltaMs: number, now: number): RestTimer {
  const elapsed = now - t.startedAt;
  return { ...t, durationMs: Math.max(elapsed, t.durationMs + deltaMs) };
}

export function endsAt(t: RestTimer): number {
  return t.startedAt + t.durationMs;
}

/** "1:24", "0:05", "12:00". Rounds up so the display hits 0:00 exactly when done. */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

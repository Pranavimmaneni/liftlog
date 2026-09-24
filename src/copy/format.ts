/** Formatting helpers for copy: reasons, dates and numbers (NFR-I18N-1: Intl for numbers and dates). */
import { en } from './en';
import { deltaIn, type Reason } from '@/engine/goal';
import { formatLoad } from '@/engine/units';
import type { LoadType, Units } from '@/engine/types';

/** FR-GOAL-5: the plain-English reason line shown with every target. */
export function formatReason(r: Reason, units: Units, loadType: LoadType): string {
  const d = r.deltaKg === undefined ? '' : `${deltaIn(units, r.deltaKg)} ${units}`;
  const R = en.reasons;
  switch (r.code) {
    case 'first':
      return R.first;
    case 'calibrated':
      return R.calibrated(formatLoad(r.loadKg ?? 0, loadType, units));
    case 'up':
      return R.up(d, r.reps ?? 0);
    case 'widen':
      return R.widen(r.reps ?? 0, d);
    case 'less_assist':
      return R.less_assist(d);
    case 'more_reps':
      return R.more_reps(r.reps ?? 0);
    case 'add_weight':
      return R.add_weight(r.reps ?? 0);
    case 'hold_reps':
      return R.hold_reps(r.reps ?? 0, r.set ?? 1);
    case 'hold_miss':
      return R.hold_miss(r.set ?? 1);
    default:
      return R[r.code];
  }
}

const nf = new Intl.NumberFormat('en');
export function formatInt(n: number): string {
  return nf.format(Math.round(n));
}

export function shortDate(t: number): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(t);
}

export function weekdayDate(t: number): string {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' })
    .format(t)
    .replace(',', ' ·');
}

export function longDate(t: number): string {
  // "Thu 24 Sep 2026"
  const d = new Date(t);
  const wd = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(d);
  const mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(d);
  return `${wd} ${d.getDate()} ${mo} ${d.getFullYear()}`;
}

export function monthName(t: number): string {
  return new Intl.DateTimeFormat('en', { month: 'long' }).format(t);
}

/** "today", "yesterday", "3 days ago", "last Mon" style used on S05/S14. */
export function relativeDays(t: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return shortDate(t);
}

export function lastWeekday(t: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const wd = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(t);
  if (days < 7) return `Last ${wd}`;
  return shortDate(t);
}

function startOfDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

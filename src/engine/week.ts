/** FR-RTN-5: weeks start on a configurable day (Monday by default). Dates are local. */

export const DAY_MS = 86_400_000;

export function dateKey(t: number | Date): string {
  const d = typeof t === 'number' ? new Date(t) : t;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Whole calendar days from a to b (DST-safe). */
export function daysBetween(a: number | Date, b: number | Date): number {
  const da = typeof a === 'number' ? new Date(a) : a;
  const db = typeof b === 'number' ? new Date(b) : b;
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

/** Local midnight at the start of the week containing `t`. weekStart: 0 = Sunday … 1 = Monday. */
export function startOfWeek(t: number, weekStart = 1): number {
  const d = new Date(t);
  const back = (d.getDay() - weekStart + 7) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}

export function addDays(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()).getTime();
}

export function weekRange(t: number, weekStart = 1): [number, number] {
  const s = startOfWeek(t, weekStart);
  return [s, addDays(s, 7)];
}

/** DECISIONS D27: week 1 is the week of the anchor (first session in the routine). */
export function weekNumber(t: number, anchor: number, weekStart = 1): number {
  const days = daysBetween(startOfWeek(anchor, weekStart), startOfWeek(t, weekStart));
  return Math.floor(days / 7) + 1;
}

/** Calendar month grid (S05): leading blanks for the week start, then day numbers. */
export function monthGrid(t: number, weekStart = 1): (number | null)[] {
  const d = new Date(t);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() - weekStart + 7) % 7;
  return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
}

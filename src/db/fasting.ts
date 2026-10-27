import { db } from './schema';
import { uid } from './ids';
import type { FastRow } from './types';

/** PRD-1.2 FR-FAST-1: start, end and edit fasts. One open fast at a time. */

export async function activeFast(): Promise<FastRow | undefined> {
  return (await db.fasts.orderBy('startedAt').reverse().toArray()).find((f) => f.endedAt === undefined);
}

/** Starts a fast, or returns the one already open. */
export async function startFast(planHours: number, now = Date.now()): Promise<FastRow> {
  const open = await activeFast();
  if (open) return open;
  const row: FastRow = { id: uid(), startedAt: now, planHours };
  await db.fasts.add(row);
  return row;
}

export async function endFast(id: string, now = Date.now()): Promise<void> {
  await db.fasts.update(id, { endedAt: now });
}

/** Fixes times entered late ("I started at 8 pm"). An end before the start is refused. */
export async function editFast(
  id: string,
  patch: Partial<Pick<FastRow, 'startedAt' | 'endedAt' | 'planHours'>>,
): Promise<boolean> {
  const cur = await db.fasts.get(id);
  if (!cur) return false;
  const next = { ...cur, ...patch };
  if (next.endedAt !== undefined && next.endedAt <= next.startedAt) return false;
  await db.fasts.put(next);
  return true;
}

export async function deleteFast(id: string): Promise<void> {
  await db.fasts.delete(id);
}

export async function fastsSince(from: number): Promise<FastRow[]> {
  return db.fasts.where('startedAt').aboveOrEqual(from).sortBy('startedAt');
}

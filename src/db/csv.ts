import { db } from './schema';
import { getExerciseMap } from './catalog';
import { dateKey } from '@/engine/week';

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** FR-DATA-5: sets as CSV (date, exercise, set, load, reps, effort) for spreadsheets. Loads in kg. */
export async function buildCsv(): Promise<string> {
  const [sets, sessions, map] = await Promise.all([
    db.sets.toArray(),
    db.sessions.toArray(),
    getExerciseMap(),
  ]);
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const rows = sets
    .filter((s) => byId.has(s.sessionId))
    .sort((a, b) => a.loggedAt - b.loggedAt)
    .map((s) =>
      [
        dateKey(byId.get(s.sessionId)!.startedAt),
        map.get(s.exerciseId)?.name ?? s.exerciseId,
        s.kind === 'warmup' ? `W${s.idx}` : `${s.idx}${s.side ?? ''}`,
        Math.round(s.loadKg * 100) / 100,
        s.reps,
        s.effort ?? '',
      ]
        .map(cell)
        .join(','),
    );
  return ['date,exercise,set,load_kg,reps,effort', ...rows].join('\n') + '\n';
}

export async function exportCsv(now = new Date()): Promise<{ name: string; blob: Blob }> {
  const text = await buildCsv();
  return { name: `liftlog-sets-${dateKey(now.getTime())}.csv`, blob: new Blob([text], { type: 'text/csv' }) };
}

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './schema';
import { getExerciseMap } from './catalog';
import { getSettings } from './settings';
import { goalFromHistory, historyFor } from './workout';
import { deloadStatus, type DeloadStatus } from '@/engine/deload';
import { startOfWeek, weekNumber } from '@/engine/week';

export interface DeloadInfo extends DeloadStatus {
  week: number;
}

const NONE: DeloadInfo = { thisWeek: false, nextWeek: false, reason: null, week: 1 };

/** FR-PRG-7: this week's and next week's deload status, derived from the log. */
export async function getDeload(now = Date.now()): Promise<DeloadInfo> {
  const [profile, routine, settings] = await Promise.all([
    db.profile.get('me'),
    db.routines.where('active').equals(1).first(),
    getSettings(),
  ]);
  if (!profile || !routine) return NONE;
  const finished = (
    await db.sessions.filter((s) => s.endedAt !== undefined && s.routineId === routine.id).toArray()
  ).sort((a, b) => a.startedAt - b.startedAt);
  if (!finished.length) return NONE;
  const anchor = finished[0]!.startedAt;
  const week = weekNumber(now, anchor, settings.weekStart);
  const ids = [...new Set(routine.sessions.flatMap((s) => s.items.map((i) => i.exerciseId)))];
  const map = await getExerciseMap();
  const weekStart = startOfWeek(now, settings.weekStart);
  const [nowHist, startHist] = await Promise.all([historyFor(ids), historyFor(ids, undefined, weekStart)]);
  const count = (h: typeof nowHist) =>
    ids.filter((id) => {
      const ex = map.get(id);
      return ex ? goalFromHistory(ex, h, profile).stalled : false;
    }).length;
  const lastDeload = [...finished].reverse().find((s) => s.deload);
  return {
    ...deloadStatus({
      level: profile.experience,
      week,
      stalledAtWeekStart: count(startHist),
      stalledNow: count(nowHist),
      lastDeloadWeek: lastDeload ? weekNumber(lastDeload.startedAt, anchor, settings.weekStart) : undefined,
    }),
    week,
  };
}

export function useDeload(): DeloadInfo | undefined {
  return useLiveQuery(() => getDeload(), []);
}

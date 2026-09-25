/**
 * FR-XP-1…6 + FR-DATA-2 read models: XP ledger, level, streak, weekly quest and the backup nudge,
 * all derived from the log (xp.json values; DECISIONS D4–D6, D65–D69).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './schema';
import { getExerciseMap } from './catalog';
import { getRawSetting, getSettings } from './settings';
import { setE1rm } from '@/engine/e1rm';
import { bodyweightOn } from '@/engine/load';
import { coverage } from '@/engine/coverage';
import { hardSetsByMuscle } from '@/engine/review';
import { sessionTotals } from '@/engine/summary';
import { addDays, dateKey, DAY_MS, startOfWeek } from '@/engine/week';
import {
  levelInfo,
  questFor,
  questProgress,
  streakFor,
  xpLedger,
  type LevelInfo,
  type Quest,
  type SessionXp,
  type Streak,
  type StreakWeek,
} from '@/engine/xp';
import type { SessionRow, SetRow } from './types';

/** Bodyweight pull-up / chin-up variants for the "first bodyweight pull-up" milestone. */
const PULLUPS = new Set(['pull-up', 'chin-up', 'v-bar-pullup', 'wide-grip-rear-pull-up']);

export interface Motivation {
  perSession: Map<string, SessionXp>;
  totalXp: number;
  level: LevelInfo;
  streak: Streak;
  quest: { quest: Quest; done: number; target: number; complete: boolean };
}

export async function getMotivation(now = Date.now()): Promise<Motivation | null> {
  const profile = await db.profile.get('me');
  if (!profile) return null;
  const [settings, sessionsRaw, allSets, prs, bodyweights, map, routine] = await Promise.all([
    getSettings(),
    db.sessions.filter((s) => s.endedAt !== undefined).toArray(),
    db.sets.toArray(),
    db.prs.toArray(),
    db.bodyweights.toArray(),
    getExerciseMap(),
    db.routines.where('active').equals(1).first(),
  ]);
  const sessions = sessionsRaw.sort((a, b) => a.startedAt - b.startedAt);
  const done = new Set(sessions.map((s) => s.id));
  const sets = allSets.filter((s) => done.has(s.sessionId));
  const bySession = new Map<string, SetRow[]>();
  for (const s of sets)
    (bySession.get(s.sessionId) ?? bySession.set(s.sessionId, []).get(s.sessionId)!).push(s);
  const planned = profile.daysPerWeek;
  const ws = settings.weekStart;
  const weekOf = (t: number) => startOfWeek(t, ws);

  // Weeks: completion (weekComplete XP + streak).
  const byWeek = new Map<number, SessionRow[]>();
  for (const s of sessions)
    (byWeek.get(weekOf(s.startedAt)) ?? byWeek.set(weekOf(s.startedAt), []).get(weekOf(s.startedAt))!).push(
      s,
    );
  const weekCompleteSessionIds = new Set<string>();
  for (const list of byWeek.values()) {
    const counted = list.filter((s) => !s.calibration);
    if (counted.length >= planned) weekCompleteSessionIds.add(counted[planned - 1]!.id);
  }
  const thisWeek = weekOf(now);
  const weeks: StreakWeek[] = [];
  if (sessions.length) {
    for (let w = weekOf(sessions[0]!.startedAt); w <= thisWeek; w = addDays(w, 7)) {
      const list = byWeek.get(w) ?? [];
      weeks.push({
        start: w,
        complete: list.filter((s) => !s.calibration).length >= planned,
        current: w === thisWeek,
      });
    }
  }

  // Per-session best e1RM per exercise, for "beat last time" (progress quest).
  const best = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    const bw = bodyweightOn(bodyweights, dateKey(s.startedAt));
    const m = new Map<string, number>();
    for (const set of bySession.get(s.id) ?? []) {
      const ex = map.get(set.exerciseId);
      if (!ex || set.hurts) continue;
      const e = setE1rm(set, ex.loadType, bw);
      if (e !== null) m.set(set.exerciseId, Math.max(m.get(set.exerciseId) ?? 0, e));
    }
    best.set(s.id, m);
  }
  const lastBest = new Map<string, number>();
  const progressedBy = new Map<string, Set<string>>(); // sessionId → exercises beaten
  for (const s of sessions) {
    const beaten = new Set<string>();
    for (const [id, e] of best.get(s.id)!) {
      const prev = lastBest.get(id);
      if (prev !== undefined && e > prev + 1e-9) beaten.add(id);
      lastBest.set(id, e);
    }
    progressedBy.set(s.id, beaten);
  }

  // Planned hard sets per muscle from the routine (quest basis).
  const routineSessions = (routine?.sessions ?? []).map((s) =>
    [...s.items].sort((a, b) => a.order - b.order).map((i) => i.exerciseId),
  );
  const plannedMuscles = coverage(routineSessions, map, profile).filter((c) => c.sets > 0);

  const questSessionIds = new Set<string>();
  const questOf = (w: number): Quest => {
    const prevList = byWeek.get(addDays(w, -7));
    const trained = sessions.length > 0 && weekOf(sessions[0]!.startedAt) < w;
    if (!trained) return questFor({ previous: null, sessionsPlanned: planned });
    const prevSets = (prevList ?? []).flatMap((s) => bySession.get(s.id) ?? []);
    const doneSets = hardSetsByMuscle(prevSets, map);
    return questFor({
      previous: {
        sessionsDone: prevList?.length ?? 0,
        sessionsPlanned: planned,
        muscles: plannedMuscles.map((c) => ({
          muscle: c.muscle,
          done: doneSets.get(c.muscle)!,
          planned: c.sets,
        })),
      },
      sessionsPlanned: planned,
    });
  };
  const progressIn = (list: SessionRow[]) => {
    const beaten = new Set<string>();
    for (const s of list) progressedBy.get(s.id)?.forEach((id) => beaten.add(id));
    return {
      sessionsDone: list.length,
      muscleSets: hardSetsByMuscle(
        list.flatMap((s) => bySession.get(s.id) ?? []),
        map,
      ),
      progressed: beaten.size,
    };
  };
  for (const [w, list] of byWeek) {
    const q = questOf(w);
    for (let k = 1; k <= list.length; k++) {
      if (questProgress(q, progressIn(list.slice(0, k))).complete) {
        questSessionIds.add(list[k - 1]!.id);
        break;
      }
    }
  }

  const ledger = xpLedger({
    sessions: sessions.map((s) => {
      const own = bySession.get(s.id) ?? [];
      return {
        id: s.id,
        startedAt: s.startedAt,
        calibration: s.calibration,
        tonnageKg: sessionTotals(
          own,
          map,
          bodyweightOn(bodyweights, dateKey(s.startedAt)),
          s.startedAt,
          s.endedAt!,
        ).tonnageKg,
        bwPullup: own.some(
          (x) => PULLUPS.has(x.exerciseId) && x.kind !== 'warmup' && x.loadKg === 0 && x.reps >= 1,
        ),
      };
    }),
    sets,
    prSetIds: new Set(prs.map((p) => p.setId)),
    weekCompleteSessionIds,
    questSessionIds,
  });
  const totalXp = ledger.length ? ledger[ledger.length - 1]!.cumulative : 0;
  const q = questOf(thisWeek);
  return {
    perSession: new Map(ledger.map((l) => [l.sessionId, l])),
    totalXp,
    level: levelInfo(totalXp),
    streak: streakFor(weeks),
    quest: { quest: q, ...questProgress(q, progressIn(byWeek.get(thisWeek) ?? [])) },
  };
}

export function useMotivation(): Motivation | null | undefined {
  return useLiveQuery(() => getMotivation(), []);
}

// ---------- FR-DATA-2 backup nudge ----------

export interface BackupNudge {
  reason: 'days' | 'sessions';
  days: number | null;
  sessions: number;
}

/**
 * Due 7 days after the last backup (or after the first session, if never backed up), and after
 * every 10th session. "Not now" hides it until the next trigger (D69).
 */
export async function getBackupNudge(now = Date.now()): Promise<BackupNudge | null> {
  const [last, dismissed, sessions] = await Promise.all([
    db.meta.get('lastBackupAt'),
    getRawSetting<number>('backupNudgeDismissedAt'),
    db.sessions.filter((s) => s.endedAt !== undefined).toArray(),
  ]);
  if (!sessions.length) return null;
  sessions.sort((a, b) => a.endedAt! - b.endedAt!);
  const lastAt = (last?.value as number | undefined) ?? null;
  const since = lastAt ?? sessions[0]!.endedAt!;
  const dueDays = since + 7 * DAY_MS;
  const tenth = sessions.length >= 10 ? sessions[Math.floor(sessions.length / 10) * 10 - 1]!.endedAt! : null;
  const triggers: { at: number; reason: BackupNudge['reason'] }[] = [];
  if (now >= dueDays) triggers.push({ at: dueDays, reason: 'days' });
  if (tenth !== null && (lastAt === null || lastAt < tenth)) triggers.push({ at: tenth, reason: 'sessions' });
  const open = triggers
    .filter((t) => dismissed === undefined || dismissed < t.at)
    .sort((a, b) => b.at - a.at)[0];
  if (!open) return null;
  return {
    reason: open.reason,
    days: lastAt === null ? null : Math.floor((now - lastAt) / DAY_MS),
    sessions: sessions.length,
  };
}

export function useBackupNudge(): BackupNudge | null | undefined {
  return useLiveQuery(() => getBackupNudge(), []);
}

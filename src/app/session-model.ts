import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { getSettings, type Settings } from '@/db/settings';
import { useExerciseMap } from '@/db/catalog';
import { goalFromHistory, historyFor, type History } from '@/db/workout';
import type { BodyweightRow, GoalRow, ProfileRow, SessionRow, SetRow } from '@/db/types';
import { exerciseProgress, goalMeter, type ExerciseProgress, type Meter } from '@/engine/goalset';
import { bodyweightOn } from '@/engine/load';
import { warmupEligible } from '@/engine/warmup';
import { dateKey, weekNumber } from '@/engine/week';
import { exposuresFrom, goalFor, type Goal } from '@/engine/goal';
import { bestE1rmByExercise, findPrs } from '@/engine/summary';
import type { Exercise, Side } from '@/engine/types';

export interface ItemModel {
  exercise: Exercise;
  planned: boolean;
  goal: Goal;
  /** The engine's own pick, before any S24 override. */
  coachGoal: Goal;
  overridden: boolean;
  /** Target for the next exposure if this one ended now (the "Next time" line). */
  next: Goal | null;
  /** FR-XP-3: the set in this session that is a new e1RM best for the exercise (stamped on its row). */
  prSetId: string | null;
  /** This session's sets for the exercise, in log order. */
  sets: SetRow[];
  warmupsLogged: SetRow[];
  work: SetRow[];
  progress: ExerciseProgress;
  /** All planned sets done (pairs for unilateral). */
  complete: boolean;
  nextIdx: number;
  nextSide?: Side;
  last: { at: number; sets: SetRow[] } | null;
}

export interface SessionModel {
  session: SessionRow;
  items: ItemModel[];
  meter: Meter;
  current?: ItemModel;
  profile: ProfileRow;
  settings: Settings;
  bodyweightKg: number | null;
  sessionNumber: number;
  weekNumber: number;
}

export interface SessionRaw {
  session: SessionRow;
  sets: SetRow[];
  history: History;
  goals: GoalRow[];
  bodyweights: BodyweightRow[];
  profile: ProfileRow;
  settings: Settings;
  finishedBefore: number;
  anchor: number;
}

/** Next set index and side for an exercise (FR-WRK-14: unilateral logs Left then Right). */
export function nextSetFor(work: SetRow[], unilateral: boolean): { idx: number; side?: Side } {
  if (!unilateral) return { idx: work.reduce((m, s) => Math.max(m, s.idx), 0) + 1 };
  const byIdx = new Map<number, Set<Side>>();
  for (const s of work) byIdx.set(s.idx, (byIdx.get(s.idx) ?? new Set()).add(s.side ?? 'L'));
  const idxs = [...byIdx.keys()].sort((a, b) => a - b);
  for (const i of idxs) {
    const sides = byIdx.get(i)!;
    if (!sides.has('L')) return { idx: i, side: 'L' };
    if (!sides.has('R')) return { idx: i, side: 'R' };
  }
  return { idx: (idxs[idxs.length - 1] ?? 0) + 1, side: 'L' };
}

export function buildSessionModel(raw: SessionRaw, exMap: Map<string, Exercise>): SessionModel {
  const { session, profile } = raw;
  const bw = bodyweightOn(raw.bodyweights, dateKey(session.startedAt));
  const plan = session.plan
    .map((p) => ({ ...p, exercise: exMap.get(p.exerciseId) }))
    .filter((p) => p.exercise);
  const warm = warmupEligible(plan.filter((p) => p.planned).map((p) => p.exercise!));
  const goalsById = new Map(raw.goals.map((g) => [g.exerciseId, g]));
  const items: ItemModel[] = plan.map((p) => {
    const ex = p.exercise!;
    const override = goalsById.get(ex.id)?.override ?? null;
    const goal = goalFromHistory(ex, raw.history, profile, {
      deload: session.deload,
      override,
      warmupEligible: warm.has(ex.id),
      warmupsEnabled: raw.settings.warmups,
    });
    const coachGoal = override ? goalFromHistory(ex, raw.history, profile, { deload: session.deload }) : goal;
    const sets = raw.sets.filter((s) => s.exerciseId === ex.id).sort((a, b) => a.loggedAt - b.loggedAt);
    const work = sets.filter((s) => s.kind !== 'warmup');
    const progress = exerciseProgress(work, goal, ex.loadType, ex.unilateral, bw);
    const next = nextSetFor(work, ex.unilateral);
    const own = raw.history.sets.filter((s) => s.exerciseId === ex.id && s.kind !== 'warmup');
    let last: ItemModel['last'] = null;
    for (const s of own) {
      const at = raw.history.sessions.get(s.sessionId)!.startedAt;
      if (!last || at > last.at) last = { at, sets: [] };
    }
    if (last) {
      const lastSession = [...raw.history.sessions.entries()].find(([, v]) => v.startedAt === last!.at)?.[0];
      last.sets = own
        .filter((s) => s.sessionId === lastSession)
        .sort((a, b) => a.idx - b.idx || a.loggedAt - b.loggedAt);
    }
    const prior = bestE1rmByExercise(own, exMap, (x) =>
      bodyweightOn(
        raw.bodyweights,
        dateKey(raw.history.sessions.get(x.sessionId)?.startedAt ?? session.startedAt),
      ),
    );
    const pr = findPrs(work, prior, exMap, () => goal.repMin, bw)[0];
    return {
      exercise: ex,
      planned: p.planned,
      prSetId: pr?.setId ?? null,
      goal,
      coachGoal,
      overridden: !!override,
      next:
        work.length > 0
          ? goalFor(
              ex,
              [
                ...exposuresFrom(own, raw.history.sessions),
                { at: session.startedAt, deload: session.deload, sets: work },
              ],
              profile,
            )
          : null,
      sets,
      warmupsLogged: sets.filter((s) => s.kind === 'warmup'),
      work,
      progress,
      complete: progress.logged >= goal.sets,
      nextIdx: next.idx,
      nextSide: next.side,
      last,
    };
  });
  const meter = goalMeter(items.map((i) => ({ target: i.goal, progress: i.progress, planned: i.planned })));
  const current = items.find((i) => i.planned && !i.complete) ?? items.find((i) => !i.complete);
  return {
    session,
    items,
    meter,
    current,
    profile,
    settings: raw.settings,
    bodyweightKg: bw,
    sessionNumber: raw.finishedBefore + 1,
    weekNumber: weekNumber(session.startedAt, raw.anchor, raw.settings.weekStart),
  };
}

export async function loadSessionRaw(sessionId: string): Promise<SessionRaw | null> {
  const session = await db.sessions.get(sessionId);
  const profile = await db.profile.get('me');
  if (!session || !profile) return null;
  const ids = session.plan.map((p) => p.exerciseId);
  const [sets, history, goals, bodyweights, settings, finished] = await Promise.all([
    db.sets.where('sessionId').equals(sessionId).toArray(),
    historyFor(ids, sessionId, session.startedAt),
    db.goals.where('exerciseId').anyOf(ids).toArray(),
    db.bodyweights.toArray(),
    getSettings(),
    db.sessions.filter((s) => s.endedAt !== undefined && s.startedAt < session.startedAt).toArray(),
  ]);
  const routineSessions = finished.filter((s) => s.routineId === session.routineId);
  const anchor = Math.min(session.startedAt, ...routineSessions.map((s) => s.startedAt));
  return {
    session,
    sets,
    history,
    goals,
    bodyweights,
    profile,
    settings,
    finishedBefore: finished.length,
    anchor,
  };
}

/** Live view model for a session (S06/S07/S08). undefined while loading, null if missing. */
export function useSessionModel(sessionId: string | undefined): SessionModel | null | undefined {
  const exMap = useExerciseMap();
  const raw = useLiveQuery(
    () => (sessionId ? loadSessionRaw(sessionId) : Promise.resolve(null)),
    [sessionId],
  );
  return useMemo(() => {
    if (raw === undefined || !exMap) return undefined;
    if (raw === null) return null;
    return buildSessionModel(raw, exMap);
  }, [raw, exMap]);
}

/** The open session, if any (FR-WRK-13 resume). */
export function useActiveSessionId(): string | null | undefined {
  return useLiveQuery(async () => {
    const open = await db.sessions.filter((s) => s.endedAt === undefined).toArray();
    return open.sort((a, b) => b.startedAt - a.startedAt)[0]?.id ?? null;
  }, []);
}

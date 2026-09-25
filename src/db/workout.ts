/**
 * Workout writes. FR-WRK-13 / NFR-REL-1: every set is written to IndexedDB the moment it's logged,
 * in its own transaction, so killing the app loses nothing and reopening resumes the session.
 */
import { db } from './schema';
import { uid } from './ids';
import { getActiveRoutine, advanceQueue } from './repo';
import { getExerciseMap } from './catalog';
import type { GoalRow, SessionRow, SetRow } from './types';
import { exposuresFrom, goalFor, type Goal } from '@/engine/goal';
import { setE1rm } from '@/engine/e1rm';
import { bodyweightOn } from '@/engine/load';
import { dateKey } from '@/engine/week';
import { prescribe } from '@/engine/prescription';
import type { Effort, Exercise, ProfileLike, SetKind, Side, Target } from '@/engine/types';
import { formatReason } from '@/copy/format';
import { en } from '@/copy/en';

/** FR-WRK-12: a session auto-finishes after 3 h idle. */
export const AUTO_FINISH_MS = 3 * 60 * 60 * 1000;

export async function getActiveSession(): Promise<SessionRow | undefined> {
  const open = await db.sessions.filter((s) => s.endedAt === undefined).toArray();
  return open.sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** FR-WRK-1: creates a session from the up-next routine session (resumes an open one instead). */
export async function startSession(input: {
  routineId?: string;
  routineSessionId: string;
  name: string;
  exerciseIds: string[];
  deload?: boolean;
  now?: number;
}): Promise<SessionRow> {
  const open = await getActiveSession();
  if (open) return open;
  const now = input.now ?? Date.now();
  const row: SessionRow = {
    id: uid(),
    startedAt: now,
    routineId: input.routineId,
    routineSessionId: input.routineSessionId,
    name: input.name,
    calibration: false,
    deload: !!input.deload,
    plan: input.exerciseIds.map((exerciseId) => ({ exerciseId, planned: true })),
    lastActivityAt: now,
  };
  await db.sessions.add(row);
  return row;
}

/** FR-WRK-10: unplanned exercises are logged the same way but don't count toward the meter. */
export async function addToSession(sessionId: string, exerciseId: string): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s || s.plan.some((p) => p.exerciseId === exerciseId)) return;
    await db.sessions.put({ ...s, plan: [...s.plan, { exerciseId, planned: false }] });
  });
}

/** S23 "this session only": replaces one exercise in the session plan. */
export async function swapInSession(sessionId: string, fromId: string, toId: string): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const plan = s.plan.map((p) => (p.exerciseId === fromId ? { ...p, exerciseId: toId } : p));
    await db.sessions.put({
      ...s,
      plan: plan.filter((p, i) => plan.findIndex((q) => q.exerciseId === p.exerciseId) === i),
    });
  });
}

export interface LogSetInput {
  sessionId: string;
  exerciseId: string;
  idx: number;
  kind: SetKind;
  loadKg: number;
  reps: number;
  side?: Side;
  effort?: Effort;
  goalMet: boolean;
  bonusReps: number;
  now?: number;
}

/** NFR-PERF-2: one small transaction per set. */
export async function logSet(input: LogSetInput): Promise<SetRow> {
  const now = input.now ?? Date.now();
  const row: SetRow = {
    id: uid(),
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    idx: input.idx,
    kind: input.kind,
    loadKg: input.loadKg,
    reps: input.reps,
    side: input.side,
    effort: input.effort,
    hurts: false,
    goalMet: input.goalMet,
    bonusReps: input.bonusReps,
    loggedAt: now,
  };
  await db.transaction('rw', db.sets, db.sessions, async () => {
    await db.sets.add(row);
    await db.sessions.update(input.sessionId, { lastActivityAt: now });
  });
  return row;
}

/** FR-WRK-11: edit a past set; derived numbers recompute because they're computed from the log. */
export async function updateSet(
  id: string,
  patch: Partial<Pick<SetRow, 'loadKg' | 'reps' | 'effort' | 'hurts' | 'goalMet' | 'bonusReps'>>,
): Promise<void> {
  await db.sets.update(id, patch);
  const s = await db.sets.get(id);
  if (s) await rebuildPrs(s.exerciseId);
}

export async function deleteSet(id: string): Promise<void> {
  const s = await db.sets.get(id);
  await db.sets.delete(id);
  if (s) await rebuildPrs(s.exerciseId);
}

/** FR-WRK-6: effort chip (Easy / Solid / Hard); "Hurts" sits behind a menu (FR-PRG-6). */
export async function setEffort(id: string, effort: Effort | undefined): Promise<void> {
  await db.sets.update(id, { effort });
}

export async function setHurts(id: string, hurts: boolean): Promise<void> {
  await db.sets.update(id, { hurts });
}

// ---------- goals & history ----------

export interface History {
  sets: SetRow[];
  sessions: Map<string, { startedAt: number; deload: boolean }>;
}

/**
 * Finished sessions' sets for these exercises, optionally excluding one session and/or only
 * sessions that started before `before` (so a past session is scored against its own past).
 */
export async function historyFor(
  exerciseIds: string[],
  excludeSessionId?: string,
  before?: number,
): Promise<History> {
  const finished = await db.sessions
    .filter(
      (s) =>
        s.endedAt !== undefined &&
        s.id !== excludeSessionId &&
        (before === undefined || s.startedAt < before),
    )
    .toArray();
  const sessions = new Map(finished.map((s) => [s.id, { startedAt: s.startedAt, deload: s.deload }]));
  const sets = exerciseIds.length
    ? (await db.sets.where('exerciseId').anyOf(exerciseIds).toArray()).filter((s) =>
        sessions.has(s.sessionId),
      )
    : [];
  return { sets, sessions };
}

export function goalFromHistory(
  ex: Exercise,
  history: History,
  profile: ProfileLike,
  opts: {
    deload?: boolean;
    override?: Target | null;
    warmupEligible?: boolean;
    warmupsEnabled?: boolean;
  } = {},
): Goal {
  const own = history.sets.filter((s) => s.exerciseId === ex.id);
  return goalFor(ex, exposuresFrom(own, history.sessions), profile, opts);
}

function sameTarget(a: Target, b: Target): boolean {
  return (
    a.sets === b.sets &&
    a.repMin === b.repMin &&
    a.repMax === b.repMax &&
    (a.loadKg ?? -1) === (b.loadKg ?? -1)
  );
}

const pickTarget = (g: Target): Target => ({
  sets: g.sets,
  repMin: g.repMin,
  repMax: g.repMax,
  loadKg: g.loadKg,
});

/**
 * FR-PRG-8: after an exposure, records every target change with a human reason, refreshes the goals
 * cache and clears one-exposure overrides (S24).
 */
async function recordGoalChanges(
  exercises: Exercise[],
  sessionId: string,
  profile: ProfileLike,
  now: number,
): Promise<void> {
  const ids = exercises.map((e) => e.id);
  const before = await historyFor(ids, sessionId);
  const after = await historyFor(ids);
  for (const ex of exercises) {
    const from = goalFromHistory(ex, before, profile);
    const to = goalFromHistory(ex, after, profile);
    const prev = await db.goals.get(ex.id);
    const reason = formatReason(to.reason, profile.units, ex.loadType);
    const row: GoalRow = {
      exerciseId: ex.id,
      ...pickTarget(to),
      reason,
      frozen: to.frozen,
      missStreak: 0,
      updatedAt: now,
      exposures: (prev?.exposures ?? 0) + 1,
      suggestLoadType: to.suggestLoadType,
    };
    await db.goals.put(row);
    if (from.loadKg !== null && !sameTarget(from, to)) {
      await db.goalChanges.add({
        exerciseId: ex.id,
        from: pickTarget(from),
        to: pickTarget(to),
        reason,
        at: now,
        overridden: false,
      });
    }
  }
}

/** Rebuilds the PR cache for one exercise from the log (DECISIONS D13, D14). */
export async function rebuildPrs(exerciseId: string): Promise<void> {
  const map = await getExerciseMap();
  const ex = map.get(exerciseId);
  const profile = await db.profile.get('me');
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  const sessions = new Map((await db.sessions.toArray()).map((s) => [s.id, s]));
  const bws = await db.bodyweights.toArray();
  await db.transaction('rw', db.prs, async () => {
    await db.prs.where('exerciseId').equals(exerciseId).delete();
    if (!ex || !profile) return;
    const repMin = prescribe(profile, ex.role).repMin;
    const bySession = new Map<string, SetRow[]>();
    for (const s of sets) {
      const sess = sessions.get(s.sessionId);
      if (!sess?.endedAt || s.kind === 'warmup' || s.hurts) continue;
      bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
    }
    const ordered = [...bySession.entries()].sort(
      (a, b) => sessions.get(a[0])!.startedAt - sessions.get(b[0])!.startedAt,
    );
    let best: number | null = null;
    for (const [sid, list] of ordered) {
      const bw = bodyweightOn(bws, dateKey(sessions.get(sid)!.startedAt));
      let top: { e: number; s: SetRow } | null = null;
      for (const s of list) {
        const e = setE1rm(s, ex.loadType, bw);
        if (e !== null && (!top || e > top.e)) top = { e, s };
      }
      if (!top) continue;
      if (best !== null && top.e > best + 1e-6 && top.s.reps >= repMin) {
        await db.prs.add({
          exerciseId,
          e1rm: top.e,
          loadKg: top.s.loadKg,
          reps: top.s.reps,
          setId: top.s.id,
          at: top.s.loggedAt,
          prevE1rm: best,
        });
      }
      best = Math.max(best ?? 0, top.e);
    }
  });
}

export type FinishResult = { status: 'finished'; sessionId: string } | { status: 'discarded' };

/**
 * FR-WRK-12: finish at any time. 0 work sets → discarded (the UI confirms first).
 * Marks calibration sessions (D26), advances the rotation (FR-RTN-4), logs goal changes, rebuilds PRs.
 */
export async function finishSession(
  sessionId: string,
  opts: { now?: number; auto?: boolean } = {},
): Promise<FinishResult> {
  const session = await db.sessions.get(sessionId);
  if (!session) return { status: 'discarded' };
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  const work = sets.filter((s) => s.kind !== 'warmup');
  if (!work.length) {
    await discardSession(sessionId);
    return { status: 'discarded' };
  }
  const now = opts.now ?? Date.now();
  const endedAt = opts.auto ? (session.lastActivityAt ?? now) : now;
  const exerciseIds = [...new Set(work.map((s) => s.exerciseId))];
  const prior = await historyFor(exerciseIds, sessionId);
  const calibration = exerciseIds.every((id) => !prior.sets.some((s) => s.exerciseId === id));
  await db.sessions.put({ ...session, endedAt, calibration, autoFinished: !!opts.auto });

  const routine = await getActiveRoutine();
  if (
    routine &&
    session.routineId === routine.id &&
    routine.sessions.some((r) => r.id === session.routineSessionId)
  ) {
    await advanceQueue(routine, session.routineSessionId);
  }
  const profile = await db.profile.get('me');
  const map = await getExerciseMap();
  const exercises = exerciseIds.map((id) => map.get(id)).filter((e): e is Exercise => !!e);
  if (profile) {
    await recordGoalChanges(exercises, sessionId, profile, now);
    // S24 overrides apply to one exposure only.
    for (const id of exerciseIds) {
      const g = await db.goals.get(id);
      if (g?.override) {
        const { override: _o, ...rest } = g;
        await db.goals.put(rest);
      }
    }
  }
  for (const id of exerciseIds) await rebuildPrs(id);
  return { status: 'finished', sessionId };
}

export async function discardSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

/** S18: deletes a finished session and its sets, then rebuilds PRs for the exercises in it. */
export async function deleteSession(sessionId: string): Promise<void> {
  const ids = [
    ...new Set((await db.sets.where('sessionId').equals(sessionId).toArray()).map((s) => s.exerciseId)),
  ];
  await discardSession(sessionId);
  for (const id of ids) await rebuildPrs(id);
}

/** FR-WRK-12: finishes (or discards) a session idle for more than 3 hours. */
export async function autoFinishStale(now = Date.now()): Promise<string | null> {
  const s = await getActiveSession();
  if (!s) return null;
  if (now - (s.lastActivityAt ?? s.startedAt) < AUTO_FINISH_MS) return null;
  await finishSession(s.id, { now, auto: true });
  return s.id;
}

/** S24: override the next exposure's target. */
export async function setOverride(exerciseId: string, target: Target | null): Promise<void> {
  const cur = await db.goals.get(exerciseId);
  const base: GoalRow = cur ?? {
    exerciseId,
    sets: target?.sets ?? 3,
    repMin: target?.repMin ?? 8,
    repMax: target?.repMax ?? 10,
    loadKg: target?.loadKg ?? null,
    reason: '',
    frozen: false,
    missStreak: 0,
    updatedAt: Date.now(),
  };
  if (target) {
    await db.goals.put({ ...base, override: { ...target } });
    await db.goalChanges.add({
      exerciseId,
      from: { sets: base.sets, repMin: base.repMin, repMax: base.repMax, loadKg: base.loadKg },
      to: target,
      reason: en.reasons.override,
      at: Date.now(),
      overridden: true,
    });
  } else {
    const { override: _o, ...rest } = base;
    await db.goals.put(rest);
  }
}

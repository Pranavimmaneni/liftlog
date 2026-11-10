import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { muscleName } from '@/components/ExerciseRow';
import { db } from '@/db/schema';
import { useExerciseMap } from '@/db/catalog';
import { useSettings } from '@/db/settings';
import { upNextOf, useActiveRoutine, useProfile, useQueue } from '@/db/repo';
import { goalFromHistory, historyFor, startSession } from '@/db/workout';
import { useActiveSessionId } from '@/app/session-model';
import { useDeload } from '@/db/deload';
import { INTENSITY } from '@/engine/data';
import { estimateMinutes } from '@/engine/summary';
import { rotationOrder } from '@/engine/rotation';
import { dateKey, monthGrid, weekRange } from '@/engine/week';
import { platform } from '@/platform';
import { useBackupNudge, useMotivation } from '@/db/motivation';

const GOING_UP = new Set(['up', 'less_assist', 'more_reps']);

/**
 * Everything the Today tab shows (FR-RTN-4, FR-RTN-5, FR-WRK-1), shared by the classic screen and
 * the Rising Sun one so both always agree. Returns null while the profile and routine load.
 */
export function useHomeData() {
  const navigate = useNavigate();
  const profile = useProfile();
  const routine = useActiveRoutine();
  const queue = useQueue();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const activeId = useActiveSessionId();
  const deload = useDeload();
  const motivation = useMotivation();
  const nudge = useBackupNudge();
  const [starting, setStarting] = useState(false);
  const now = Date.now();

  const next = upNextOf(routine, queue);
  const nextIds = useMemo(
    () =>
      next && routine
        ? [...routine.sessions[next.sessionIndex]!.items]
            .sort((a, b) => a.order - b.order)
            .map((i) => i.exerciseId)
        : [],
    [next, routine],
  );

  const data = useLiveQuery(async () => {
    const finished = (await db.sessions.filter((s) => s.endedAt !== undefined).toArray()).sort(
      (a, b) => a.startedAt - b.startedAt,
    );
    const bws = await db.bodyweights.orderBy('date').toArray();
    const history = await historyFor(nextIds);
    return { finished, lastBw: bws[bws.length - 1] ?? null, history };
  }, [nextIds.join(',')]);

  const preview = useMemo(() => {
    if (!exMap || !profile || !data) return null;
    const exs = nextIds.map((id) => exMap.get(id)).filter((e) => !!e);
    const goals = exs.map((e) => goalFromHistory(e!, data.history, profile));
    const sets = goals.reduce((n, g) => n + g.sets, 0);
    const minutes = estimateMinutes(
      exs.map((e, i) => ({ role: e!.role, sets: goals[i]!.sets })),
      INTENSITY.secondsPerSetIncludingRest,
    );
    const muscles = [...new Set(exs.map((e) => muscleName(e!.primary[0]).toLowerCase()))].slice(0, 4);
    const up = goals.filter((g) => GOING_UP.has(g.reason.code)).length;
    const lastSame = next
      ? [...data.finished].reverse().find((s) => s.routineSessionId === next.session.id)
      : undefined;
    return { exs: exs as NonNullable<(typeof exs)[number]>[], sets, minutes, muscles, up, lastSame };
  }, [exMap, profile, data, nextIds, next]);

  const lastSameMeter = useLiveQuery(async () => {
    const s = preview?.lastSame;
    if (!s) return null;
    const sets = await db.sets.where('sessionId').equals(s.id).toArray();
    const work = sets.filter((x) => x.kind === 'work');
    return { done: work.filter((x) => x.goalMet).length, total: work.length, at: s.startedAt };
  }, [preview?.lastSame?.id]);

  if (profile === undefined || routine === undefined) return null;
  const units = profile?.units ?? 'kg';

  // This week (FR-RTN-5): planned = days per week; tiles follow the rotation order.
  const [wStart, wEnd] = weekRange(now, settings.weekStart);
  const doneThisWeek = (data?.finished ?? []).filter((s) => s.startedAt >= wStart && s.startedAt < wEnd);
  const doneIds = new Set(doneThisWeek.map((s) => s.routineSessionId));
  const order = routine && queue ? rotationOrder(routine, queue) : [];
  const planned = profile?.daysPerWeek ?? order.length;

  const sessionDays = new Set((data?.finished ?? []).map((s) => dateKey(s.startedAt)));
  const grid = monthGrid(now, settings.weekStart);
  const today = new Date(now);

  const start = async () => {
    if (activeId) return navigate('/workout');
    if (!routine || !next) return;
    setStarting(true);
    // FR-WRK-1: the tap unlocks audio (FR-PLT-3) and requests wake lock (FR-PLT-2).
    platform.unlockAudio();
    void platform.keepAwake(true);
    await startSession({
      routineId: routine.id,
      routineSessionId: next.session.id,
      name: next.session.name,
      exerciseIds: nextIds,
      deload: deload?.thisWeek,
    });
    navigate('/workout');
  };

  return {
    profile,
    routine,
    settings,
    activeId,
    deload,
    motivation,
    nudge,
    starting,
    now,
    next,
    nextIds,
    data,
    preview,
    lastSameMeter,
    units,
    doneThisWeek,
    doneIds,
    order,
    planned,
    sessionDays,
    grid,
    today,
    start,
  };
}

export type HomeData = NonNullable<ReturnType<typeof useHomeData>>;

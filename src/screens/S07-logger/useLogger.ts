import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { muscleName } from '@/components/ExerciseRow';
import { en } from '@/copy/en';
import { useSessionModel } from '@/app/session-model';
import { useRest } from '@/app/rest-store';
import { getActiveRoutine, updateRoutineSessions } from '@/db/repo';
import { logSet } from '@/db/workout';
import type { SetRow } from '@/db/types';
import { nudgeAfterSet } from '@/engine/calibration';
import { bonusReps, isGoalSet } from '@/engine/goalset';
import { restSecondsFor } from '@/engine/timer';
import {
  displayNumber,
  formatLoad,
  fromDisplay,
  hasLoad,
  incrementIn,
  loadUnitLabel,
  toDisplay,
} from '@/engine/units';
import type { Effort, Exercise, Units } from '@/engine/types';
import { platform } from '@/platform';
import { ripple } from '@/app/echo';

export const EFFORTS: Effort[] = ['easy', 'solid', 'hard'];

/** A sensible first load for calibration (the stepper starts empty, FR-GOAL-4). */
export function calibrationStart(ex: Exercise, units: Units): number {
  const base: Record<string, number> = {
    barbell: 20,
    dumbbell: 10,
    kettlebell: 12,
    machine_stack: 20,
    plate_loaded: 40,
    cable: 10,
    assisted: 30,
    bodyweight_plus: 0,
  };
  const kg = base[ex.loadType] ?? 10;
  return Math.round(toDisplay(kg, units));
}

export function repsText(g: { repMin: number; repMax: number }) {
  return g.repMin === g.repMax ? `${g.repMin}` : `${g.repMin}–${g.repMax}`;
}

/**
 * State and actions of the set logger (S07 free weight / S08 machine), shared by the classic screen
 * and the Rising Sun one. FR-WRK-4/5/6/7/9/14, FR-TMR-1, FR-GOAL-5.
 */
export function useLogger() {
  const { exerciseId = '' } = useParams();
  const { sessionId } = useOutletContext<{ sessionId: string }>();
  const model = useSessionModel(sessionId);
  const navigate = useNavigate();
  const startRest = useRest((s) => s.start);
  const skipRest = useRest((s) => s.skip);
  const item = model?.items.find((i) => i.exercise.id === exerciseId);
  const units = model?.profile.units ?? 'kg';

  const [load, setLoad] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [extra, setExtra] = useState(false);
  const [editing, setEditing] = useState<SetRow | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [swap, setSwap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nudgeUsed, setNudgeUsed] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const lastWork = item?.work[item.work.length - 1];
  const key = item ? `${item.nextIdx}-${item.nextSide ?? ''}-${item.work.length}` : '';

  // FR-WRK-5 / D46: pre-fill with the previous set in this session, else the goal.
  useEffect(() => {
    if (!item) return;
    const g = item.goal;
    const prev = lastWork;
    const lt = item.exercise.loadType;
    if (hasLoad(lt)) {
      const kg = prev ? prev.loadKg : g.loadKg;
      setLoad(kg === null ? null : Math.round(toDisplay(kg, units) * 10) / 10);
    } else setLoad(0);
    setReps(prev ? Math.max(prev.reps, g.repMin) : g.repMax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, item?.goal.loadKg, units]);

  const nudge = useMemo(() => {
    if (!item || !lastWork || lastWork.kind === 'warmup') return null;
    if (item.exercise.unilateral && lastWork.side === 'L') return null;
    return nudgeAfterSet(lastWork, item.goal, item.exercise, units);
  }, [item, lastWork, units]);

  if (model === null) return { status: 'gone' as const };
  if (!model) return { status: 'loading' as const };
  // After a swap the live data may be one tick behind the URL, so only leave if it stays missing.
  if (!item) return { status: 'missing' as const };

  const ex = item.exercise;
  const g = item.goal;
  const lt = ex.loadType;
  const isMachine = !!ex.machineId;
  const done = item.complete && !extra;
  const idx = item.nextIdx;
  // Warm-ups are offered until the first work set; after that they're skipped, not nagged about.
  const pendingWarmups = item.work.length ? [] : g.warmups.slice(item.warmupsLogged.length);
  const unitLabel = loadUnitLabel(lt, units);
  const incDisplay = incrementIn(units, ex.incrementKg, lt) || (units === 'kg' ? 1 : 2);
  const doneCount = Math.min(item.progress.logged, g.sets);

  const log = async () => {
    if (busy) return;
    if (hasLoad(lt) && (load === null || load < 0)) return;
    setBusy(true);
    const loadKg = hasLoad(lt) ? fromDisplay(load ?? 0, units) : 0;
    const kind = idx > g.sets ? 'extra' : 'work';
    const row = { kind, loadKg, reps: reps ?? 0 } as const;
    await logSet({
      sessionId,
      exerciseId: ex.id,
      idx,
      kind,
      loadKg,
      reps: reps ?? 0,
      side: ex.unilateral ? item.nextSide : undefined,
      goalMet: isGoalSet(row, g, lt),
      bonusReps: bonusReps(row, g, lt, model.bodyweightKg),
    });
    platform.tap();
    ripple(); // FR-DSN-8: a logged set ripples the sun (no-op in the classic look).
    setExtra(false);
    setNudgeUsed(null);
    // FR-TMR-1: rest starts on logging a work set (after the right side for unilateral).
    if (!(ex.unilateral && item.nextSide === 'L'))
      startRest(sessionId, restSecondsFor(ex.role, model.settings));
    setBusy(false);
  };

  const logWarmup = async (w: { loadKg: number; reps: number }) => {
    await logSet({
      sessionId,
      exerciseId: ex.id,
      idx: item.warmupsLogged.length + 1,
      kind: 'warmup',
      loadKg: w.loadKg,
      reps: w.reps,
      goalMet: false,
      bonusReps: 0,
    });
    platform.tap();
  };

  const subtitle = isMachine
    ? `${muscleName(ex.primary[0])} · ${en.logger.machine}`
    : `${muscleName(ex.primary[0])} · ${ex.equipment}`;
  const lastLine = item.last
    ? item.last.sets
        .filter((s) => s.kind !== 'warmup')
        .map((s) => s.reps)
        .join('·')
    : '';
  const lastLoad = item.last?.sets.find((s) => s.kind !== 'warmup');
  const nudgeText =
    nudge &&
    (nudge.why === 'easy'
      ? en.logger.nudgeUp(nudge.fromSet, formatLoad(nudge.loadKg, lt, units))
      : nudge.why === 'reps_high'
        ? en.logger.nudgeHigh(nudge.fromSet, formatLoad(nudge.loadKg, lt, units))
        : en.logger.nudgeDown(nudge.fromSet, formatLoad(nudge.loadKg, lt, units)));
  const nudgeValue = nudge ? displayNumber(nudge.loadKg, units) : '';
  const showNudge = nudge && !done && nudgeUsed !== key;

  return {
    status: 'ready' as const,
    sessionId,
    model,
    navigate,
    skipRest,
    item,
    units,
    load,
    setLoad,
    reps,
    setReps,
    extra,
    setExtra,
    editing,
    setEditing,
    menuFor,
    setMenuFor,
    swap,
    setSwap,
    busy,
    setNudgeUsed,
    overrideOpen,
    setOverrideOpen,
    key,
    nudge,
    ex,
    g,
    lt,
    isMachine,
    done,
    idx,
    pendingWarmups,
    unitLabel,
    incDisplay,
    doneCount,
    log,
    logWarmup,
    subtitle,
    lastLine,
    lastLoad,
    nudgeText,
    nudgeValue,
    showNudge,
  };
}

export type LoggerReady = Extract<ReturnType<typeof useLogger>, { status: 'ready' }>;

export async function replaceInRoutine(routineSessionId: string, fromId: string, toId: string) {
  const r = await getActiveRoutine();
  if (!r) return;
  await updateRoutineSessions(
    r.id,
    r.sessions.map((s) =>
      s.id === routineSessionId
        ? { ...s, items: s.items.map((i) => (i.exerciseId === fromId ? { ...i, exerciseId: toId } : i)) }
        : s,
    ),
  );
}

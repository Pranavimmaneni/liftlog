import { completeOnboarding, type OnboardingDraft } from '@/db/repo';
import { getExerciseMap } from '@/db/catalog';
import { db } from '@/db/schema';
import { finishSession, logSet, startSession } from '@/db/workout';
import { sessionsFor } from '@/engine/split';
import { presetGym } from '@/engine/suggest';
import { buildRoutine } from '@/engine/coverage';
import { isGoalSet } from '@/engine/goalset';
import { sessionsFromSuggestion } from '@/screens/S04-routine/RoutineBuilder';
import type { RoutineSession } from '@/db/types';

export const TEST_DRAFT: OnboardingDraft = {
  experience: 'intermediate',
  goal: 'build_muscle',
  daysPerWeek: 4,
  nudge: 0,
  presetId: 'full-gym',
  ...presetGym('full-gym'),
  limitations: [],
  units: 'kg',
  splitId: 'upper-lower',
};

/** Onboards with the default Upper / Lower routine on a full gym. */
export async function seedOnboarded(draft: Partial<OnboardingDraft> = {}): Promise<RoutineSession[]> {
  const d = { ...TEST_DRAFT, ...draft };
  const map = await getExerciseMap();
  const sessions = sessionsFromSuggestion(
    buildRoutine(sessionsFor(d.splitId!, d.daysPerWeek), {
      exercises: [...map.values()],
      gym: d,
      profile: d,
    }),
  );
  await completeOnboarding(d, { splitId: d.splitId!, sessions });
  return sessions;
}

/**
 * Logs a whole session: every planned exercise at `loadKg` × `reps` for 3 sets, then finishes it.
 * Returns the session id.
 */
export async function seedSession(opts: {
  routineSession: RoutineSession;
  startedAt: number;
  loadKg?: number;
  reps?: number;
  deload?: boolean;
}): Promise<string> {
  const routine = await db.routines.where('active').equals(1).first();
  const ids = [...opts.routineSession.items].sort((a, b) => a.order - b.order).map((i) => i.exerciseId);
  const s = await startSession({
    routineId: routine?.id,
    routineSessionId: opts.routineSession.id,
    name: opts.routineSession.name,
    exerciseIds: ids,
    deload: opts.deload,
    now: opts.startedAt,
  });
  let t = opts.startedAt;
  for (const id of ids) {
    for (let i = 1; i <= 3; i++) {
      t += 120_000;
      const loadKg = opts.loadKg ?? 50;
      const reps = opts.reps ?? 10;
      await logSet({
        sessionId: s.id,
        exerciseId: id,
        idx: i,
        kind: 'work',
        loadKg,
        reps,
        goalMet: isGoalSet(
          { kind: 'work', loadKg, reps },
          { sets: 3, repMin: 8, repMax: 10, loadKg: null },
          'barbell',
        ),
        bonusReps: 0,
        now: t,
      });
    }
  }
  await finishSession(s.id, { now: t + 60_000 });
  return s.id;
}

/**
 * Dev-only demo data (M4 prompt: "seed a realistic 6-week fixture"). Generates six weeks of
 * Upper / Lower training by running the real goal engine session after session, so the
 * progression, reasons, PRs and reviews all come from the app's own rules. Deterministic.
 */
import { db, TABLES } from '@/db/schema';
import { getExerciseMap } from '@/db/catalog';
import { completeOnboarding, saveWeighIn, type OnboardingDraft } from '@/db/repo';
import { finishSession, goalFromHistory, historyFor, logSet, setEffort, startSession } from '@/db/workout';
import { isGoalSet, bonusReps } from '@/engine/goalset';
import { sessionsFor } from '@/engine/split';
import { presetGym, suggestRoutine } from '@/engine/suggest';
import { dateKey, startOfWeek } from '@/engine/week';
import { sessionsFromSuggestion } from '@/screens/S04-routine/RoutineBuilder';
import type { Effort } from '@/engine/types';

const BASE_KG: Record<string, number> = {
  'lat-pulldown': 50,
  'incline-dumbbell-press': 22,
  'seated-cable-row': 50,
  'overhead-press': 40,
  'rope-pushdown': 22.5,
  'barbell-curl': 25,
  'back-squat': 80,
  'romanian-deadlift': 70,
  'leg-extension': 45,
  'seated-leg-curl': 40,
  'standing-calf-raise': 60,
  'cable-crunch': 30,
  'bench-press': 70,
  'bent-over-barbell-row': 60,
  'dumbbell-lateral-raise': 8,
  'dumbbell-bicep-curl': 12,
  'triceps-pushdown': 25,
  'cable-pull-through': 30,
  'leg-press': 140,
  'hip-thrust': 90,
  'lying-leg-curl': 35,
  'seated-calf-raise': 40,
};

/** Mulberry32: tiny deterministic PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FixtureOptions {
  weeks?: number;
  now?: number;
  /** Leave one session open with two sets logged (for S06/S07 screenshots). */
  active?: boolean;
  bodyStats?: boolean;
}

export async function loadFixture(opts: FixtureOptions = {}): Promise<void> {
  const weeks = opts.weeks ?? 6;
  const now = opts.now ?? Date.now();
  const rand = rng(42);
  for (const t of TABLES) await db.table(t).clear();

  const draft: OnboardingDraft = {
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
  const map = await getExerciseMap();
  const sessions = sessionsFromSuggestion(
    suggestRoutine(sessionsFor('upper-lower', 4), {
      exercises: [...map.values()],
      gym: draft,
      profile: draft,
    }),
  );
  await completeOnboarding(draft, { splitId: 'upper-lower', sessions });
  if (opts.bodyStats !== false)
    await db.profile.update('me', { sex: 'male', birthYear: new Date(now).getFullYear() - 27 });
  const profile = (await db.profile.get('me'))!;
  const routine = (await db.routines.where('active').equals(1).first())!;

  const thisWeek = startOfWeek(now, 1);
  const firstWeek = thisWeek - weeks * 7 * 86_400_000;
  const dayOffsets = [0, 1, 3, 4]; // Mon, Tue, Thu, Fri
  let rot = 0;

  // Weigh-ins: 3 a week, trending gently down (recomp-ish).
  for (let d = 0; d < weeks * 7 + new Date(now).getDay(); d += 2) {
    const t = firstWeek + d * 86_400_000 + 7 * 3_600_000;
    if (t > now) break;
    await saveWeighIn(dateKey(t), 79 - (d / (weeks * 7)) * 0.6 + (rand() - 0.5) * 0.3);
  }

  const plans: { t: number }[] = [];
  for (let w = 0; w <= weeks; w++) {
    for (const off of dayOffsets) {
      const t = firstWeek + (w * 7 + off) * 86_400_000 + 18 * 3_600_000;
      if (t > now - 2 * 3_600_000) continue;
      if (w === 2 && off === 4) continue; // one missed session
      plans.push({ t });
    }
  }

  for (let i = 0; i < plans.length; i++) {
    const leaveOpen = opts.active && i === plans.length - 1;
    // An open session must be recent, or the 3 h idle rule (FR-WRK-12) finishes it on load.
    const t = leaveOpen ? now - 15 * 60_000 : plans[i]!.t;
    const rs = sessions[rot % sessions.length]!;
    rot++;
    const ids = [...rs.items].sort((a, b) => a.order - b.order).map((x) => x.exerciseId);
    const s = await startSession({
      routineId: routine.id,
      routineSessionId: rs.id,
      name: rs.name,
      exerciseIds: ids,
      now: t,
    });
    const history = await historyFor(ids, s.id, t);
    let clock = t;
    for (const [n, id] of ids.entries()) {
      if (leaveOpen && n > 0) break;
      const ex = map.get(id)!;
      const goal = goalFromHistory(ex, history, profile);
      const load = goal.loadKg ?? BASE_KG[id] ?? 20;
      const p = rand();
      const reps =
        p < 0.55
          ? [goal.repMax, goal.repMax, goal.repMax]
          : p < 0.88
            ? [goal.repMax, goal.repMax - 1, goal.repMin]
            : [goal.repMax - 1, goal.repMin, goal.repMin - 1];
      const setCount = leaveOpen ? 2 : goal.sets;
      for (let k = 1; k <= setCount; k++) {
        clock += 150_000;
        const r = reps[Math.min(k - 1, reps.length - 1)]!;
        const row = { kind: 'work' as const, loadKg: load, reps: r };
        const logged = await logSet({
          sessionId: s.id,
          exerciseId: id,
          idx: k,
          kind: 'work',
          loadKg: load,
          reps: r,
          goalMet: isGoalSet(row, goal, ex.loadType),
          bonusReps: bonusReps(row, goal, ex.loadType, 78),
          now: clock,
        });
        const e: Effort = rand() < 0.2 ? 'easy' : rand() < 0.85 ? 'solid' : 'hard';
        if (k === setCount || rand() < 0.4) await setEffort(logged.id, e);
      }
    }
    if (!leaveOpen) await finishSession(s.id, { now: clock + 120_000 });
  }
  await db.meta.put({ key: 'lastBackupAt', value: now - 3 * 86_400_000 });
}

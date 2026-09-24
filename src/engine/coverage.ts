/**
 * FR-RTN-3 / §6.5 coverage: weekly hard sets per muscle vs the target band for the level and goal.
 * Primary muscles count sets × 1, secondary × 0.5 (intensity.json), warm-ups 0.
 * Sessions rotate, so a routine's sets are scaled to days per week (DECISIONS D50).
 */
import { INTENSITY } from './data';
import { prescribe, weeklyTarget } from './prescription';
import { candidatesFor, eligible, suggestRoutine, type SuggestContext } from './suggest';
import type { SplitSlot } from './data';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Pattern, type ProfileLike } from './types';

export interface MuscleCoverage {
  muscle: MuscleGroup;
  sets: number;
  target: [number, number];
  gap: boolean;
}

type Prof = Pick<ProfileLike, 'experience' | 'goal' | 'nudge' | 'daysPerWeek'>;

/** Hard sets per week for each of the 13 muscle groups. */
export function coverage(
  sessions: string[][],
  exercises: Map<string, Exercise>,
  profile: Prof,
): MuscleCoverage[] {
  const target = weeklyTarget(profile);
  const perWeek = sessions.length ? profile.daysPerWeek / sessions.length : 0;
  const raw = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map((m) => [m, 0]));
  for (const ids of sessions) {
    for (const id of ids) {
      const ex = exercises.get(id);
      if (!ex) continue;
      const sets = prescribe(profile, ex.role).sets;
      for (const m of ex.primary) raw.set(m, raw.get(m)! + sets);
      for (const m of ex.secondary) raw.set(m, raw.get(m)! + sets * INTENSITY.secondaryMuscleSetWeight);
    }
  }
  return MUSCLE_GROUPS.map((muscle) => {
    const sets = Math.round(raw.get(muscle)! * perWeek * 2) / 2;
    return { muscle, sets, target, gap: sets < target[0] };
  });
}

/** Where to look for a fix, best first. */
export const FIX_PATTERNS: Record<MuscleGroup, Pattern[]> = {
  chest: ['chest_fly', 'horizontal_press', 'incline_press'],
  lats: ['vertical_pull', 'horizontal_pull'],
  'upper back': ['horizontal_pull', 'rear_delt'],
  shoulders: ['lateral_raise', 'overhead_press', 'rear_delt'],
  biceps: ['elbow_flexion'],
  triceps: ['elbow_extension'],
  forearms: ['elbow_flexion', 'carry'],
  abs: ['core_flexion', 'core_antiextension'],
  'lower back': ['hip_extension', 'hinge'],
  quads: ['knee_extension', 'leg_press_or_lunge', 'squat'],
  hamstrings: ['knee_flexion', 'hinge'],
  glutes: ['hip_extension', 'hip_abduction', 'hinge'],
  calves: ['calf_raise'],
};

export interface Fix {
  sessionIndex: number;
  exerciseId: string;
}

/** Session with the fewest estimated minutes (ties → first). */
export function lightestSession(
  sessions: string[][],
  exercises: Map<string, Exercise>,
  profile: Prof,
): number {
  let best = 0;
  let bestSec = Infinity;
  sessions.forEach((ids, i) => {
    const sec = ids.reduce((t, id) => {
      const ex = exercises.get(id);
      return ex ? t + prescribe(profile, ex.role).sets * INTENSITY.secondsPerSetIncludingRest[ex.role] : t;
    }, 0);
    if (sec < bestSec) {
      bestSec = sec;
      best = i;
    }
  });
  return best;
}

function sessionSeconds(ids: string[], exercises: Map<string, Exercise>, profile: Prof): number {
  return ids.reduce((t, id) => {
    const ex = exercises.get(id);
    return ex ? t + prescribe(profile, ex.role).sets * INTENSITY.secondsPerSetIncludingRest[ex.role] : t;
  }, 0);
}

/**
 * DECISIONS D51: after auto-suggest, closes coverage gaps with "+ Fix" picks while a session still has
 * room under sessionMinutesTarget. Biggest deficit first; each muscle gets at most one addition per pass.
 */
export function fillGaps(sessions: string[][], ctx: SuggestContext & { profile: Prof }): string[][] {
  const out = sessions.map((s) => [...s]);
  const map = new Map(ctx.exercises.map((e) => [e.id, e]));
  const budget = INTENSITY.sessionMinutesTarget * 60;
  for (let pass = 0; pass < 3; pass++) {
    const gaps = coverage(out, map, ctx.profile)
      .filter((c) => c.gap)
      .sort((a, b) => a.sets - a.target[0] - (b.sets - b.target[0]));
    let added = false;
    for (const g of gaps) {
      const fix = fixFor(g.muscle, out, ctx);
      if (!fix) continue;
      const ex = map.get(fix.exerciseId)!;
      const cost = prescribe(ctx.profile, ex.role).sets * INTENSITY.secondsPerSetIncludingRest[ex.role];
      if (sessionSeconds(out[fix.sessionIndex]!, map, ctx.profile) + cost > budget) continue;
      out[fix.sessionIndex]!.push(fix.exerciseId);
      added = true;
    }
    if (!added) break;
  }
  return out;
}

/** FR-RTN-1 + D51: a split template filled for the gym, then topped up for coverage. */
export function buildRoutine(
  templateSessions: { name: string; slots: SplitSlot[]; secondPass?: boolean }[],
  ctx: SuggestContext & { profile: Prof },
): { name: string; exerciseIds: string[] }[] {
  const suggested = suggestRoutine(templateSessions, ctx);
  const filled = templateSessions.every((s) => s.slots.length)
    ? fillGaps(
        suggested.map((s) => s.exerciseIds),
        ctx,
      )
    : suggested.map((s) => s.exerciseIds);
  return suggested.map((s, i) => ({ name: s.name, exerciseIds: filled[i]! }));
}

/** "+ Fix": the best in-gym, not-limited exercise for the muscle, added to the lightest session. */
export function fixFor(
  muscle: MuscleGroup,
  sessions: string[][],
  ctx: SuggestContext & { profile: Prof },
): Fix | null {
  if (!sessions.length) return null;
  const map = new Map(ctx.exercises.map((e) => [e.id, e]));
  const idx = lightestSession(sessions, map, ctx.profile);
  const inSession = new Set(sessions[idx]);
  const inRoutine = new Set(sessions.flat());
  const pool = eligible(ctx).filter((e) => e.primary.includes(muscle));
  for (const pattern of FIX_PATTERNS[muscle]) {
    for (const role of ['isolation', 'compound'] as const) {
      const pick = candidatesFor(
        { pattern, role, muscle },
        pool,
        ctx.profile.experience,
        inSession,
        inRoutine,
      )[0];
      if (pick) return { sessionIndex: idx, exerciseId: pick.id };
    }
  }
  const any = pool.find((e) => !inSession.has(e.id));
  return any ? { sessionIndex: idx, exerciseId: any.id } : null;
}

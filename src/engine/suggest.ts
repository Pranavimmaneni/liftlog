/**
 * FR-RTN-1 auto-suggest, FR-GYM-5 limitations, S23 swap alternatives.
 * Fills each template slot with the best exercise the gym allows (pattern + muscle match,
 * not limited), compounds first, and trims sessions to sessionMinutesTarget.
 */
import { INTENSITY, PRESETS, EQUIPMENT, MACHINES } from './data';
import { prescribe } from './prescription';
import type { SplitSlot } from './data';
import type { Exercise, Experience, Pattern, ProfileLike } from './types';
import { EXPERIENCES } from './types';

export interface GymLike {
  equipmentIds: string[];
  machineIds: string[];
}

/** Staples per pattern, best first. Anything else with the pattern is still eligible, ranked lower. */
export const STAPLES: Partial<Record<Pattern, string[]>> = {
  vertical_pull: [
    'lat-pulldown',
    'pull-up',
    'chin-up',
    'assisted-pull-up',
    'close-grip-pulldown',
    'iso-lateral-pulldown',
  ],
  horizontal_pull: [
    'seated-cable-row',
    'bent-over-barbell-row',
    'single-arm-dumbbell-row',
    'chest-supported-dumbbell-row',
    'seated-machine-row',
    't-bar-row',
    'iso-lateral-row',
    'chest-supported-t-bar-row',
  ],
  horizontal_press: [
    'bench-press',
    'dumbbell-bench-press',
    'machine-chest-press',
    'push-up',
    'smith-bench-press',
    'iso-lateral-chest-press',
  ],
  incline_press: [
    'incline-dumbbell-press',
    'incline-barbell-bench-press',
    'machine-incline-chest-press',
    'smith-incline-press',
  ],
  overhead_press: [
    'overhead-press',
    'dumbbell-shoulder-press',
    'seated-dumbbell-press',
    'machine-shoulder-press',
    'arnold-dumbbell-press',
    'smith-shoulder-press',
  ],
  lateral_raise: ['dumbbell-lateral-raise', 'cable-lateral-raise', 'machine-lateral-raise'],
  rear_delt: ['face-pull', 'reverse-pec-deck', 'dumbbell-reverse-fly'],
  elbow_flexion: [
    'barbell-curl',
    'dumbbell-bicep-curl',
    'ez-bar-curl',
    'cable-curl',
    'incline-dumbbell-curl',
    'preacher-curl',
    'machine-biceps-curl',
    'hammer-curl',
    'reverse-barbell-curl',
  ],
  elbow_extension: [
    'rope-pushdown',
    'triceps-pushdown',
    'overhead-cable-triceps-extension',
    'lying-triceps-extension',
    'dip',
    'machine-triceps-extension',
    'standing-dumbbell-triceps-extension',
  ],
  chest_fly: ['cable-fly', 'pec-deck-fly', 'dumbbell-fly', 'incline-dumbbell-fly'],
  squat: [
    'back-squat',
    'front-squat',
    'goblet-squat',
    'hack-squat',
    'smith-squat',
    'pendulum-squat',
    'belt-squat',
  ],
  hinge: [
    'romanian-deadlift',
    'deadlift',
    'trap-bar-deadlift',
    'stiff-legged-dumbbell-deadlift',
    'good-morning',
    'cable-pull-through',
  ],
  leg_press_or_lunge: [
    'leg-press',
    'bulgarian-split-squat',
    'dumbbell-lunge',
    'dumbbell-split-squat',
    'seated-leg-press',
    'dumbbell-step-up',
  ],
  knee_extension: ['leg-extension'],
  knee_flexion: ['seated-leg-curl', 'lying-leg-curl', 'standing-leg-curl', 'glute-ham-raise'],
  hip_extension: [
    'hip-thrust',
    'machine-hip-thrust',
    'barbell-glute-bridge',
    '45-degree-back-extension',
    'machine-glute-kickback',
    'single-leg-glute-bridge',
  ],
  hip_abduction: ['hip-abduction'],
  calf_raise: [
    'standing-calf-raise',
    'seated-calf-raise',
    'leg-press-calf-raise',
    'standing-dumbbell-calf-raise',
    'smith-calf-raise',
  ],
  core_flexion: ['cable-crunch', 'hanging-leg-raise', 'machine-crunch', 'crunch', 'captains-chair-leg-raise'],
  core_antiextension: ['plank', 'ab-wheel-rollout', 'pallof-press'],
  carry: ['farmers-carry'],
};

/** Gym ids for a preset from equipment.json ('all' expands to every id). */
export function presetGym(presetId: string): GymLike {
  const p = PRESETS[presetId] ?? PRESETS['full-gym']!;
  return {
    equipmentIds: p.equipment === 'all' ? EQUIPMENT.map((e) => e.id) : [...p.equipment],
    machineIds: p.machines === 'all' ? MACHINES.map((m) => m.id) : [...p.machines],
  };
}

/** FR-LIB-5: every requirement group is satisfied by something in the gym. */
export function isAvailable(ex: Pick<Exercise, 'requires'>, gym: GymLike): boolean {
  const have = new Set([...gym.equipmentIds, ...gym.machineIds]);
  return ex.requires.every((group) => group.some((id) => have.has(id)));
}

/** FR-GYM-5: exercises that load a "go easy" area are excluded from suggestions. */
export function isLimited(ex: Pick<Exercise, 'limitationAreas'>, limitations: string[]): boolean {
  return ex.limitationAreas.some((a) => limitations.includes(a));
}

const FREE_WEIGHT = new Set(['barbell', 'dumbbell', 'kettlebell', 'bodyweight', 'bodyweight_plus']);

function levelRank(l: Experience): number {
  return EXPERIENCES.indexOf(l);
}

/** Score of an exercise for a slot. Higher is better; 0 = not a candidate. */
export function slotScore(
  ex: Exercise,
  slot: Pick<SplitSlot, 'pattern' | 'role' | 'muscle'>,
  level: Experience,
): number {
  if (ex.pattern !== slot.pattern) return 0;
  let s = 10;
  if (ex.primary.includes(slot.muscle)) s += 100;
  else if (ex.secondary.includes(slot.muscle)) s += 30;
  else return 0;
  if (ex.role === slot.role) s += 20;
  const staples = STAPLES[slot.pattern] ?? [];
  const rank = staples.indexOf(ex.id);
  if (rank >= 0) s += 60 - rank * 4;
  // "Compound first, then machine/cable alternatives" (splits.json note) for everything off the staple list.
  else if (slot.role === 'compound' && FREE_WEIGHT.has(ex.loadType)) s += 8;
  if (levelRank(ex.level) > levelRank(level)) s -= 40;
  if (ex.unilateral) s -= 5;
  if (ex.loadType === 'timed') s -= 5;
  return s;
}

export interface SuggestContext {
  exercises: Exercise[];
  gym: GymLike;
  profile: Pick<ProfileLike, 'experience' | 'goal' | 'nudge' | 'limitations'>;
}

export function eligible(ctx: SuggestContext): Exercise[] {
  return ctx.exercises.filter((e) => isAvailable(e, ctx.gym) && !isLimited(e, ctx.profile.limitations));
}

/** Best candidates for a slot, excluding ids already used; `avoid` ids get a variety penalty. */
export function candidatesFor(
  slot: Pick<SplitSlot, 'pattern' | 'role' | 'muscle'>,
  pool: Exercise[],
  level: Experience,
  exclude: Set<string>,
  avoid: Set<string> = new Set(),
): Exercise[] {
  return pool
    .filter((e) => !exclude.has(e.id))
    .map((e) => ({ e, s: slotScore(e, slot, level) - (avoid.has(e.id) ? 25 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .map((x) => x.e);
}

export interface SuggestedSession {
  name: string;
  exerciseIds: string[];
}

/** Estimated minutes for a list of exercises at the profile's prescription. */
export function sessionMinutes(exs: Exercise[], profile: SuggestContext['profile']): number {
  const sec = exs.reduce(
    (t, e) => t + prescribe(profile, e.role).sets * INTENSITY.secondsPerSetIncludingRest[e.role],
    0,
  );
  return sec / 60;
}

/**
 * FR-RTN-1: fills every slot. Compounds come first; trailing isolations are dropped while the
 * session runs over sessionMinutesTarget. Second-pass PPL sessions swap their first compound.
 */
export function suggestRoutine(
  sessions: { name: string; slots: SplitSlot[]; secondPass?: boolean }[],
  ctx: SuggestContext,
): SuggestedSession[] {
  const pool = eligible(ctx);
  const byId = new Map(pool.map((e) => [e.id, e]));
  const usedInRoutine = new Set<string>();
  const out: SuggestedSession[] = [];
  for (const sess of sessions) {
    const ids: string[] = [];
    const used = new Set<string>();
    let firstCompoundSwapped = false;
    const slots = [...sess.slots].sort((a, b) => (a.role === b.role ? 0 : a.role === 'compound' ? -1 : 1));
    for (const slot of slots) {
      let cands = candidatesFor(slot, pool, ctx.profile.experience, used, usedInRoutine);
      if (sess.secondPass && slot.role === 'compound' && !firstCompoundSwapped && cands.length > 1) {
        cands = cands.slice(1);
        firstCompoundSwapped = true;
      }
      const pick = cands[0];
      if (!pick) continue;
      ids.push(pick.id);
      used.add(pick.id);
      usedInRoutine.add(pick.id);
    }
    // Size to the time target (never below 3 exercises).
    const exs = ids.map((id) => byId.get(id)!);
    while (exs.length > 3 && sessionMinutes(exs, ctx.profile) > INTENSITY.sessionMinutesTarget) {
      const lastIso = exs.map((e) => e.role).lastIndexOf('isolation');
      exs.splice(lastIso >= 0 ? lastIso : exs.length - 1, 1);
    }
    out.push({ name: sess.name, exerciseIds: exs.map((e) => e.id) });
  }
  return out;
}

/**
 * S23: up to 6 alternatives with the same primary muscle and pattern, in the gym,
 * ranked compound-first, then most recently used.
 */
export function swapAlternatives(
  current: Exercise,
  ctx: SuggestContext,
  lastUsed: Map<string, number> = new Map(),
  limit = 6,
): Exercise[] {
  const muscle = current.primary[0];
  return eligible(ctx)
    .filter(
      (e) => e.id !== current.id && e.pattern === current.pattern && !!muscle && e.primary.includes(muscle),
    )
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'compound' ? -1 : 1;
      const lu = (lastUsed.get(b.id) ?? 0) - (lastUsed.get(a.id) ?? 0);
      if (lu !== 0) return lu;
      const slot = { pattern: current.pattern!, role: current.role, muscle: muscle! };
      return (
        slotScore(b, slot, ctx.profile.experience) - slotScore(a, slot, ctx.profile.experience) ||
        a.name.localeCompare(b.name)
      );
    })
    .slice(0, limit);
}

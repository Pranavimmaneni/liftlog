/**
 * FR-GOAL-1…5 goal engine and FR-PRG-1…6 progression, as one pure replay:
 * the next target for an exercise = the prescription (FR-GOAL-2), then every past exposure
 * (oldest first) run through the §5.8 rules. Because it's derived from the log, editing or
 * deleting a past set recomputes everything (FR-WRK-11). Reasons are codes; src/copy formats them.
 */
import { INTENSITY } from './data';
import { prescribe } from './prescription';
import { incrementIn, kgToLb, lbToKg, roundLoadKg } from './units';
import { warmupsFor } from './warmup';
import type { Effort, Exercise, LoadType, LoggedSet, ProfileLike, Target, WarmupSet } from './types';

export type ReasonCode =
  | 'first' // FR-GOAL-4 calibration: find your weight
  | 'calibrated' // first exposure set the load
  | 'up' // FR-PRG-2: + one increment
  | 'widen' // FR-PRG-2 big-jump: raise repMax by 2
  | 'less_assist' // FR-PRG-5 assisted: assistance goes down
  | 'more_reps' // bodyweight / timed: progress reps
  | 'add_weight' // FR-PRG-5: suggest bodyweight_plus
  | 'hold_hard' // all hit repMax but the last set was hard
  | 'hold_reps' // FR-PRG-3: +1 rep on the weakest set
  | 'hold_miss' // FR-PRG-4: first miss, hold
  | 'hold_incomplete' // fewer sets than planned
  | 'down' // FR-PRG-4: two misses → −10%, reset to repMin
  | 'frozen' // FR-PRG-6: hurts
  | 'deload' // FR-PRG-7
  | 'override'; // S24

export interface Reason {
  code: ReasonCode;
  /** Load delta in kg (up/down/less_assist). */
  deltaKg?: number;
  reps?: number;
  set?: number;
  loadKg?: number;
}

export interface Exposure {
  at: number;
  deload: boolean;
  sets: LoggedSet[];
}

export interface GoalState {
  target: Target;
  baseRepMin: number;
  baseRepMax: number;
  reason: Reason;
  missStreak: number;
  frozen: boolean;
  /** Consecutive exposures without a load or rep increase (D17 stall). */
  noProgress: number;
  /** Total work reps in the previous exposure (for the stall check). */
  lastReps: number;
  exposures: number;
  suggestLoadType?: LoadType;
}

export interface Goal extends Target {
  warmups: WarmupSet[];
  reason: Reason;
  calibration: boolean;
  frozen: boolean;
  stalled: boolean;
  suggestLoadType?: LoadType;
}

type Ex = Pick<Exercise, 'role' | 'loadType' | 'incrementKg' | 'unilateral'>;
type Prof = Pick<ProfileLike, 'experience' | 'goal' | 'nudge' | 'units'>;

/** Timed holds progress in seconds (load-types.json "seconds +5"); DECISIONS D44. */
export const TIMED_RANGE: [number, number] = [30, 45];
const TIMED_STEP = 5;
const BIG_JUMP = 0.05;
const MISS_DROP = 0.1;

const usesLoad = (lt: LoadType) => lt !== 'bodyweight' && lt !== 'timed';

export function initialState(ex: Ex, profile: Prof): GoalState {
  const p = prescribe(profile, ex.role);
  const [repMin, repMax] = ex.loadType === 'timed' ? TIMED_RANGE : [p.repMin, p.repMax];
  return {
    target: { sets: p.sets, repMin, repMax, loadKg: usesLoad(ex.loadType) ? null : 0 },
    baseRepMin: repMin,
    baseRepMax: repMax,
    reason: { code: 'first' },
    missStreak: 0,
    frozen: false,
    noProgress: 0,
    lastReps: 0,
    exposures: 0,
  };
}

/** Work sets per set index; unilateral pairs collapse to the weaker side (FR-WRK-14). */
export function setsByIdx(
  sets: LoggedSet[],
): { idx: number; loadKg: number; reps: number; effort?: Effort; hurts: boolean }[] {
  const map = new Map<number, LoggedSet[]>();
  for (const s of sets) if (s.kind !== 'warmup') map.set(s.idx, [...(map.get(s.idx) ?? []), s]);
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, g]) => {
      const weakest = g.reduce((m, s) => (s.reps < m.reps ? s : m), g[0]!);
      return {
        idx,
        loadKg: weakest.loadKg,
        reps: weakest.reps,
        effort: g[g.length - 1]!.effort,
        hurts: g.some((s) => s.hurts),
      };
    });
}

function step(ex: Ex, units: ProfileLike['units']): number {
  // One increment, in kg, measured on the user's unit grid.
  const inc = incrementIn(units, ex.incrementKg, ex.loadType);
  return units === 'kg' ? inc : lbToKg(inc);
}

function roundLoad(kg: number, ex: Ex, units: ProfileLike['units']): number {
  return Math.max(0, roundLoadKg(kg, units, ex.incrementKg, ex.loadType));
}

/** One exposure through the §5.8 rules (FR-PRG-1: evaluated after every exposure, not weekly). */
export function progress(state: GoalState, e: Exposure, ex: Ex, profile: Prof): GoalState {
  const s = { ...state, target: { ...state.target }, exposures: state.exposures + 1 };
  const rows = setsByIdx(e.sets);
  if (!rows.length) return state;
  const units = profile.units;
  const t = s.target;
  const lt = ex.loadType;
  const assisted = lt === 'assisted';
  const prevReps = rows.reduce((n, r) => n + r.reps, 0);

  // FR-PRG-6: pain freezes progression; one pain-free exposure clears it.
  if (rows.some((r) => r.hurts)) {
    s.frozen = true;
    s.reason = { code: 'frozen' };
    return s;
  }
  s.frozen = false;

  // FR-GOAL-4: the first exposure calibrates the load from what the user actually lifted.
  if (usesLoad(lt) && t.loadKg === null) {
    const good = rows.filter((r) => r.reps >= t.repMin);
    const pool = good.length ? good : rows;
    const load = assisted ? Math.min(...pool.map((r) => r.loadKg)) : Math.max(...pool.map((r) => r.loadKg));
    t.loadKg = roundLoad(
      good.length ? load : assisted ? load + step(ex, units) : load - step(ex, units),
      ex,
      units,
    );
    s.reason = { code: 'calibrated', loadKg: t.loadKg };
    s.noProgress = 0;
    s.lastReps = prevReps;
    return s;
  }

  // Planned sets only; a heavier common load (manual choice or override) becomes the baseline.
  const planned = rows.filter((r) => r.idx <= t.sets);
  if (usesLoad(lt) && t.loadKg !== null && planned.length) {
    const loads = planned.map((r) => r.loadKg);
    const common = assisted ? Math.max(...loads) : Math.min(...loads);
    if (assisted ? common < t.loadKg - 0.01 : common > t.loadKg + 0.01) t.loadKg = common;
  }
  const atLoad = (r: (typeof rows)[number]) =>
    !usesLoad(lt) ||
    t.loadKg === null ||
    (assisted ? r.loadKg <= t.loadKg + 0.01 : r.loadKg >= t.loadKg - 0.01);
  const beforeLoad = t.loadKg;
  const beforeRepMax = t.repMax;

  if (planned.length < t.sets) {
    s.reason = { code: 'hold_incomplete', set: planned.length + 1 };
  } else if (planned.every((r) => atLoad(r) && r.reps >= t.repMax)) {
    const lastEffort = planned[planned.length - 1]!.effort;
    if (lastEffort === 'hard') {
      s.reason = { code: 'hold_hard' };
    } else if (lt === 'timed') {
      t.repMin += TIMED_STEP;
      t.repMax += TIMED_STEP;
      s.reason = { code: 'more_reps', reps: t.repMax };
    } else if (lt === 'bodyweight') {
      // FR-PRG-5: progress reps, then suggest added weight at repMax + 3.
      if (t.repMax >= s.baseRepMax + 3) {
        s.suggestLoadType = 'bodyweight_plus';
        s.reason = { code: 'add_weight', reps: t.repMax };
      } else {
        t.repMin += 1;
        t.repMax += 1;
        s.reason = { code: 'more_reps', reps: t.repMax };
      }
    } else if (assisted) {
      const inc = step(ex, units);
      const next = roundLoad(Math.max(0, t.loadKg! - inc), ex, units);
      s.reason = { code: 'less_assist', deltaKg: t.loadKg! - next };
      t.loadKg = next;
    } else {
      const inc = step(ex, units);
      const load = t.loadKg!;
      // FR-PRG-2 big-jump rule: widen the rep range once before a >5% jump.
      if (load > 0 && inc / load > BIG_JUMP && t.repMax < s.baseRepMax + 2) {
        t.repMax = s.baseRepMax + 2;
        s.reason = { code: 'widen', reps: t.repMax, deltaKg: inc };
      } else {
        t.loadKg = roundLoad(load + inc, ex, units);
        t.repMin = s.baseRepMin;
        t.repMax = s.baseRepMax;
        s.reason = { code: 'up', deltaKg: t.loadKg - load, reps: beforeRepMax };
      }
    }
    s.missStreak = 0;
  } else if (planned.every((r) => atLoad(r) && r.reps >= t.repMin)) {
    // FR-PRG-3: hold; +1 rep on the weakest set.
    const weakest = planned.reduce((m, r) => (r.reps < m.reps ? r : m), planned[0]!);
    s.reason = { code: 'hold_reps', reps: Math.min(t.repMax, weakest.reps + 1), set: weakest.idx };
    s.missStreak = 0;
  } else {
    // FR-PRG-4: hold; two misses in a row → −10% and back to repMin.
    s.missStreak += 1;
    const missed = planned.find((r) => !atLoad(r) || r.reps < t.repMin) ?? planned[0]!;
    if (s.missStreak >= 2 && usesLoad(lt) && t.loadKg !== null) {
      const load = t.loadKg;
      const next = assisted
        ? roundLoad(load + Math.max(step(ex, units), load * MISS_DROP), ex, units)
        : roundLoad(load * (1 - MISS_DROP), ex, units);
      t.loadKg = next === load && !assisted ? roundLoad(load - step(ex, units), ex, units) : next;
      t.repMin = s.baseRepMin;
      t.repMax = s.baseRepMax;
      s.reason = { code: 'down', deltaKg: t.loadKg - load };
      s.missStreak = 0;
    } else if (s.missStreak >= 2) {
      t.repMin = s.baseRepMin;
      t.repMax = s.baseRepMax;
      s.reason = { code: 'down', deltaKg: 0 };
      s.missStreak = 0;
    } else {
      s.reason = { code: 'hold_miss', set: missed.idx };
    }
  }

  // D17 stall: no rise in load or total reps.
  const loadUp =
    t.loadKg !== null && beforeLoad !== null && (assisted ? t.loadKg < beforeLoad : t.loadKg > beforeLoad);
  s.noProgress = loadUp || prevReps > state.lastReps ? 0 : s.noProgress + 1;
  s.lastReps = prevReps;
  return s;
}

/** Replays every exposure. Deload exposures don't move the target (they're planned light weeks). */
export function replay(ex: Ex, exposures: Exposure[], profile: Prof): GoalState {
  let s = initialState(ex, profile);
  for (const e of [...exposures].sort((a, b) => a.at - b.at)) {
    if (e.deload) continue;
    s = progress(s, e, ex, profile);
  }
  return s;
}

export interface GoalOpts {
  deload?: boolean;
  override?: Target | null;
  warmupEligible?: boolean;
  warmupsEnabled?: boolean;
}

/** FR-GOAL-1: `goalFor(exercise, history, profile, settings) → {sets, repMin, repMax, load, warmups[], reason}`. */
export function goalFor(ex: Ex, exposures: Exposure[], profile: Prof, opts: GoalOpts = {}): Goal {
  const s = replay(ex, exposures, profile);
  let target: Target = { ...s.target };
  let reason = s.reason;
  if (opts.override) {
    target = { ...opts.override };
    reason = { code: 'override' };
  }
  if (opts.deload) {
    target = { ...target, sets: Math.max(1, Math.round(target.sets * INTENSITY.deload.volumeFactor)) };
    reason = { code: 'deload' };
  }
  const warmups =
    opts.warmupEligible && usesLoad(ex.loadType)
      ? warmupsFor(target.loadKg, ex.incrementKg, opts.warmupsEnabled ?? INTENSITY.warmup.enabled)
      : [];
  return {
    ...target,
    warmups,
    reason,
    calibration: usesLoad(ex.loadType) && s.target.loadKg === null,
    frozen: s.frozen,
    stalled: s.noProgress >= 3 || s.missStreak >= 2,
    suggestLoadType: s.suggestLoadType,
  };
}

/** Groups an exercise's sets into exposures (one per session), for goalFor. */
export function exposuresFrom(
  sets: LoggedSet[],
  sessions: Map<string, { startedAt: number; deload: boolean }>,
): Exposure[] {
  const bySession = new Map<string, LoggedSet[]>();
  for (const s of sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  const out: Exposure[] = [];
  for (const [id, list] of bySession) {
    const sess = sessions.get(id);
    if (!sess) continue;
    out.push({ at: sess.startedAt, deload: sess.deload, sets: list });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** A stable view of a load delta in the user's unit (for reasons like "Up 2 kg"). */
export function deltaIn(units: ProfileLike['units'], deltaKg: number): number {
  const v = units === 'kg' ? deltaKg : kgToLb(deltaKg);
  return Math.round(Math.abs(v) * 10) / 10;
}

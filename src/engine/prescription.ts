/**
 * FR-GOAL-2 / FR-ONB-2: sets, rep ranges, rest and effort from intensity.json by level,
 * goal modifier and role, with the Easier/Harder nudge (moves sets and effort one level, keeps reps).
 */
import { INTENSITY, type LevelIntensity } from './data';
import { EXPERIENCES, type Experience, type GoalKind, type Role } from './types';

export interface PrescriptionInput {
  experience: Experience;
  goal: GoalKind;
  nudge: -1 | 0 | 1;
}

export interface Prescription {
  sets: number;
  setsRange: [number, number];
  repMin: number;
  repMax: number;
  restSec: number;
  targetEffort: LevelIntensity['targetEffort'];
}

function shiftLevel(level: Experience, nudge: -1 | 0 | 1): Experience {
  const i = EXPERIENCES.indexOf(level) + nudge;
  return EXPERIENCES[Math.max(0, Math.min(EXPERIENCES.length - 1, i))]!;
}

/** Whether Easier / Harder can move any further. */
export function canNudge(level: Experience, nudge: -1 | 0 | 1, dir: -1 | 1): boolean {
  const next = Math.max(-1, Math.min(1, nudge + dir));
  if (next === nudge) return false;
  return shiftLevel(level, next as -1 | 0 | 1) !== shiftLevel(level, nudge);
}

export function prescribe(p: PrescriptionInput, role: Role): Prescription {
  const base = INTENSITY.levels[p.experience];
  const effortLevel = INTENSITY.levels[shiftLevel(p.experience, p.nudge)];
  const mod = INTENSITY.goalModifiers[p.goal] ?? {};
  const setsRange = mod.setsPerExercise ?? effortLevel.setsPerExercise;
  const reps =
    role === 'compound' ? (mod.compoundReps ?? base.compoundReps) : (mod.isolationReps ?? base.isolationReps);
  const restSec =
    role === 'compound' ? (mod.restSecCompound ?? base.restSec.compound) : base.restSec.isolation;
  return {
    sets: setsRange[0],
    setsRange,
    repMin: reps[0],
    repMax: reps[1],
    restSec,
    targetEffort: effortLevel.targetEffort,
  };
}

/** Weekly hard sets per muscle target band (§6.5), nudged like sets. */
export function weeklyTarget(p: PrescriptionInput): [number, number] {
  const mod = INTENSITY.goalModifiers[p.goal] ?? {};
  return (
    mod.weeklyHardSetsPerMuscle ?? INTENSITY.levels[shiftLevel(p.experience, p.nudge)].weeklyHardSetsPerMuscle
  );
}

export interface CoachCall {
  sets: [number, number];
  reps: [number, number];
  rest: [number, number];
  effort: LevelIntensity['targetEffort'];
}

/** S01 "Coach's call": the combined ranges across compound and isolation work. */
export function coachCall(p: PrescriptionInput): CoachCall {
  const c = prescribe(p, 'compound');
  const i = prescribe(p, 'isolation');
  return {
    sets: c.setsRange,
    reps: [Math.min(c.repMin, i.repMin), Math.max(c.repMax, i.repMax)],
    rest: [Math.min(c.restSec, i.restSec), Math.max(c.restSec, i.restSec)],
    effort: c.targetEffort,
  };
}

/** RIR range for the effort chips (intensity.json note: easy = RIR 3+, solid = 1–2, hard = 0). */
export function repsInReserve(effort: LevelIntensity['targetEffort']): [number, number] {
  switch (effort) {
    case 'easy-solid':
      return [1, 3];
    case 'solid':
      return [1, 2];
    case 'solid-hard':
      return [0, 2];
  }
}

/** Shared engine types. Pure data, no React or Dexie (PRD §6). */

export const MUSCLE_GROUPS = [
  'chest',
  'lats',
  'upper back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'lower back',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export const EXPERIENCES: Experience[] = ['beginner', 'intermediate', 'advanced'];
export type GoalKind = 'build_muscle' | 'get_stronger' | 'recomp' | 'general_fitness';
export const GOAL_KINDS: GoalKind[] = ['build_muscle', 'get_stronger', 'recomp', 'general_fitness'];
export type Units = 'kg' | 'lb';
export type Role = 'compound' | 'isolation';
export type SetKind = 'warmup' | 'work' | 'extra';
export type Side = 'L' | 'R';
export type Effort = 'easy' | 'solid' | 'hard';

export type LoadType =
  | 'barbell'
  | 'dumbbell'
  | 'machine_stack'
  | 'plate_loaded'
  | 'cable'
  | 'bodyweight'
  | 'bodyweight_plus'
  | 'assisted'
  | 'kettlebell'
  | 'timed';

export type Pattern =
  | 'vertical_pull'
  | 'horizontal_pull'
  | 'horizontal_press'
  | 'incline_press'
  | 'overhead_press'
  | 'lateral_raise'
  | 'rear_delt'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'chest_fly'
  | 'squat'
  | 'hinge'
  | 'leg_press_or_lunge'
  | 'knee_extension'
  | 'knee_flexion'
  | 'hip_extension'
  | 'hip_abduction'
  | 'calf_raise'
  | 'core_flexion'
  | 'core_antiextension'
  | 'carry';

/** An exercise as the engines see it (FR-LIB-2). */
export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  pattern: Pattern | null;
  role: Role;
  equipment: string;
  /** AND of OR-groups of equipment/machine ids (DECISIONS D11). */
  requires: string[][];
  machineId?: string;
  loadType: LoadType;
  incrementKg: number;
  unilateral: boolean;
  instructions: string[];
  poseId?: string;
  limitationAreas: string[];
  level: Experience;
  isCustom?: boolean;
  /** Deleted custom exercise: kept for history, hidden from pickers (FR-LIB-6). */
  deleted?: boolean;
  notes?: string;
}

/** A logged set as the engines see it. */
export interface LoggedSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  idx: number;
  kind: SetKind;
  loadKg: number;
  reps: number;
  side?: Side;
  effort?: Effort;
  hurts: boolean;
  loggedAt: number;
}

export interface Target {
  sets: number;
  repMin: number;
  repMax: number;
  /** null = calibration: the user picks the first load (FR-GOAL-4). */
  loadKg: number | null;
}

export interface WarmupSet {
  loadKg: number;
  reps: number;
}

export interface ProfileLike {
  experience: Experience;
  goal: GoalKind;
  daysPerWeek: number;
  nudge: -1 | 0 | 1;
  units: Units;
  sex?: 'male' | 'female' | 'unspecified';
  birthYear?: number;
  limitations: string[];
}

export interface SettingsLike {
  restCompoundSec: number;
  restIsolationSec: number;
  warmups: boolean;
  restAlert: boolean;
  weekStart: number; // 0 = Sunday … 1 = Monday (default)
}

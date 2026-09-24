/**
 * Typed access to the tunable constants in src/data (copied from /data, NFR-MAINT-2).
 * Engines read numbers from here, never hard-code them.
 */
import intensityJson from '@/data/intensity.json';
import loadTypesJson from '@/data/load-types.json';
import splitsJson from '@/data/splits.json';
import standardsJson from '@/data/standards.json';
import xpJson from '@/data/xp.json';
import machinesJson from '@/data/machines.json';
import equipmentJson from '@/data/equipment.json';
import type { Experience, GoalKind, LoadType, MuscleGroup, Pattern, Role } from './types';

export interface LevelIntensity {
  setsPerExercise: [number, number];
  compoundReps: [number, number];
  isolationReps: [number, number];
  restSec: { compound: number; isolation: number };
  targetEffort: 'easy-solid' | 'solid' | 'solid-hard';
  weeklyHardSetsPerMuscle: [number, number];
  deloadEveryWeeks: number | null;
}

export interface GoalModifier {
  compoundReps?: [number, number];
  isolationReps?: [number, number];
  setsPerExercise?: [number, number];
  weeklyHardSetsPerMuscle?: [number, number];
  restSecCompound?: number;
}

export interface Intensity {
  levels: Record<Experience, LevelIntensity>;
  goalModifiers: Record<GoalKind, GoalModifier>;
  secondaryMuscleSetWeight: number;
  sessionMinutesTarget: number;
  secondsPerSetIncludingRest: Record<Role, number>;
  warmup: {
    enabled: boolean;
    minWorkingKg: number;
    ramp: { pct: number; reps: number }[];
    onlyFirstCompoundPerMuscleGroup: boolean;
  };
  deload: { volumeFactor: number; sameWeights: boolean; triggerStalledExercises: number };
  calibration: { sessionsCountTowardStreak: boolean };
}

export interface LoadTypeInfo {
  logAs: string;
  label?: string;
  defaultIncrementKg: number;
  defaultIncrementLb?: number;
  volumeMultiplier?: number;
}

export interface SplitSlot {
  pattern: Pattern;
  role: Role;
  muscle: MuscleGroup;
}
export interface SplitTemplate {
  id: string;
  name: string;
  daysPerWeek: number[];
  recommendedFor?: { days: number[]; levels: Experience[] };
  sessions: { name: string; slots: SplitSlot[] }[];
  sixDayNote?: string;
}

export interface StandardsData {
  source: string;
  bands: string[];
  benchmarks: Record<
    string,
    { muscleGroups: MuscleGroup[]; male: number[]; female: number[]; unit?: string; note?: string }
  >;
  ageAdjust: Record<string, number | string>;
  e1rm: { formula: string; maxRepsUsed: number };
  machineOnlyMessage: string;
}

export interface XpData {
  events: Record<
    | 'goalSet'
    | 'bonusRep'
    | 'bonusRepCapPerExercise'
    | 'extraSetBonus'
    | 'pr'
    | 'sessionComplete'
    | 'weekComplete'
    | 'weeklyQuest'
    | 'firstSession',
    number
  >;
  sessionCap: number;
  levels: { formula: string; titles: [number, string][] };
  streak: { restWeekPassEveryWeeks: number };
  milestones: {
    id: string;
    thresholdsKg?: number[];
    thresholds?: number[];
    equivalents?: [string, number][];
  }[];
}

export interface MachineData {
  id: string;
  name: string;
  category: string;
  loadType: LoadType;
  defaultIncrementKg: number;
  exercises: string[];
  primaryMuscles: MuscleGroup[];
}

export const INTENSITY = intensityJson as unknown as Intensity;
export const LOAD_TYPES = loadTypesJson.types as unknown as Record<LoadType, LoadTypeInfo>;
export const SPLITS = splitsJson.templates as unknown as SplitTemplate[];
export const STANDARDS = standardsJson as unknown as StandardsData;
export const XP = xpJson as unknown as XpData;
export const MACHINES = machinesJson.machines as unknown as MachineData[];
export const EQUIPMENT = equipmentJson.equipment;
export const PRESETS = equipmentJson.presets as Record<
  string,
  { equipment: string[] | 'all'; machines: string[] | 'all' }
>;

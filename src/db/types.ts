/**
 * Row types for Dexie schema v1 (PRD §7). Weights are always kg (CLAUDE.md "Data").
 * Times are epoch milliseconds; calendar dates are local 'YYYY-MM-DD' strings.
 * IndexedDB can't index booleans, so indexed flags are 0 | 1 (DECISIONS D32).
 */
import type {
  Effort,
  Experience,
  GoalKind,
  LoadType,
  MuscleGroup,
  Pattern,
  Role,
  SetKind,
  Side,
  Units,
} from '@/engine/types';
import type { FoodItem, Nutrients, Portion } from '@/engine/food-types';

export interface MetaRow {
  key: 'schemaVersion' | 'installedAt' | 'lastBackupAt' | 'onboardingStep' | 'onboardingDraft' | string;
  value: unknown;
}

export interface ProfileRow {
  id: 'me';
  experience: Experience;
  goal: GoalKind;
  daysPerWeek: number;
  /** Easier (-1) / coach's call (0) / harder (+1). */
  nudge: -1 | 0 | 1;
  units: Units;
  sex?: 'male' | 'female' | 'unspecified';
  birthYear?: number;
  limitations: string[];
  /** Schema v2, PRD-1.2 FR-TGT-1: inputs for Food targets, shared with body stats (FR-SHR-1). */
  heightCm?: number;
  activity?: Activity;
  diet?: { phase: DietPhase; rateKgPerWeek: number };
}

export type Activity = 'desk' | 'light' | 'active' | 'very';
export type DietPhase = 'lose' | 'maintain' | 'gain';

export interface BodyweightRow {
  id?: number;
  date: string;
  kg: number;
}

export interface GymRow {
  id: 'me';
  presetId: string;
  equipmentIds: string[];
  machineIds: string[];
}

export interface MachineNoteRow {
  machineId: string;
  photoBlob?: Blob;
  /** DECISIONS D52: fallback when the browser can't store Blobs in IndexedDB (private/ephemeral WebKit). */
  photoDataUrl?: string;
  settings: Record<string, string>;
  incrementKg?: number;
  customName?: string;
  /** FR-GYM-4 custom machines. */
  custom?: { name: string; category: string; loadType: LoadType; incrementKg: number };
  updatedAt?: number;
}

export interface ExerciseRow {
  id: string;
  name: string;
  aliases: string[];
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  pattern: Pattern | null;
  role: Role;
  equipment: string;
  requires: string[][];
  machineId?: string;
  loadType: LoadType;
  incrementKg: number;
  unilateral: boolean;
  instructions: string[];
  poseId?: string;
  limitationAreas: string[];
  level: Experience;
  isCustom: 0 | 1;
  notes?: string;
  deletedAt?: number;
}

export interface RoutineItem {
  exerciseId: string;
  order: number;
}

export interface RoutineSession {
  id: string;
  name: string;
  items: RoutineItem[];
}

export interface RoutineRow {
  id: string;
  splitId: string;
  active: 0 | 1;
  createdAt: number;
  archivedAt?: number;
  sessions: RoutineSession[];
}

export interface QueueRow {
  id: 'me';
  routineId: string;
  nextSessionIndex: number;
  /** User-chosen rotation order (indices into routine.sessions); empty = natural order. */
  order?: number[];
}

export interface SessionRow {
  id: string;
  startedAt: number;
  endedAt?: number;
  routineId?: string;
  routineSessionId: string;
  name: string;
  calibration: boolean;
  deload: boolean;
  notes?: string;
  /** Exercise ids for this session only (swaps "this session only" and unplanned adds). */
  plan: { exerciseId: string; planned: boolean }[];
  lastActivityAt?: number;
  autoFinished?: boolean;
}

export interface SetRow {
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
  goalMet: boolean;
  bonusReps: number;
  loggedAt: number;
}

export interface GoalTarget {
  sets: number;
  repMin: number;
  repMax: number;
  loadKg: number | null;
}

export interface GoalRow extends GoalTarget {
  exerciseId: string;
  reason: string;
  frozen: boolean;
  missStreak: number;
  updatedAt: number;
  /** FR-PRG-8 / S24: user override for the next exposure. */
  override?: GoalTarget & { reason?: string };
  /** Exposure count so far (for stall detection). */
  exposures?: number;
  stallCount?: number;
  /** Bodyweight → bodyweight_plus suggestion (FR-PRG-5). */
  suggestLoadType?: LoadType;
}

export interface GoalChangeRow {
  id?: number;
  exerciseId: string;
  from: GoalTarget;
  to: GoalTarget;
  reason: string;
  at: number;
  overridden: boolean;
}

export interface PrRow {
  id?: number;
  exerciseId: string;
  e1rm: number;
  loadKg: number;
  reps: number;
  setId: string;
  at: number;
  prevE1rm: number;
}

export interface SettingRow {
  key:
    | 'theme'
    | 'restCompoundSec'
    | 'restIsolationSec'
    | 'warmups'
    | 'restAlert'
    | 'weekStart'
    | 'installBannerDismissed'
    | 'backupNudgeDismissedAt'
    | string;
  value: unknown;
}

export interface ErrorRow {
  id?: number;
  at: number;
  message: string;
  stack?: string;
  route?: string;
}

// ---------- schema v2: Food (PRD-1.2) ----------

export type MealSlot = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

/**
 * An imported library food (FR-FOOD-1/2). Search runs on an in-memory index, so library rows carry
 * no word index: indexing ~140,000 words made the one-time import several times slower (D113).
 */
export type FoodLibRow = FoodItem;

/** FR-FOOD-5: the user's own food, recipe (ingredients + yield) or quick add. Deleting keeps history. */
export interface CustomFoodRow extends FoodItem {
  /** Normalised search words (multi-entry index). */
  terms: string[];
  isRecipe: 0 | 1;
  ingredients?: { foodId: string; grams: number }[];
  /** Cooked weight of the whole recipe in grams; per-100 g values are computed from it. */
  yieldGrams?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

/**
 * FR-DIARY-1/2: one logged food. `per100g` is a snapshot taken when logging, so editing or
 * re-importing the food never rewrites past days. Grams = portion grams × servings.
 */
export interface DiaryRow {
  id: string;
  date: string;
  meal: MealSlot;
  loggedAt: number;
  foodId: string;
  name: string;
  brand?: string;
  portion: Portion;
  servings: number;
  grams: number;
  per100g: Nutrients;
}

/** FR-DIARY-3: a named group of foods logged together. */
export interface SavedMealRow {
  id: string;
  name: string;
  items: { foodId: string; portion: Portion; servings: number }[];
  createdAt: number;
}

/** FR-FAST-1: one fast; open while `endedAt` is missing. */
export interface FastRow {
  id: string;
  startedAt: number;
  endedAt?: number;
  planHours: number;
}

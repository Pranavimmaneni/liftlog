import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyweightRow,
  CustomFoodRow,
  DiaryRow,
  ErrorRow,
  FastRow,
  FoodLibRow,
  ExerciseRow,
  GoalChangeRow,
  GoalRow,
  GymRow,
  MachineNoteRow,
  MetaRow,
  PrRow,
  ProfileRow,
  QueueRow,
  RoutineRow,
  SavedMealRow,
  SessionRow,
  SetRow,
  SettingRow,
} from './types';

export const SCHEMA_VERSION = 2;
export const DB_NAME = 'liftlog';

/** PRD §7 schema v1. `*primary` / `*aliases` are multi-entry indexes over arrays. */
export const STORES_V1 = {
  meta: 'key',
  profile: 'id',
  bodyweights: '++id, date',
  gym: 'id',
  machineNotes: 'machineId',
  exercises: 'id, name, *aliases, *primary, isCustom',
  routines: 'id, active',
  queue: 'id',
  sessions: 'id, startedAt, routineSessionId',
  sets: 'id, sessionId, exerciseId, [exerciseId+loggedAt]',
  goals: 'exerciseId',
  goalChanges: '++id, exerciseId, at',
  prs: '++id, exerciseId, at',
  settings: 'key',
  errors: '++id, at',
} as const;

/**
 * Schema v2 (PRD-1.2 NFR-REL-6): additive. New Food tables only; no v1 store or row changes.
 * `foodLib` is the imported food library (rebuilt from the bundled chunks, never backed up, like the
 * seeded exercises in D12); `foods` holds the user's own foods and recipes.
 */
export const STORES_V2 = {
  ...STORES_V1,
  foodLib: 'id, *terms, gtin',
  foods: 'id, *terms, gtin, isRecipe',
  diary: 'id, date, [date+meal], loggedAt, foodId',
  savedMeals: 'id',
  fasts: 'id, startedAt',
} as const;

export type LiftLogDB = Dexie & {
  meta: EntityTable<MetaRow, 'key'>;
  profile: EntityTable<ProfileRow, 'id'>;
  bodyweights: EntityTable<BodyweightRow, 'id'>;
  gym: EntityTable<GymRow, 'id'>;
  machineNotes: EntityTable<MachineNoteRow, 'machineId'>;
  exercises: EntityTable<ExerciseRow, 'id'>;
  routines: EntityTable<RoutineRow, 'id'>;
  queue: EntityTable<QueueRow, 'id'>;
  sessions: EntityTable<SessionRow, 'id'>;
  sets: EntityTable<SetRow, 'id'>;
  goals: EntityTable<GoalRow, 'exerciseId'>;
  goalChanges: EntityTable<GoalChangeRow, 'id'>;
  prs: EntityTable<PrRow, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
  errors: EntityTable<ErrorRow, 'id'>;
  foodLib: EntityTable<FoodLibRow, 'id'>;
  foods: EntityTable<CustomFoodRow, 'id'>;
  diary: EntityTable<DiaryRow, 'id'>;
  savedMeals: EntityTable<SavedMealRow, 'id'>;
  fasts: EntityTable<FastRow, 'id'>;
};

export const TABLES = Object.keys(STORES_V2) as (keyof typeof STORES_V2)[];
/** The user's own data: everything except the rebuildable food library (backup, restore, demo data). */
export const USER_TABLES = TABLES.filter((t) => t !== 'foodLib');

/**
 * Opens (or creates) the database. Every future schema change adds
 * `db.version(n).stores(...).upgrade(...)` here, plus a migration test (NFR-REL-3).
 */
export function createDB(name = DB_NAME): LiftLogDB {
  const db = new Dexie(name) as LiftLogDB;
  db.version(1).stores(STORES_V1);
  // v2 only adds tables and optional profile fields (heightCm, activity, diet), so nothing to rewrite.
  db.version(2)
    .stores(STORES_V2)
    .upgrade((tx) => tx.table('meta').put({ key: 'schemaVersion', value: 2 }));
  db.on('populate', (tx) => {
    void tx.table('meta').bulkAdd([
      { key: 'schemaVersion', value: SCHEMA_VERSION },
      { key: 'installedAt', value: Date.now() },
    ]);
  });
  return db;
}

export const db = createDB();

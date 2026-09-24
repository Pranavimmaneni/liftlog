import { db } from './schema';
import { uid } from './ids';
import type { ExerciseRow } from './types';
import { EQUIPMENT, LOAD_TYPES, MACHINES } from '@/engine/data';
import { normalize } from '@/engine/search';
import type { Exercise, LoadType, MuscleGroup, Role } from '@/engine/types';

export interface CustomInput {
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  /** An equipment id, a machine id, or '' for none. */
  gear: string;
  machine: boolean;
  loadType: LoadType | null;
  role: Role;
  unilateral: boolean;
  incrementKg: number;
  notes: string;
}

export type CustomErrors = Partial<Record<'name' | 'primary' | 'loadType', 'required' | 'taken'>>;

/** S17 validation: name required and unique (case/punctuation-insensitive), primary and load type required. */
export function validateCustom(input: CustomInput, existing: Exercise[], editingId?: string): CustomErrors {
  const e: CustomErrors = {};
  const n = normalize(input.name);
  if (!n) e.name = 'required';
  else if (existing.some((x) => !x.deleted && x.id !== editingId && normalize(x.name) === n))
    e.name = 'taken';
  if (!input.primary) e.primary = 'required';
  if (!input.loadType) e.loadType = 'required';
  return e;
}

export function defaultIncrement(lt: LoadType): number {
  return LOAD_TYPES[lt]?.defaultIncrementKg ?? 0;
}

/** FR-LIB-6: custom exercises live alongside seeded ones (DECISIONS D12). */
export async function saveCustomExercise(input: CustomInput, editingId?: string): Promise<string> {
  const id =
    editingId ?? `custom-${normalize(input.name).replace(/ /g, '-').slice(0, 40)}-${uid().slice(0, 6)}`;
  const prev = editingId ? await db.exercises.get(editingId) : undefined;
  const gearName =
    EQUIPMENT.find((e) => e.id === input.gear)?.name ??
    MACHINES.find((m) => m.id === input.gear)?.name ??
    (input.gear ? (await db.machineNotes.get(input.gear))?.custom?.name : undefined);
  const row: ExerciseRow = {
    id,
    name: input.name.trim(),
    aliases: prev?.aliases ?? [],
    primary: [input.primary!],
    secondary: input.secondary.filter((m) => m !== input.primary),
    pattern: prev?.pattern ?? null,
    role: input.role,
    equipment: gearName ?? 'Bodyweight',
    requires: input.gear ? [[input.gear]] : [],
    machineId: input.machine && input.gear ? input.gear : undefined,
    loadType: input.loadType!,
    incrementKg: input.incrementKg,
    unilateral: input.unilateral,
    instructions: prev?.instructions?.length ? prev.instructions : [],
    limitationAreas: prev?.limitationAreas ?? [],
    level: 'beginner',
    isCustom: 1,
    notes: input.notes.trim() || undefined,
  };
  await db.exercises.put(row);
  return id;
}

/** FR-LIB-6: delete with history kept: the row is soft-deleted and removed from routines. */
export async function deleteCustomExercise(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.routines, async () => {
    const row = await db.exercises.get(id);
    if (row) await db.exercises.put({ ...row, deletedAt: Date.now() });
    const routines = await db.routines.where('active').equals(1).toArray();
    for (const r of routines) {
      await db.routines.put({
        ...r,
        sessions: r.sessions.map((s) => ({
          ...s,
          items: s.items.filter((i) => i.exerciseId !== id).map((i, order) => ({ ...i, order })),
        })),
      });
    }
  });
}

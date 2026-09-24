import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './schema';
import type { ExerciseRow, MachineNoteRow } from './types';
import type { Exercise } from '@/engine/types';
import { registerPoses } from '@/illustration/svg';
import { tier2Defs, type PoseData } from '@/illustration/tier2';

/**
 * Exercise catalogue = the seeded library (a lazy JSON chunk, NFR-PERF-3, DECISIONS D12) merged with
 * custom exercises from Dexie (FR-LIB-6). A custom row with a seeded id overrides that exercise.
 * Machine increments from My Gym override the exercise increment (FR-GOAL-3, FR-GYM-2).
 */
let catalog: Promise<Exercise[]> | null = null;
let catalogSync: Exercise[] | null = null;

/**
 * Loads the seeded library and the Tier 2 pose data together (both lazy chunks). A Tier 2 pose is
 * keyed by exercise id, so exercises with one get `poseId = id` here (DECISIONS D54).
 */
export function loadCatalog(): Promise<Exercise[]> {
  catalog ??= Promise.all([import('@/data/exercises.json'), import('@/data/poses.json')]).then(([m, p]) => {
    const poses = p.default as unknown as PoseData;
    registerPoses(tier2Defs(poses));
    catalogSync = (m.default as Exercise[]).map((e) =>
      e.poseId || !poses.poses[e.id] ? e : { ...e, poseId: e.id },
    );
    return catalogSync;
  });
  return catalog;
}

export function rowToExercise(r: ExerciseRow): Exercise {
  return {
    id: r.id,
    name: r.name,
    aliases: r.aliases,
    primary: r.primary,
    secondary: r.secondary,
    pattern: r.pattern,
    role: r.role,
    equipment: r.equipment,
    requires: r.requires,
    machineId: r.machineId,
    loadType: r.loadType,
    incrementKg: r.incrementKg,
    unilateral: r.unilateral,
    instructions: r.instructions,
    poseId: r.poseId,
    limitationAreas: r.limitationAreas,
    level: r.level,
    isCustom: r.isCustom === 1,
    deleted: r.deletedAt !== undefined,
    notes: r.notes,
  };
}

export function mergeCatalog(
  seed: Exercise[],
  custom: ExerciseRow[],
  notes: MachineNoteRow[],
): Map<string, Exercise> {
  const inc = new Map(
    notes.filter((n) => n.incrementKg && n.incrementKg > 0).map((n) => [n.machineId, n.incrementKg!]),
  );
  const out = new Map<string, Exercise>();
  for (const e of seed) out.set(e.id, e);
  for (const r of custom) out.set(r.id, rowToExercise(r));
  if (inc.size) {
    for (const [id, e] of out) {
      const m = e.machineId && inc.get(e.machineId);
      if (m) out.set(id, { ...e, incrementKg: m });
    }
  }
  return out;
}

export async function getExerciseMap(): Promise<Map<string, Exercise>> {
  const [seed, custom, notes] = await Promise.all([
    loadCatalog(),
    db.exercises.toArray(),
    db.machineNotes.toArray(),
  ]);
  return mergeCatalog(seed, custom, notes);
}

/** Live map of every exercise; undefined until the catalogue chunk has loaded. */
export function useExerciseMap(): Map<string, Exercise> | undefined {
  const [seed, setSeed] = useState<Exercise[] | null>(catalogSync);
  useEffect(() => {
    if (!seed) void loadCatalog().then(setSeed);
  }, [seed]);
  const custom = useLiveQuery(() => db.exercises.toArray(), []);
  const notes = useLiveQuery(() => db.machineNotes.toArray(), []);
  return useMemo(
    () => (seed && custom && notes ? mergeCatalog(seed, custom, notes) : undefined),
    [seed, custom, notes],
  );
}

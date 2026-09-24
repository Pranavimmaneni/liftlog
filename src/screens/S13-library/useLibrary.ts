import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { useExerciseMap } from '@/db/catalog';
import { useGym } from '@/db/repo';
import { buildIndex, search } from '@/engine/search';
import { isAvailable, presetGym } from '@/engine/suggest';
import type { Exercise, Experience, MuscleGroup } from '@/engine/types';

export interface LibraryFilters {
  query: string;
  inGym: boolean;
  muscle: MuscleGroup | null;
  equipment: string | null;
  level: Experience | null;
}

export interface LibraryResult {
  exercise: Exercise;
  available: boolean;
  alias?: string;
}

/** FR-LIB-3/4/5: search, filters (in my gym by default), recently used first when the search is empty. */
export function useLibrary(f: LibraryFilters) {
  const map = useExerciseMap();
  const gym = useGym();
  const recent = useLiveQuery(async () => {
    // Recent sessions via the indexed startedAt, then their sets newest first.
    const sessions = await db.sessions.orderBy('startedAt').reverse().limit(12).toArray();
    const sets = (
      await db.sets
        .where('sessionId')
        .anyOf(sessions.map((s) => s.id))
        .toArray()
    ).sort((a, b) => b.loggedAt - a.loggedAt);
    const seen: string[] = [];
    for (const s of sets) if (!seen.includes(s.exerciseId)) seen.push(s.exerciseId);
    return seen.slice(0, 8);
  }, []);
  const all = useMemo(() => (map ? [...map.values()].filter((e) => !e.deleted) : []), [map]);
  const index = useMemo(
    () =>
      buildIndex(
        all,
        (e) => e.name,
        (e) => e.aliases,
      ),
    [all],
  );
  const g = gym ?? presetGym('full-gym');

  const results: LibraryResult[] = useMemo(() => {
    if (!map) return [];
    const q = f.query.trim();
    const base: LibraryResult[] = q
      ? search(index, q).map((h) => ({
          exercise: h.item,
          available: isAvailable(h.item, g),
          alias: h.viaAlias,
        }))
      : all.map((e) => ({ exercise: e, available: isAvailable(e, g) }));
    const filtered = base.filter(
      (r) =>
        (!f.inGym || r.available) &&
        (!f.muscle || r.exercise.primary.includes(f.muscle)) &&
        (!f.equipment ||
          r.exercise.requires.some((grp) => grp.includes(f.equipment!)) ||
          r.exercise.machineId === f.equipment) &&
        (!f.level || r.exercise.level === f.level),
    );
    if (!q) {
      const rank = new Map((recent ?? []).map((id, i) => [id, i]));
      filtered.sort((a, b) => {
        const ra = rank.get(a.exercise.id) ?? 999;
        const rb = rank.get(b.exercise.id) ?? 999;
        return ra - rb || a.exercise.name.localeCompare(b.exercise.name);
      });
    }
    return filtered;
  }, [map, index, all, f.query, f.inGym, f.muscle, f.equipment, f.level, g, recent]);

  return { loading: !map, results, total: all.length, recentIds: recent ?? [], map };
}

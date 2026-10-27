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

/**
 * FR-LIB-3/4/5: search, filters (in my gym by default), recently used first when the search is empty.
 * FR-LIB-8: `outside` holds the search matches that "In my gym" filtered out.
 */
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

  const results = useMemo((): { filtered: LibraryResult[]; outside: LibraryResult[] } => {
    if (!map) return { filtered: [], outside: [] };
    const q = f.query.trim();
    const base: LibraryResult[] = q
      ? search(index, q).map((h) => ({
          exercise: h.item,
          available: isAvailable(h.item, g),
          alias: h.viaAlias,
        }))
      : all.map((e) => ({ exercise: e, available: isAvailable(e, g) }));
    const matches = base.filter(
      (r) =>
        (!f.muscle || r.exercise.primary.includes(f.muscle)) &&
        (!f.equipment ||
          r.exercise.requires.some((grp) => grp.includes(f.equipment!)) ||
          r.exercise.machineId === f.equipment) &&
        (!f.level || r.exercise.level === f.level),
    );
    // FR-LIB-8: the user made their custom exercises, so "In my gym" never hides them.
    const inGym = (r: LibraryResult) => !f.inGym || r.available || !!r.exercise.isCustom;
    const filtered = matches.filter(inGym);
    if (!q) {
      const rank = new Map((recent ?? []).map((id, i) => [id, i]));
      filtered.sort((a, b) => {
        const ra = rank.get(a.exercise.id) ?? 999;
        const rb = rank.get(b.exercise.id) ?? 999;
        return ra - rb || a.exercise.name.localeCompare(b.exercise.name);
      });
    }
    // FR-LIB-8: a search never hides a match; ones outside the gym are listed after, separately.
    const outside = q && f.inGym ? matches.filter((r) => !inGym(r)) : [];
    return { filtered, outside };
  }, [map, index, all, f.query, f.inGym, f.muscle, f.equipment, f.level, g, recent]);

  return {
    loading: !map,
    results: results.filtered,
    outside: results.outside,
    total: all.length,
    recentIds: recent ?? [],
    map,
  };
}

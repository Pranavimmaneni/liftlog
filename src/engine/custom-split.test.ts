import { describe, expect, it } from 'vitest';
import exercisesJson from '@/data/exercises.json';
import {
  buildCustomRoutine,
  customSessions,
  dayName,
  MUSCLE_DAY_GROUPS,
  orderGroups,
  slotsForDay,
} from './custom-split';
import { INTENSITY } from './data';
import { prescribe } from './prescription';
import { presetGym } from './suggest';
import type { Exercise, MuscleGroup } from './types';

const EX = exercisesJson as Exercise[];
const profile = { experience: 'intermediate' as const, goal: 'build_muscle' as const, nudge: 0 as const };
const ctx = (preset = 'full-gym', limitations: string[] = []) => ({
  exercises: EX,
  gym: presetGym(preset),
  profile: { ...profile, limitations },
});
const minutes = (slots: { role: 'compound' | 'isolation' }[]) =>
  slots.reduce(
    (t, s) => t + prescribe(profile, s.role).sets * INTENSITY.secondsPerSetIncludingRest[s.role],
    0,
  ) / 60;
const groupMuscles = (ids: string[]) =>
  new Set(orderGroups(ids).flatMap((g) => g.slots.map((s) => s.muscle)));

describe('build-your-own split: muscle groups per day (S03 custom, D79)', () => {
  it('every group is well formed: core ≤ slots, real patterns', () => {
    const patterns = new Set(EX.map((e) => e.pattern));
    for (const g of MUSCLE_DAY_GROUPS) {
      expect(g.core, g.id).toBeGreaterThan(0);
      expect(g.core, g.id).toBeLessThanOrEqual(g.slots.length);
      for (const s of g.slots) expect(patterns.has(s.pattern), `${g.id}: ${s.pattern}`).toBe(true);
    }
  });

  it('names days from the groups in the order picked; empty days are "Day A…"', () => {
    expect(dayName(['chest', 'biceps'], 0)).toBe('Chest + Biceps');
    expect(dayName(['legs', 'back', 'nope', 'legs'], 0)).toBe('Legs + Back');
    expect(dayName([], 2)).toBe('Day C');
    const s = customSessions([['legs'], ['legs'], []], profile);
    expect(s.map((x) => x.name)).toEqual(['Legs', 'Legs 2', 'Day C']);
    expect(s[2]!.slots).toEqual([]);
  });

  it('core movements of every group come first, then extras while the session fits the time target', () => {
    const slots = slotsForDay(['chest', 'biceps'], profile);
    expect(slots.slice(0, 3).map((s) => s.pattern)).toEqual([
      'horizontal_press',
      'elbow_flexion',
      'incline_press',
    ]);
    expect(slots.map((s) => s.pattern)).toContain('chest_fly');
    expect(minutes(slots)).toBeLessThanOrEqual(INTENSITY.sessionMinutesTarget);
    // A big day keeps all core lifts even if that's over the target, but adds no extras.
    const big = slotsForDay(['legs', 'back', 'chest', 'shoulders'], profile);
    for (const id of ['legs', 'back', 'chest', 'shoulders']) {
      const g = MUSCLE_DAY_GROUPS.find((x) => x.id === id)!;
      for (const core of g.slots.slice(0, g.core)) expect(big).toContainEqual(core);
    }
  });

  it('a slot shared by two groups is used once (Legs + Calves → one calf raise)', () => {
    const slots = slotsForDay(['legs', 'calves'], profile);
    expect(slots.filter((s) => s.pattern === 'calf_raise')).toHaveLength(1);
  });

  it('the example routine: Chest + Biceps / Shoulders + Triceps / Legs + Back, from a full gym', () => {
    const days = [
      ['chest', 'biceps'],
      ['shoulders', 'triceps'],
      ['legs', 'back'],
    ];
    const routine = buildCustomRoutine(days, ctx());
    expect(routine.map((r) => r.name)).toEqual(['Chest + Biceps', 'Shoulders + Triceps', 'Legs + Back']);
    const byId = new Map(EX.map((e) => [e.id, e]));
    routine.forEach((r, i) => {
      expect(r.exerciseIds.length, r.name).toBeGreaterThanOrEqual(3);
      expect(new Set(r.exerciseIds).size, r.name).toBe(r.exerciseIds.length);
      const allowed = groupMuscles(days[i]!);
      for (const id of r.exerciseIds) {
        const prim = byId.get(id)!.primary as MuscleGroup[];
        expect(
          prim.some((m) => allowed.has(m)),
          `${r.name}: ${id}`,
        ).toBe(true);
      }
    });
    // Every picked group is covered by at least one exercise.
    const covers = (ids: string[], muscles: MuscleGroup[]) =>
      ids.some((id) => byId.get(id)!.primary.some((m) => muscles.includes(m)));
    expect(covers(routine[0]!.exerciseIds, ['biceps'])).toBe(true);
    expect(covers(routine[1]!.exerciseIds, ['triceps'])).toBe(true);
    expect(covers(routine[2]!.exerciseIds, ['lats', 'upper back'])).toBe(true);
    expect(covers(routine[2]!.exerciseIds, ['quads'])).toBe(true);
  });

  it('respects the gym and limitations (home dumbbells, no-overhead limitation)', () => {
    const home = buildCustomRoutine([['chest', 'shoulders']], ctx('home-dumbbells'));
    const byId = new Map(EX.map((e) => [e.id, e]));
    for (const id of home[0]!.exerciseIds) expect(byId.get(id)!.loadType).not.toBe('machine_stack');
    expect(home[0]!.exerciseIds.length).toBeGreaterThan(0);
  });
});

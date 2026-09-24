import { describe, expect, it } from 'vitest';
import exercisesJson from '@/data/exercises.json';
import { coverage, fillGaps, fixFor, lightestSession } from './coverage';
import { sessionsFor } from './split';
import { presetGym, suggestRoutine } from './suggest';
import type { Exercise } from './types';

const EX = exercisesJson as Exercise[];
const map = new Map(EX.map((e) => [e.id, e]));
const profile = {
  experience: 'intermediate' as const,
  goal: 'build_muscle' as const,
  nudge: 0 as const,
  daysPerWeek: 4,
  limitations: [] as string[],
};

describe('coverage (FR-RTN-3, §6.5)', () => {
  it('§6.5: primary sets × 1, secondary × 0.5', () => {
    // Lat pulldown: 3 sets, primary lats; incline DB press: 3 sets, primary chest.
    const c = coverage([['lat-pulldown', 'incline-dumbbell-press']], map, { ...profile, daysPerWeek: 1 });
    const get = (m: string) => c.find((x) => x.muscle === m)!;
    expect(get('lats').sets).toBe(3);
    expect(get('chest').sets).toBe(3);
    const secondaryOfPulldown = map.get('lat-pulldown')!.secondary[0]!;
    expect(get(secondaryOfPulldown).sets).toBeGreaterThanOrEqual(1.5);
    expect(get('calves').sets).toBe(0);
    expect(c).toHaveLength(13);
  });

  it('D50: a rotation is scaled to days per week', () => {
    const one = coverage([['lat-pulldown'], ['back-squat']], map, { ...profile, daysPerWeek: 2 });
    const four = coverage([['lat-pulldown'], ['back-squat']], map, { ...profile, daysPerWeek: 4 });
    expect(four.find((x) => x.muscle === 'lats')!.sets).toBe(2 * one.find((x) => x.muscle === 'lats')!.sets);
    expect(coverage([], map, profile).every((x) => x.sets === 0)).toBe(true);
  });

  it('FR-RTN-3: groups below the band are flagged against the level and goal target', () => {
    const c = coverage([['lat-pulldown']], map, { ...profile, daysPerWeek: 1 });
    const lats = c.find((x) => x.muscle === 'lats')!;
    expect(lats.target).toEqual([10, 16]);
    expect(lats.gap).toBe(true);
    const r = suggestRoutine(sessionsFor('upper-lower', 4), {
      exercises: EX,
      gym: presetGym('full-gym'),
      profile,
    });
    const full = coverage(
      r.map((s) => s.exerciseIds),
      map,
      profile,
    );
    // A suggested upper/lower routine covers the big groups.
    for (const m of ['chest', 'lats', 'quads', 'hamstrings'])
      expect(full.find((x) => x.muscle === m)!.sets).toBeGreaterThanOrEqual(6);
  });

  it('FR-RTN-3: "+ Fix" adds the best exercise for the muscle to the lightest session', () => {
    const sessions = [['back-squat', 'romanian-deadlift', 'leg-press'], ['lat-pulldown']];
    expect(lightestSession(sessions, map, profile)).toBe(1);
    const fix = fixFor('calves', sessions, { exercises: EX, gym: presetGym('full-gym'), profile })!;
    expect(fix.sessionIndex).toBe(1);
    expect(map.get(fix.exerciseId)!.primary).toContain('calves');
    expect(fix.exerciseId).toBe('standing-calf-raise');
  });

  it('D51: fillGaps closes gaps without pushing a session over sessionMinutesTarget', () => {
    const ctx = { exercises: EX, gym: presetGym('full-gym'), profile };
    const base = suggestRoutine(sessionsFor('upper-lower', 4), ctx).map((s) => s.exerciseIds);
    const before = coverage(base, map, profile).filter((c) => c.gap).length;
    const filled = fillGaps(base, ctx);
    const after = coverage(filled, map, profile).filter((c) => c.gap).length;
    expect(after).toBeLessThan(before);
    for (const s of filled) {
      const sec = s.reduce((t, id) => t + (map.get(id)!.role === 'compound' ? 9 : 6) * 60, 0);
      expect(sec).toBeLessThanOrEqual(60 * 60);
    }
    expect(fillGaps([], ctx)).toEqual([]);
  });

  it('"+ Fix" respects the gym and limitations, and returns null with nothing to add', () => {
    const home = presetGym('home-dumbbells');
    const fix = fixFor('hamstrings', [['goblet-squat']], { exercises: EX, gym: home, profile })!;
    const ex = map.get(fix.exerciseId)!;
    expect(ex.requires.every((g) => g.some((id) => home.equipmentIds.includes(id)))).toBe(true);
    expect(fixFor('calves', [], { exercises: EX, gym: home, profile })).toBeNull();
    expect(fixFor('calves', [['x']], { exercises: [], gym: home, profile })).toBeNull();
  });
});

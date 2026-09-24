import { describe, expect, it } from 'vitest';
import exercisesJson from '@/data/exercises.json';
import { sessionsFor } from './split';
import {
  candidatesFor,
  eligible,
  isAvailable,
  isLimited,
  presetGym,
  sessionMinutes,
  slotScore,
  STAPLES,
  suggestRoutine,
  swapAlternatives,
} from './suggest';
import type { Exercise } from './types';
import { INTENSITY } from './data';

const EX = exercisesJson as Exercise[];
const byId = new Map(EX.map((e) => [e.id, e]));
const profile = {
  experience: 'intermediate' as const,
  goal: 'build_muscle' as const,
  nudge: 0 as const,
  limitations: [] as string[],
};

describe('auto-suggest (FR-RTN-1, FR-GYM-5, S23)', () => {
  it('every staple id exists in the seeded library', () => {
    for (const ids of Object.values(STAPLES)) for (const id of ids!) expect(byId.has(id), id).toBe(true);
  });

  it('presets expand from equipment.json', () => {
    const full = presetGym('full-gym');
    expect(full.equipmentIds).toContain('barbell');
    expect(full.machineIds.length).toBeGreaterThan(30);
    expect(presetGym('home-dumbbells')).toEqual({
      equipmentIds: ['dumbbells', 'adjustable-bench', 'pullup-bar', 'resistance-bands'],
      machineIds: [],
    });
    expect(presetGym('nope').machineIds.length).toBeGreaterThan(30);
  });

  it('FR-LIB-5: availability needs every requirement group', () => {
    const idp = byId.get('incline-dumbbell-press')!;
    expect(isAvailable(idp, { equipmentIds: ['dumbbells', 'adjustable-bench'], machineIds: [] })).toBe(true);
    expect(isAvailable(idp, { equipmentIds: ['dumbbells'], machineIds: [] })).toBe(false);
    expect(
      isAvailable(byId.get('cable-fly')!, { equipmentIds: [], machineIds: ['functional-trainer'] }),
    ).toBe(true);
  });

  it('FR-GYM-5: limitation areas exclude exercises', () => {
    expect(isLimited(byId.get('back-squat')!, ['knees'])).toBe(true);
    expect(isLimited(byId.get('lat-pulldown')!, ['knees'])).toBe(false);
  });

  it('FR-RTN-1: upper/lower on a full gym picks sensible staples, compounds first', () => {
    const r = suggestRoutine(sessionsFor('upper-lower', 4), {
      exercises: EX,
      gym: presetGym('full-gym'),
      profile,
    });
    expect(r.map((s) => s.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B']);
    const upperA = r[0]!.exerciseIds;
    expect(upperA[0]).toBe('lat-pulldown');
    expect(upperA[1]).toBe('incline-dumbbell-press');
    const roles = upperA.map((id) => byId.get(id)!.role);
    expect(roles.indexOf('isolation')).toBeGreaterThan(roles.lastIndexOf('compound'));
    expect(r[1]!.exerciseIds[0]).toBe('back-squat');
    // Variety: Upper B's vertical pull differs from Upper A's.
    expect(r[2]!.exerciseIds).not.toContain('lat-pulldown');
  });

  it('FR-RTN-1: suggestions only use equipment you have (M2 phone check 1)', () => {
    const gym = presetGym('home-dumbbells');
    const r = suggestRoutine(sessionsFor('full-body', 3), { exercises: EX, gym, profile });
    for (const s of r) for (const id of s.exerciseIds) expect(isAvailable(byId.get(id)!, gym), id).toBe(true);
    expect(r.every((s) => s.exerciseIds.length >= 3)).toBe(true);
  });

  it('FR-GYM-5: limitations are respected by suggestions', () => {
    const r = suggestRoutine(sessionsFor('upper-lower', 4), {
      exercises: EX,
      gym: presetGym('full-gym'),
      profile: { ...profile, limitations: ['knees', 'lower back'] },
    });
    for (const s of r)
      for (const id of s.exerciseIds) expect(byId.get(id)!.limitationAreas).not.toContain('knees');
  });

  it('FR-RTN-1: sessions are sized to sessionMinutesTarget', () => {
    const adv = { ...profile, experience: 'advanced' as const, nudge: 1 as const };
    const r = suggestRoutine(sessionsFor('ppl', 6), {
      exercises: EX,
      gym: presetGym('full-gym'),
      profile: adv,
    });
    for (const s of r) {
      const exs = s.exerciseIds.map((id) => byId.get(id)!);
      expect(exs.length === 3 || sessionMinutes(exs, adv) <= INTENSITY.sessionMinutesTarget, s.name).toBe(
        true,
      );
    }
    // sixDayNote: second pass swaps the first compound.
    expect(r[3]!.exerciseIds[0]).not.toBe(r[0]!.exerciseIds[0]);
  });

  it('build-your-own sessions stay empty', () => {
    expect(
      suggestRoutine(sessionsFor('custom', 2), { exercises: EX, gym: presetGym('full-gym'), profile }),
    ).toEqual([
      { name: 'Day A', exerciseIds: [] },
      { name: 'Day B', exerciseIds: [] },
    ]);
  });

  it('scoring prefers primary muscle, role and level fit', () => {
    const slot = { pattern: 'vertical_pull' as const, role: 'compound' as const, muscle: 'lats' as const };
    expect(slotScore(byId.get('lat-pulldown')!, slot, 'beginner')).toBeGreaterThan(
      slotScore(byId.get('pull-up')!, slot, 'beginner'),
    );
    expect(slotScore(byId.get('bench-press')!, slot, 'beginner')).toBe(0);
    expect(slotScore(byId.get('lat-pulldown')!, { ...slot, muscle: 'calves' }, 'beginner')).toBe(0);
    const pool = eligible({ exercises: EX, gym: presetGym('full-gym'), profile });
    expect(candidatesFor(slot, pool, 'intermediate', new Set(['lat-pulldown']))[0]!.id).toBe('pull-up');
  });

  it('S23: up to 6 alternatives, same muscle and pattern, compounds first, then last used', () => {
    const cur = byId.get('lat-pulldown')!;
    const ctx = { exercises: EX, gym: presetGym('full-gym'), profile };
    const alts = swapAlternatives(cur, ctx);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(6);
    for (const a of alts) {
      expect(a.pattern).toBe('vertical_pull');
      expect(a.primary).toContain('lats');
      expect(a.id).not.toBe('lat-pulldown');
    }
    const lastUsed = new Map([['close-grip-pulldown', 1000]]);
    expect(swapAlternatives(cur, ctx, lastUsed)[0]!.id).toBe('close-grip-pulldown');
  });
});

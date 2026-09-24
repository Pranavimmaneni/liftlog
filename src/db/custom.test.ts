import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { db } from './schema';
import { getExerciseMap } from './catalog';
import {
  defaultIncrement,
  deleteCustomExercise,
  saveCustomExercise,
  validateCustom,
  type CustomInput,
} from './custom';
import { getDeload } from './deload';
import { startOfWeek } from '@/engine/week';
import type { Exercise } from '@/engine/types';

const INPUT: CustomInput = {
  name: 'Landmine Press',
  primary: 'chest',
  secondary: ['shoulders', 'chest'],
  gear: 'barbell',
  machine: false,
  loadType: 'plate_loaded',
  role: 'compound',
  unilateral: true,
  incrementKg: 2.5,
  notes: '  Use the corner of the rack. ',
};
const ex = (id: string, name: string, deleted = false) => ({ id, name, deleted }) as Exercise;

describe('custom exercises (FR-LIB-6)', () => {
  beforeEach(resetDb);

  it('validateCustom: name required and unique ignoring case and punctuation', () => {
    const lib = [ex('barbell-curl', 'Barbell Curl'), ex('old', 'Old Move', true)];
    expect(validateCustom({ ...INPUT, name: '  ' }, lib)).toEqual({ name: 'required' });
    expect(validateCustom({ ...INPUT, name: 'barbell-curl!' }, lib)).toEqual({ name: 'taken' });
    // Editing the same exercise, or reusing a deleted name, is fine.
    expect(validateCustom({ ...INPUT, name: 'Barbell Curl' }, lib, 'barbell-curl')).toEqual({});
    expect(validateCustom({ ...INPUT, name: 'Old Move' }, lib)).toEqual({});
    expect(validateCustom({ ...INPUT, primary: null, loadType: null }, lib)).toEqual({
      primary: 'required',
      loadType: 'required',
    });
  });

  it('defaultIncrement follows load-types.json', () => {
    expect(defaultIncrement('barbell')).toBeGreaterThan(0);
    expect(defaultIncrement('bodyweight')).toBe(0);
  });

  it('saves into the catalogue, edits in place, and delete keeps logged history', async () => {
    await seedOnboarded();
    const id = await saveCustomExercise(INPUT);
    expect(id).toMatch(/^custom-landmine-press-/);
    let map = await getExerciseMap();
    const e = map.get(id)!;
    expect(e).toMatchObject({
      name: 'Landmine Press',
      isCustom: true,
      equipment: 'Barbell',
      notes: 'Use the corner of the rack.',
    });
    // Primary is not repeated as secondary.
    expect(e.secondary).toEqual(['shoulders']);
    expect(e.requires).toEqual([['barbell']]);

    await saveCustomExercise({ ...INPUT, name: 'Landmine Press 1-arm', notes: '' }, id);
    map = await getExerciseMap();
    expect(map.get(id)!.name).toBe('Landmine Press 1-arm');
    expect(map.get(id)!.notes).toBeUndefined();

    // Put it in the routine and log it once.
    const r = (await db.routines.where('active').equals(1).first())!;
    const withIt = r.sessions.map((s, i) =>
      i === 0 ? { ...s, items: [...s.items, { exerciseId: id, order: s.items.length }] } : s,
    );
    await db.routines.put({ ...r, sessions: withIt });
    await seedSession({ routineSession: withIt[0]!, startedAt: Date.now() - 86_400_000 });
    const logged = await db.sets.where('exerciseId').equals(id).count();
    expect(logged).toBe(3);

    await deleteCustomExercise(id);
    const after = (await db.routines.where('active').equals(1).first())!;
    expect(after.sessions[0]!.items.some((i) => i.exerciseId === id)).toBe(false);
    expect(after.sessions[0]!.items.map((i) => i.order)).toEqual(after.sessions[0]!.items.map((_, k) => k));
    expect((await getExerciseMap()).get(id)!.deleted).toBe(true);
    expect(await db.sets.where('exerciseId').equals(id).count()).toBe(3);
  });

  it('machine gear sets machineId and uses the machine name', async () => {
    const id = await saveCustomExercise({
      ...INPUT,
      gear: 'lat-pulldown',
      machine: true,
      loadType: 'machine_stack',
    });
    const e = (await getExerciseMap()).get(id)!;
    expect(e.machineId).toBe('lat-pulldown');
    expect(e.equipment).toMatch(/pulldown/i);
  });
});

describe('getDeload (FR-PRG-7)', () => {
  beforeEach(resetDb);
  const DAY = 86_400_000;

  it('is nothing before any session is finished', async () => {
    await seedOnboarded();
    expect(await getDeload()).toMatchObject({ thisWeek: false, nextWeek: false, reason: null, week: 1 });
  });

  it('announces the scheduled deload the week before and runs it in week 7 (intermediate)', async () => {
    const sessions = await seedOnboarded();
    const now = Date.now();
    const anchor = startOfWeek(now, 1) - 42 * DAY + 3_600_000;
    await seedSession({ routineSession: sessions[0]!, startedAt: anchor });
    expect(await getDeload(now)).toMatchObject({ week: 7, thisWeek: true, reason: 'scheduled' });
    expect(await getDeload(now - 7 * DAY)).toMatchObject({ week: 6, nextWeek: true, reason: 'scheduled' });
    expect(await getDeload(now - 14 * DAY)).toMatchObject({ week: 5, thisWeek: false, nextWeek: false });
  });

  it('beginners have no scheduled deload', async () => {
    const sessions = await seedOnboarded({ experience: 'beginner' });
    await seedSession({
      routineSession: sessions[0]!,
      startedAt: startOfWeek(Date.now(), 1) - 42 * DAY + 3_600_000,
    });
    expect(await getDeload()).toMatchObject({ thisWeek: false, reason: null });
  });
});

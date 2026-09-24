import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from './schema';
import {
  addCustomMachine,
  deleteCustomMachine,
  deleteMachineSetting,
  machineInfo,
  setMachineIncrement,
  setMachinePhoto,
  setMachineSetting,
} from './machines';
import { getExerciseMap } from './catalog';
import { fitWithin } from '@/app/image';

describe('My Gym machines (FR-GYM-2, FR-GYM-4)', () => {
  beforeEach(resetDb);

  it('FR-GYM-2: photo, named settings and increment are stored per machine', async () => {
    await setMachineSetting('lat-pulldown', 'Seat', '4');
    await setMachineSetting('lat-pulldown', 'Thigh pad', '2');
    await setMachineSetting('lat-pulldown', 'Pad', '3', 'Thigh pad');
    await setMachinePhoto('lat-pulldown', new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' }));
    let n = await db.machineNotes.get('lat-pulldown');
    expect(n!.settings).toEqual({ Seat: '4', Pad: '3' });
    expect(n!.photoBlob).toBeTruthy();
    expect(n!.updatedAt).toBeGreaterThan(0);
    await deleteMachineSetting('lat-pulldown', 'Pad');
    await setMachinePhoto('lat-pulldown', undefined);
    n = await db.machineNotes.get('lat-pulldown');
    expect(n!.settings).toEqual({ Seat: '4' });
    expect(n!.photoBlob).toBeUndefined();
  });

  it('FR-GOAL-3 / FR-GYM-2: a machine increment overrides the exercise increment', async () => {
    expect((await getExerciseMap()).get('lat-pulldown')!.incrementKg).toBe(5);
    await setMachineIncrement('lat-pulldown', 2.5);
    expect((await getExerciseMap()).get('lat-pulldown')!.incrementKg).toBe(2.5);
    await setMachineIncrement('lat-pulldown', undefined);
    expect((await getExerciseMap()).get('lat-pulldown')!.incrementKg).toBe(5);
  });

  it('FR-GYM-4: custom machines join My Gym and can be removed', async () => {
    await seedOnboarded();
    const id = await addCustomMachine({
      name: 'Viking press',
      category: 'plate_loaded',
      loadType: 'plate_loaded',
      incrementKg: 5,
    });
    expect((await db.gym.get('me'))!.machineIds).toContain(id);
    const note = await db.machineNotes.get(id);
    expect(machineInfo(id, note)).toMatchObject({
      name: 'Viking press',
      loadType: 'plate_loaded',
      defaultIncrementKg: 5,
    });
    expect(machineInfo('lat-pulldown')!.name).toBe('Lat pulldown');
    expect(machineInfo('nope')).toBeUndefined();
    await deleteCustomMachine(id);
    expect((await db.gym.get('me'))!.machineIds).not.toContain(id);
    expect(await db.machineNotes.get(id)).toBeUndefined();
  });

  it('FR-GYM-2: photos are fitted to an 800 px long edge, never upscaled', () => {
    expect(fitWithin(4032, 3024)).toEqual({ w: 800, h: 600 });
    expect(fitWithin(3024, 4032)).toEqual({ w: 600, h: 800 });
    expect(fitWithin(400, 300)).toEqual({ w: 400, h: 300 });
  });
});

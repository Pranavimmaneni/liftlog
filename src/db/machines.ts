import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './schema';
import { uid } from './ids';
import type { MachineNoteRow } from './types';
import { MACHINES, type MachineData } from '@/engine/data';
import type { LoadType } from '@/engine/types';

/** FR-GYM-2: per-machine photo, named settings and increment. */
export function useMachineNote(machineId: string | undefined): MachineNoteRow | null | undefined {
  return useLiveQuery(
    async () => (machineId ? ((await db.machineNotes.get(machineId)) ?? null) : null),
    [machineId],
  );
}

async function patchNote(machineId: string, patch: Partial<MachineNoteRow>): Promise<void> {
  await db.transaction('rw', db.machineNotes, async () => {
    const cur = (await db.machineNotes.get(machineId)) ?? { machineId, settings: {} };
    await db.machineNotes.put({ ...cur, ...patch, machineId, updatedAt: Date.now() });
  });
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

export async function setMachinePhoto(machineId: string, photo: Blob | undefined): Promise<void> {
  try {
    await patchNote(machineId, { photoBlob: photo, photoDataUrl: undefined });
  } catch (e) {
    // D52: private/ephemeral WebKit can't store Blobs in IndexedDB; keep the photo as a data URL.
    if (!photo) throw e;
    await patchNote(machineId, { photoBlob: undefined, photoDataUrl: await blobToDataUrl(photo) });
  }
}

export async function setMachineSetting(
  machineId: string,
  key: string,
  value: string,
  oldKey?: string,
): Promise<void> {
  const cur = await db.machineNotes.get(machineId);
  const settings = { ...(cur?.settings ?? {}) };
  if (oldKey && oldKey !== key) delete settings[oldKey];
  if (key.trim()) settings[key.trim()] = value.trim();
  await patchNote(machineId, { settings });
}

export async function deleteMachineSetting(machineId: string, key: string): Promise<void> {
  const cur = await db.machineNotes.get(machineId);
  const settings = { ...(cur?.settings ?? {}) };
  delete settings[key];
  await patchNote(machineId, { settings });
}

/** FR-GYM-2 increment override; FR-GOAL-3 uses it through the catalogue merge. */
export async function setMachineIncrement(machineId: string, incrementKg: number | undefined): Promise<void> {
  await patchNote(machineId, { incrementKg });
}

export interface CustomMachineInput {
  name: string;
  category: string;
  loadType: LoadType;
  incrementKg: number;
}

/** FR-GYM-4: a custom machine lives in machineNotes and is added to My Gym. */
export async function addCustomMachine(input: CustomMachineInput): Promise<string> {
  const machineId = `custom-${uid().slice(0, 8)}`;
  await db.transaction('rw', db.machineNotes, db.gym, async () => {
    await db.machineNotes.put({
      machineId,
      settings: {},
      custom: { ...input },
      incrementKg: input.incrementKg,
      updatedAt: Date.now(),
    });
    const gym = await db.gym.get('me');
    if (gym) await db.gym.put({ ...gym, machineIds: [...gym.machineIds, machineId] });
  });
  return machineId;
}

export async function deleteCustomMachine(machineId: string): Promise<void> {
  await db.transaction('rw', db.machineNotes, db.gym, async () => {
    await db.machineNotes.delete(machineId);
    const gym = await db.gym.get('me');
    if (gym) await db.gym.put({ ...gym, machineIds: gym.machineIds.filter((m) => m !== machineId) });
  });
}

export function useCustomMachines(): MachineNoteRow[] | undefined {
  return useLiveQuery(async () => (await db.machineNotes.toArray()).filter((n) => !!n.custom), []);
}

/** A machine by id: from machines.json or a custom one. */
export function machineInfo(
  machineId: string,
  note?: MachineNoteRow | null,
): Pick<MachineData, 'id' | 'name' | 'loadType' | 'defaultIncrementKg'> | undefined {
  const m = MACHINES.find((x) => x.id === machineId);
  if (m) return m;
  if (note?.custom)
    return {
      id: machineId,
      name: note.custom.name,
      loadType: note.custom.loadType,
      defaultIncrementKg: note.custom.incrementKg,
    };
  return undefined;
}

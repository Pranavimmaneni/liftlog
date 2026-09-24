/** Profile, gym, onboarding draft, routines, queue and weigh-ins (PRD §7). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './schema';
import { uid } from './ids';
import { setSetting } from './settings';
import type { BodyweightRow, GymRow, ProfileRow, QueueRow, RoutineRow, RoutineSession } from './types';
import { prescribe } from '@/engine/prescription';
import { advance, skipTo, upNext as engineUpNext } from '@/engine/rotation';
import type { Experience, GoalKind, Units } from '@/engine/types';

// ---------- profile & gym ----------

export function useProfile(): ProfileRow | null | undefined {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export async function getProfile(): Promise<ProfileRow | undefined> {
  return db.profile.get('me');
}

/** FR-SET-4: profile changes regenerate future goals (derived) and never rewrite history. */
export async function saveProfile(patch: Partial<Omit<ProfileRow, 'id'>>): Promise<void> {
  // Atomic partial update: quick successive taps must not overwrite each other.
  const n = await db.profile.update('me', patch);
  if (!n && !(await db.profile.get('me'))) throw new Error('no profile');
}

export function useGym(): GymRow | null | undefined {
  return useLiveQuery(async () => (await db.gym.get('me')) ?? null, []);
}

export async function saveGym(g: Omit<GymRow, 'id'>): Promise<void> {
  await db.gym.put({ ...g, id: 'me' });
}

// ---------- onboarding (FR-ONB-1, FR-ONB-5: resume where the user stopped) ----------

export interface OnboardingDraft {
  experience: Experience;
  goal: GoalKind;
  daysPerWeek: number;
  nudge: -1 | 0 | 1;
  presetId: string;
  equipmentIds: string[];
  machineIds: string[];
  limitations: string[];
  units: Units;
  splitId?: string;
  /** Routine being edited on S04 before saving. */
  routine?: { splitId: string; sessions: RoutineSession[] };
}

export type OnboardingStep = 'about' | 'gym' | 'split' | 'routine' | 'done';

export async function getOnboarding(): Promise<{ step: OnboardingStep; draft: OnboardingDraft | null }> {
  const [step, draft] = await Promise.all([db.meta.get('onboardingStep'), db.meta.get('onboardingDraft')]);
  return {
    step: (step?.value as OnboardingStep | undefined) ?? 'about',
    draft: (draft?.value as OnboardingDraft | undefined) ?? null,
  };
}

export function useOnboarding() {
  return useLiveQuery(getOnboarding, []);
}

export async function saveDraft(draft: OnboardingDraft, step: OnboardingStep): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ key: 'onboardingDraft', value: draft });
    await db.meta.put({ key: 'onboardingStep', value: step });
  });
}

/**
 * FR-ONB-5: writes profile, gym, rest defaults from intensity.json, the routine and its queue,
 * then marks onboarding done. Sex, age and bodyweight are not asked here (FR-ONB-6).
 */
export async function completeOnboarding(
  d: OnboardingDraft,
  routine: { splitId: string; sessions: RoutineSession[] },
): Promise<void> {
  const p = { experience: d.experience, goal: d.goal, nudge: d.nudge };
  const restCompound = prescribe(p, 'compound').restSec;
  const restIsolation = prescribe(p, 'isolation').restSec;
  await db.transaction('rw', [db.profile, db.gym, db.routines, db.queue, db.meta, db.settings], async () => {
    const existing = await db.profile.get('me');
    await db.profile.put({
      id: 'me',
      experience: d.experience,
      goal: d.goal,
      daysPerWeek: d.daysPerWeek,
      nudge: d.nudge,
      units: d.units,
      limitations: d.limitations,
      sex: existing?.sex,
      birthYear: existing?.birthYear,
    });
    await db.gym.put({
      id: 'me',
      presetId: d.presetId,
      equipmentIds: d.equipmentIds,
      machineIds: d.machineIds,
    });
    await saveRoutineInTx(routine);
    await db.meta.put({ key: 'onboardingStep', value: 'done' });
    await db.meta.delete('onboardingDraft');
    await setSetting('restCompoundSec', restCompound);
    await setSetting('restIsolationSec', restIsolation);
  });
}

// ---------- routines & queue (FR-RTN-4, FR-RTN-6) ----------

export function useActiveRoutine(): RoutineRow | null | undefined {
  return useLiveQuery(async () => (await db.routines.where('active').equals(1).first()) ?? null, []);
}

export async function getActiveRoutine(): Promise<RoutineRow | undefined> {
  return db.routines.where('active').equals(1).first();
}

export function useQueue(): QueueRow | null | undefined {
  return useLiveQuery(async () => (await db.queue.get('me')) ?? null, []);
}

async function saveRoutineInTx(r: { splitId: string; sessions: RoutineSession[] }): Promise<RoutineRow> {
  // FR-RTN-6: changing the split archives the old routine; history stays untouched.
  const now = Date.now();
  const actives = await db.routines.where('active').equals(1).toArray();
  for (const a of actives) await db.routines.put({ ...a, active: 0, archivedAt: now });
  const row: RoutineRow = { id: uid(), splitId: r.splitId, active: 1, createdAt: now, sessions: r.sessions };
  await db.routines.put(row);
  await db.queue.put({ id: 'me', routineId: row.id, nextSessionIndex: 0 });
  return row;
}

/** A new routine (new split): archives the old one and restarts the queue. */
export async function replaceRoutine(r: {
  splitId: string;
  sessions: RoutineSession[];
}): Promise<RoutineRow> {
  return db.transaction('rw', [db.routines, db.queue], () => saveRoutineInTx(r));
}

/** Edits to the active routine's sessions (S04 / S15), keeping the queue position. */
export async function updateRoutineSessions(routineId: string, sessions: RoutineSession[]): Promise<void> {
  const r = await db.routines.get(routineId);
  if (!r) return;
  await db.routines.put({ ...r, sessions });
}

export function newRoutineSession(name: string, exerciseIds: string[]): RoutineSession {
  return { id: uid(), name, items: exerciseIds.map((exerciseId, order) => ({ exerciseId, order })) };
}

export async function advanceQueue(routine: RoutineRow, completedRoutineSessionId: string): Promise<void> {
  const q = await db.queue.get('me');
  if (!q || q.routineId !== routine.id) return;
  const next = advance(routine, q, completedRoutineSessionId);
  await db.queue.put({ ...q, ...next });
}

export async function skipQueueTo(routine: RoutineRow, position: number): Promise<void> {
  const q = await db.queue.get('me');
  if (!q) return;
  await db.queue.put({ ...q, ...skipTo(routine, q, position) });
}

export async function setQueueOrder(order: number[], nextSessionIndex: number): Promise<void> {
  const q = await db.queue.get('me');
  if (!q) return;
  await db.queue.put({ ...q, order, nextSessionIndex });
}

export function upNextOf(routine: RoutineRow | null | undefined, queue: QueueRow | null | undefined) {
  if (!routine || !queue || queue.routineId !== routine.id)
    return routine ? engineUpNext(routine, { nextSessionIndex: 0 }) : null;
  return engineUpNext(routine, queue);
}

// ---------- weigh-ins (S20) ----------

export function useBodyweights(): BodyweightRow[] | undefined {
  return useLiveQuery(() => db.bodyweights.orderBy('date').toArray(), []);
}

/** One weigh-in per date: saving the same date replaces it. */
export async function saveWeighIn(date: string, kg: number): Promise<void> {
  await db.transaction('rw', db.bodyweights, async () => {
    const same = await db.bodyweights.where('date').equals(date).primaryKeys();
    await db.bodyweights.bulkDelete(same);
    await db.bodyweights.add({ date, kg: Math.round(kg * 100) / 100 });
  });
}

export async function deleteWeighIn(id: number): Promise<void> {
  await db.bodyweights.delete(id);
}

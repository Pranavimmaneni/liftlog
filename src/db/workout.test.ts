import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { db } from './schema';
import {
  addToSession,
  autoFinishStale,
  cancelSession,
  AUTO_FINISH_MS,
  deleteSet,
  discardSession,
  finishSession,
  getActiveSession,
  historyFor,
  logSet,
  rebuildPrs,
  setEffort,
  setHurts,
  setOverride,
  startSession,
  swapInSession,
  updateSet,
} from './workout';
import { buildCsv } from './csv';
import {
  deleteWeighIn,
  getOnboarding,
  getProfile,
  newRoutineSession,
  replaceRoutine,
  saveDraft,
  saveProfile,
  saveWeighIn,
  setQueueOrder,
  skipQueueTo,
  upNextOf,
} from './repo';
import { buildSessionModel, loadSessionRaw, nextSetFor } from '@/app/session-model';
import { getExerciseMap } from './catalog';
import type { SetRow } from './types';
import { TEST_DRAFT } from '@/test/seed';

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 1, 9).getTime();

describe('workout lifecycle (FR-WRK-1/10/11/12/13, FR-RTN-4)', () => {
  beforeEach(resetDb);

  it('FR-WRK-1 / FR-WRK-13: start creates the session; every set is stored immediately; resume returns it', async () => {
    const sessions = await seedOnboarded();
    const s = await startSession({
      routineSessionId: sessions[0]!.id,
      name: 'Upper A',
      exerciseIds: ['lat-pulldown'],
      now: T0,
    });
    await logSet({
      sessionId: s.id,
      exerciseId: 'lat-pulldown',
      idx: 1,
      kind: 'work',
      loadKg: 50,
      reps: 10,
      goalMet: true,
      bonusReps: 0,
      now: T0 + 1000,
    });
    expect(await db.sets.count()).toBe(1);
    expect((await db.sessions.get(s.id))!.lastActivityAt).toBe(T0 + 1000);
    const again = await startSession({
      routineSessionId: 'other',
      name: 'x',
      exerciseIds: [],
      now: T0 + 2000,
    });
    expect(again.id).toBe(s.id);
    expect((await getActiveSession())!.id).toBe(s.id);
  });

  it('FR-WRK-10: unplanned exercises are added once; swaps replace in the plan', async () => {
    const s = await startSession({
      routineSessionId: 'r',
      name: 'x',
      exerciseIds: ['lat-pulldown'],
      now: T0,
    });
    await addToSession(s.id, 'face-pull');
    await addToSession(s.id, 'face-pull');
    await swapInSession(s.id, 'lat-pulldown', 'pull-up');
    expect((await db.sessions.get(s.id))!.plan).toEqual([
      { exerciseId: 'pull-up', planned: true },
      { exerciseId: 'face-pull', planned: false },
    ]);
  });

  it('FR-WRK-12: finishing with 0 work sets discards the session', async () => {
    const s = await startSession({
      routineSessionId: 'r',
      name: 'x',
      exerciseIds: ['lat-pulldown'],
      now: T0,
    });
    await logSet({
      sessionId: s.id,
      exerciseId: 'lat-pulldown',
      idx: 1,
      kind: 'warmup',
      loadKg: 20,
      reps: 8,
      goalMet: false,
      bonusReps: 0,
    });
    expect(await finishSession(s.id)).toEqual({ status: 'discarded' });
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
    expect(await finishSession('missing')).toEqual({ status: 'discarded' });
  });

  it('FR-WRK-16: cancelling deletes the session and its sets, keeps the queue and earlier PRs', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 - 86_400_000, loadKg: 50 });
    const queueBefore = await db.queue.get('me');
    const prsBefore = await db.prs.toArray();
    const s = await startSession({
      routineSessionId: sessions[1]!.id,
      name: sessions[1]!.name,
      exerciseIds: sessions[1]!.items.map((i) => i.exerciseId),
      now: T0,
    });
    await logSet({
      sessionId: s.id,
      exerciseId: sessions[1]!.items[0]!.exerciseId,
      idx: 1,
      kind: 'work',
      loadKg: 200,
      reps: 10,
      goalMet: true,
      bonusReps: 0,
      now: T0 + 1000,
    });
    await cancelSession(s.id);
    expect(await getActiveSession()).toBeUndefined();
    expect(await db.sessions.get(s.id)).toBeUndefined();
    expect(await db.sets.where('sessionId').equals(s.id).count()).toBe(0);
    expect(await db.queue.get('me')).toEqual(queueBefore);
    expect(await db.prs.toArray()).toEqual(prsBefore);
  });

  it('FR-WRK-12: a session idle for 3 h auto-finishes at its last activity', async () => {
    const sessions = await seedOnboarded();
    const s = await startSession({
      routineSessionId: sessions[0]!.id,
      name: 'Upper A',
      exerciseIds: ['lat-pulldown'],
      now: T0,
    });
    await logSet({
      sessionId: s.id,
      exerciseId: 'lat-pulldown',
      idx: 1,
      kind: 'work',
      loadKg: 50,
      reps: 10,
      goalMet: true,
      bonusReps: 0,
      now: T0 + 60_000,
    });
    expect(await autoFinishStale(T0 + 60_000 + AUTO_FINISH_MS - 1)).toBeNull();
    expect(await autoFinishStale(T0 + 60_000 + AUTO_FINISH_MS + 1)).toBe(s.id);
    const row = await db.sessions.get(s.id);
    expect(row).toMatchObject({ endedAt: T0 + 60_000, autoFinished: true });
    expect(await autoFinishStale()).toBeNull();
  });

  it('FR-RTN-4 / D26: finishing advances the rotation and marks first-exposure sessions as calibration', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 });
    const q = await db.queue.get('me');
    expect(q!.nextSessionIndex).toBe(1);
    const first = (await db.sessions.toArray())[0]!;
    expect(first.calibration).toBe(true);
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 + 7 * DAY });
    const second = (await db.sessions.orderBy('startedAt').last())!;
    expect(second.calibration).toBe(false);
  });

  it('FR-PRG-8: goal changes are recorded with a human reason; the goals cache is refreshed', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: T0, loadKg: 50, reps: 10 });
    expect(await db.goalChanges.count()).toBe(0); // calibration isn't a change
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 + 7 * DAY, loadKg: 50, reps: 10 });
    const changes = await db.goalChanges.where('exerciseId').equals('lat-pulldown').toArray();
    expect(changes.length).toBe(1);
    expect(changes[0]!.reason).toMatch(/aim for 12 reps|up/i);
    const g = await db.goals.get('lat-pulldown');
    expect(g!.exposures).toBe(2);
  });

  it('FR-XP-3 / D13 / D14: PRs are rebuilt from the log; the first exposure is not a PR; edits recompute', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: T0, loadKg: 50, reps: 10 });
    expect(await db.prs.count()).toBe(0);
    const s2 = await seedSession({
      routineSession: sessions[0]!,
      startedAt: T0 + 7 * DAY,
      loadKg: 55,
      reps: 10,
    });
    const prs = await db.prs.where('exerciseId').equals('lat-pulldown').toArray();
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ loadKg: 55, reps: 10 });
    // Editing the heavier sets down removes the PR.
    const sets = (await db.sets.where('sessionId').equals(s2).toArray()).filter(
      (x) => x.exerciseId === 'lat-pulldown',
    );
    for (const x of sets) await updateSet(x.id, { loadKg: 40 });
    expect(await db.prs.where('exerciseId').equals('lat-pulldown').count()).toBe(0);
    await deleteSet(sets[0]!.id);
    expect(await db.sets.where('sessionId').equals(s2).count()).toBeGreaterThan(0);
    await rebuildPrs('unknown-exercise');
  });

  it('FR-WRK-6 / FR-PRG-6: effort and hurts flags are stored per set', async () => {
    const s = await startSession({
      routineSessionId: 'r',
      name: 'x',
      exerciseIds: ['lat-pulldown'],
      now: T0,
    });
    const row = await logSet({
      sessionId: s.id,
      exerciseId: 'lat-pulldown',
      idx: 1,
      kind: 'work',
      loadKg: 50,
      reps: 10,
      goalMet: true,
      bonusReps: 0,
    });
    await setEffort(row.id, 'easy');
    await setHurts(row.id, true);
    expect(await db.sets.get(row.id)).toMatchObject({ effort: 'easy', hurts: true });
    await discardSession(s.id);
    expect(await db.sets.count()).toBe(0);
  });

  it('S24: overrides apply once and clear after the next exposure; null resets to coach', async () => {
    const sessions = await seedOnboarded();
    await setOverride('lat-pulldown', { sets: 4, repMin: 6, repMax: 8, loadKg: 60 });
    expect((await db.goals.get('lat-pulldown'))!.override).toMatchObject({ loadKg: 60 });
    expect((await db.goalChanges.toArray())[0]!.overridden).toBe(true);
    await setOverride('lat-pulldown', null);
    expect((await db.goals.get('lat-pulldown'))!.override).toBeUndefined();
    await setOverride('lat-pulldown', { sets: 4, repMin: 6, repMax: 8, loadKg: 60 });
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 });
    expect((await db.goals.get('lat-pulldown'))!.override).toBeUndefined();
  });

  it('history cut-offs keep past sessions scored against their own past', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 });
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 + 7 * DAY });
    expect((await historyFor(['lat-pulldown'])).sessions.size).toBe(2);
    expect((await historyFor(['lat-pulldown'], undefined, T0 + DAY)).sessions.size).toBe(1);
    expect((await historyFor([])).sets).toEqual([]);
  });

  it('session model: meter, current exercise, last exposure and week number', async () => {
    const sessions = await seedOnboarded();
    const first = await seedSession({ routineSession: sessions[0]!, startedAt: T0 });
    const ids = [...sessions[0]!.items].sort((a, b) => a.order - b.order).map((i) => i.exerciseId);
    const routineId = (await db.routines.where('active').equals(1).first())!.id;
    const s = await startSession({
      routineId,
      routineSessionId: sessions[0]!.id,
      name: 'Upper A',
      exerciseIds: ids,
      now: T0 + 14 * DAY,
    });
    await logSet({
      sessionId: s.id,
      exerciseId: ids[0]!,
      idx: 1,
      kind: 'work',
      loadKg: 50,
      reps: 10,
      goalMet: true,
      bonusReps: 0,
      now: T0 + 14 * DAY + 1,
    });
    const raw = await loadSessionRaw(s.id);
    const model = buildSessionModel(raw!, await getExerciseMap());
    expect(model.sessionNumber).toBe(2);
    expect(model.weekNumber).toBe(3);
    expect(model.meter.done).toBe(1);
    expect(model.current!.exercise.id).toBe(ids[0]);
    expect(model.items[0]!.last!.sets).toHaveLength(3);
    expect(model.items[0]!.goal.loadKg).toBe(50);
    expect(await loadSessionRaw('nope')).toBeNull();
    expect(first).toBeTruthy();
  });

  it('FR-WRK-14: next set for unilateral logs Left then Right', () => {
    const r = (idx: number, side?: 'L' | 'R') => ({ idx, side, kind: 'work' }) as SetRow;
    expect(nextSetFor([], false)).toEqual({ idx: 1 });
    expect(nextSetFor([r(1), r(2)], false)).toEqual({ idx: 3 });
    expect(nextSetFor([], true)).toEqual({ idx: 1, side: 'L' });
    expect(nextSetFor([r(1, 'L')], true)).toEqual({ idx: 1, side: 'R' });
    expect(nextSetFor([r(1, 'L'), r(1, 'R')], true)).toEqual({ idx: 2, side: 'L' });
    expect(nextSetFor([r(1, 'R')], true)).toEqual({ idx: 1, side: 'L' });
  });

  it('FR-DATA-5: CSV export has a header and one row per set', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 });
    const csv = await buildCsv();
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('date,exercise,set,load_kg,reps,effort');
    expect(lines.length).toBe(1 + (await db.sets.count()));
    expect(lines[1]).toMatch(/^2026-09-01,Lat Pulldown,1,50,10,$/);
  });
});

describe('repositories', () => {
  beforeEach(resetDb);

  it('FR-ONB-5: the onboarding draft and step persist for resuming', async () => {
    expect(await getOnboarding()).toEqual({ step: 'about', draft: null });
    await saveDraft(TEST_DRAFT, 'gym');
    expect(await getOnboarding()).toEqual({ step: 'gym', draft: TEST_DRAFT });
  });

  it('FR-ONB-5: completing onboarding writes profile, gym, routine, queue and rest defaults', async () => {
    await seedOnboarded({ experience: 'advanced', goal: 'get_stronger' });
    expect(await getProfile()).toMatchObject({ experience: 'advanced', units: 'kg' });
    expect(await db.gym.get('me')).toMatchObject({ presetId: 'full-gym' });
    expect((await db.settings.get('restCompoundSec'))!.value).toBe(180);
    expect((await getOnboarding()).step).toBe('done');
    await saveProfile({ units: 'lb' });
    expect((await getProfile())!.units).toBe('lb');
  });

  it('FR-RTN-6: a new split archives the old routine and restarts the queue; skip-to and order', async () => {
    const first = await seedOnboarded();
    const r2 = await replaceRoutine({
      splitId: 'ppl',
      sessions: [newRoutineSession('Push', ['bench-press']), newRoutineSession('Pull', ['lat-pulldown'])],
    });
    const all = await db.routines.toArray();
    expect(all.filter((r) => r.active === 1)).toHaveLength(1);
    expect(all.find((r) => r.sessions[0]!.id === first[0]!.id)!.archivedAt).toBeDefined();
    await skipQueueTo(r2, 1);
    expect(upNextOf(r2, (await db.queue.get('me'))!)!.session.name).toBe('Pull');
    await setQueueOrder([1, 0], 0);
    expect(upNextOf(r2, (await db.queue.get('me'))!)!.session.name).toBe('Pull');
    expect(upNextOf(r2, null)!.session.name).toBe('Push');
    expect(upNextOf(null, null)).toBeNull();
  });

  it('S20: one weigh-in per date; delete works', async () => {
    await saveWeighIn('2026-09-20', 78.456);
    await saveWeighIn('2026-09-20', 78.2);
    const rows = await db.bodyweights.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kg).toBe(78.2);
    await deleteWeighIn(rows[0]!.id!);
    expect(await db.bodyweights.count()).toBe(0);
  });
});

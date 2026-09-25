import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { db } from './schema';
import { defaultReviewTime, getLiftSeries, getReview, getStrength, periodOf, weeklyBest } from './insight';
import { saveProfile, saveWeighIn } from './repo';
import { deleteSession } from './workout';
import { addDays, dateKey, startOfWeek } from '@/engine/week';

const DAY = 86_400_000;
const NOW = Date.now();
const THIS_WEEK = startOfWeek(NOW, 1);
const LAST_WEEK = addDays(THIS_WEEK, -7);

describe('review read model (FR-REV-1/2/3)', () => {
  beforeEach(resetDb);

  it('periods: week from the week start, month from the 1st; default is last week', () => {
    const [s, e] = periodOf('week', NOW, 1);
    expect(s).toBe(THIS_WEEK);
    expect(e).toBe(addDays(THIS_WEEK, 7));
    const [ms, me] = periodOf('month', NOW, 1);
    expect(new Date(ms).getDate()).toBe(1);
    expect(new Date(me).getMonth()).toBe((new Date(NOW).getMonth() + 1) % 12);
    expect(defaultReviewTime(NOW, 1)).toBe(LAST_WEEK);
  });

  it('counts sessions, goal sets and PRs for the week and picks the insights', async () => {
    const sessions = await seedOnboarded();
    // Two sessions last week, the second heavier (PRs), none this week.
    await seedSession({ routineSession: sessions[0]!, startedAt: LAST_WEEK + DAY, loadKg: 50, reps: 10 });
    await seedSession({ routineSession: sessions[0]!, startedAt: LAST_WEEK + 3 * DAY, loadKg: 55, reps: 10 });
    const r = (await getReview('week', LAST_WEEK, NOW))!;
    expect(r.sessionsDone).toBe(2);
    expect(r.sessionsPlanned).toBe(4);
    expect(r.goalSetsTotal).toBeGreaterThan(0);
    expect(r.goalSetsMet).toBeLessThanOrEqual(r.goalSetsTotal);
    expect(r.prs.length).toBeGreaterThanOrEqual(1);
    expect(r.bestPr).not.toBeNull();
    // Only Upper A trained: lower-body muscles are far below target → "Needs work" names a muscle.
    expect(r.needsWork).toMatchObject({ code: 'muscle_low', fix: 'add' });
    // PRs ≥ 2 or goal rate: something is going well.
    expect(r.goingWell).not.toBeNull();
    // Goal changes recorded at finish show up as "next week" changes.
    expect(r.changes.length).toBeGreaterThan(0);
    expect(r.weekNumber).toBe(1);
  });

  it('an empty week reports zero and no "going well"', async () => {
    await seedOnboarded();
    const r = (await getReview('week', LAST_WEEK, NOW))!;
    expect(r.sessionsDone).toBe(0);
    expect(r.goingWell).toBeNull();
    expect(r.needsWork).toMatchObject({ code: 'muscle_low' });
  });

  it('recomp check needs 3 weigh-ins, then reports a status', async () => {
    const sessions = await seedOnboarded({ goal: 'recomp' });
    for (let w = 5; w >= 0; w--)
      await seedSession({
        routineSession: sessions[0]!,
        startedAt: NOW - w * 7 * DAY - DAY,
        loadKg: 50 + (5 - w) * 2.5,
      });
    let r = (await getReview('week', NOW, NOW))!;
    expect(r.recomp).toEqual({ status: 'empty', weighIns: 0 });
    for (const d of [30, 20, 10]) await saveWeighIn(dateKey(NOW - d * DAY), 80);
    r = (await getReview('week', NOW, NOW))!;
    expect(r.recomp).toMatchObject({ status: 'on_track', reason: 'on_track' });
    expect(r.bodyweight).toHaveLength(3);
    expect(r.strength.length).toBeGreaterThanOrEqual(2);
  });

  it('monthly review adds a per-muscle hard-sets trend', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: NOW - DAY });
    const r = (await getReview('month', NOW, NOW))!;
    expect(r.kind).toBe('month');
    expect(r.muscleTrend.length).toBeGreaterThan(0);
    const chest = r.muscleTrend.find((m) => m.muscle === 'chest');
    expect(chest!.weeks.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});

describe('strength read model (FR-STR-1…3)', () => {
  beforeEach(resetDb);

  it('asks for body stats first, then rates benchmark groups and flags machine-only ones', async () => {
    const sessions = await seedOnboarded();
    let v = (await getStrength(NOW))!;
    expect(v.needsBodyStats).toBe(true);

    await saveProfile({ sex: 'male', birthYear: new Date(NOW).getFullYear() - 30 });
    await saveWeighIn(dateKey(NOW - DAY), 80);
    // Log a squat and a machine-only chest session.
    const r = (await db.routines.where('active').equals(1).first())!;
    const withLifts = {
      ...sessions[0]!,
      items: [
        { exerciseId: 'back-squat', order: 0 },
        { exerciseId: 'pec-deck-fly', order: 1 },
      ],
    };
    await db.routines.put({ ...r, sessions: [withLifts, ...r.sessions.slice(1)] });
    await seedSession({ routineSession: withLifts, startedAt: NOW - 2 * DAY, loadKg: 100, reps: 5 });

    v = (await getStrength(NOW))!;
    expect(v.needsBodyStats).toBe(false);
    const legs = v.groups.find((g) => g.id === 'legs')!;
    expect(legs.result!.exerciseId).toBe('back-squat');
    // e1RM 100 × (1 + 5/30) ≈ 116.7 → ratio 1.46 → novice reached, intermediate next.
    expect(legs.result!.level.reached).toBe(1);
    expect(legs.result!.nextValue).toBeCloseTo(120);
    const chest = v.groups.find((g) => g.id === 'chest')!;
    expect(chest.result).toBeNull();
    expect(chest.machineOnly).toBe(true);
    expect(v.overall).not.toBeNull();
  });

  it('without a weigh-in there are no results (S11 shows an empty state)', async () => {
    const sessions = await seedOnboarded();
    await saveProfile({ sex: 'female' });
    await seedSession({ routineSession: sessions[1]!, startedAt: NOW - DAY });
    const v = (await getStrength(NOW))!;
    expect(v.bodyweightKg).toBeNull();
    expect(v.needsBodyStats).toBe(false);
    expect(v.groups.every((g) => g.result === null)).toBe(true);
  });
});

describe('lift series, history edits (FR-PRO-1, S18)', () => {
  beforeEach(resetDb);

  it('series per exercise, weekly best, and deleting a session rebuilds PRs', async () => {
    const sessions = await seedOnboarded();
    const a = await seedSession({ routineSession: sessions[0]!, startedAt: NOW - 9 * DAY, loadKg: 50 });
    const b = await seedSession({ routineSession: sessions[0]!, startedAt: NOW - 2 * DAY, loadKg: 60 });
    const lifts = await getLiftSeries();
    expect(lifts.length).toBeGreaterThan(0);
    expect(lifts[0]!.points).toHaveLength(2);
    const wk = weeklyBest(lifts[0]!.points, NOW, 1);
    expect(wk.length).toBeGreaterThanOrEqual(1);
    expect(wk[wk.length - 1]!.label).toBe('W8');

    const prsBefore = await db.prs.count();
    await deleteSession(b);
    expect(await db.sessions.get(b)).toBeUndefined();
    expect(await db.sets.where('sessionId').equals(b).count()).toBe(0);
    // PRs now come only from session a.
    const prs = await db.prs.toArray();
    expect(prs.length).toBeLessThanOrEqual(prsBefore);
    const setIds = new Set((await db.sets.where('sessionId').equals(a).toArray()).map((s) => s.id));
    expect(prs.every((p) => setIds.has(p.setId))).toBe(true);
  });
});

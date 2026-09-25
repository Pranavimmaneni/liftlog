import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { db } from './schema';
import { getBackupNudge, getMotivation } from './motivation';
import { setRawSetting } from './settings';
import { addDays, startOfWeek } from '@/engine/week';

const DAY = 86_400_000;
const NOW = Date.now();
const THIS_WEEK = startOfWeek(NOW, 1);

describe('motivation read model (FR-XP-1…6)', () => {
  beforeEach(resetDb);

  it('no sessions: level 1, no streak, "complete all sessions" quest', async () => {
    await seedOnboarded();
    const m = (await getMotivation(NOW))!;
    expect(m.totalXp).toBe(0);
    expect(m.level).toMatchObject({ level: 1, title: 'Rookie' });
    expect(m.streak.weeks).toBe(0);
    expect(m.quest).toMatchObject({ quest: { kind: 'all_sessions', target: 4 }, done: 0, complete: false });
  });

  it('XP accumulates per session from the log; first session is calibration + welcome', async () => {
    const sessions = await seedOnboarded();
    const a = await seedSession({ routineSession: sessions[0]!, startedAt: NOW - 10 * DAY, loadKg: 50 });
    const b = await seedSession({ routineSession: sessions[0]!, startedAt: NOW - 3 * DAY, loadKg: 55 });
    // The first session is a calibration session (every exercise a first exposure).
    await db.sessions.update(a, { calibration: true });
    const m = (await getMotivation(NOW))!;
    const xa = m.perSession.get(a)!;
    const xb = m.perSession.get(b)!;
    expect(xa.lines.map((l) => l.code)).toEqual(['firstSession']);
    expect(xa.milestones).toContainEqual({ id: 'sessions', count: 1 });
    expect(xb.lines.map((l) => l.code)).toEqual(expect.arrayContaining(['goalSet', 'pr', 'sessionComplete']));
    expect(m.totalXp).toBe(xa.total + xb.total);
    expect(xb.cumulative).toBe(m.totalXp);
    // Derived, not stored: editing the log changes XP.
    await db.sets.where('sessionId').equals(b).modify({ goalMet: false });
    const m2 = (await getMotivation(NOW))!;
    expect(m2.totalXp).toBeLessThan(m.totalXp);
  });

  it('streak counts complete weeks, and a full week earns weekComplete + quest XP', async () => {
    const sessions = await seedOnboarded({ daysPerWeek: 2 });
    const lastWeek = addDays(THIS_WEEK, -7);
    const twoAgo = addDays(THIS_WEEK, -14);
    const threeAgo = addDays(THIS_WEEK, -21);
    // Week 1 is all first exposures (calibration), which doesn't count toward the streak (D4).
    for (const [w, k] of [
      [threeAgo, 0],
      [threeAgo, 1],
      [twoAgo, 0],
      [twoAgo, 1],
      [lastWeek, 0],
      [lastWeek, 1],
    ] as const) {
      await seedSession({ routineSession: sessions[k % sessions.length]!, startedAt: w + (k + 1) * DAY });
    }
    const m = (await getMotivation(NOW))!;
    expect(m.streak.weeks).toBe(2);
    const lastWeekIds = (await db.sessions.toArray())
      .filter((s) => s.startedAt >= lastWeek && s.startedAt < THIS_WEEK)
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((s) => s.id);
    const second = m.perSession.get(lastWeekIds[1]!)!;
    expect(second.lines.map((l) => l.code)).toContain('weekComplete');
    // Week 1's quest is "complete all sessions" → completed by its second session.
    const firstWeekSecond = (await db.sessions.toArray())
      .filter((s) => s.startedAt < twoAgo)
      .sort((a, b) => a.startedAt - b.startedAt)[1]!;
    expect(m.perSession.get(firstWeekSecond.id)!.lines.map((l) => l.code)).toContain('weeklyQuest');
    // This week's quest comes from last week's weak spot.
    expect(['muscle', 'progress']).toContain(m.quest.quest.kind);
  });
});

describe('backup nudge (FR-DATA-2)', () => {
  beforeEach(resetDb);

  it('7 days after the last backup (or first session), after every 10th session, dismissible', async () => {
    const sessions = await seedOnboarded();
    expect(await getBackupNudge(NOW)).toBeNull();
    await seedSession({ routineSession: sessions[0]!, startedAt: NOW - 9 * DAY });
    expect(await getBackupNudge(NOW)).toMatchObject({ reason: 'days', days: null });
    await db.meta.put({ key: 'lastBackupAt', value: NOW - 2 * DAY });
    expect(await getBackupNudge(NOW)).toBeNull();
    await db.meta.put({ key: 'lastBackupAt', value: NOW - 8 * DAY });
    expect(await getBackupNudge(NOW)).toMatchObject({ reason: 'days', days: 8 });
    await setRawSetting('backupNudgeDismissedAt', NOW);
    expect(await getBackupNudge(NOW)).toBeNull();

    // 10th session after the last backup (and after the dismissal) brings it back.
    await db.meta.put({ key: 'lastBackupAt', value: NOW - 3 * DAY });
    await setRawSetting('backupNudgeDismissedAt', NOW - 2.5 * DAY);
    for (let i = 0; i < 9; i++) {
      await seedSession({ routineSession: sessions[i % 4]!, startedAt: NOW - 2 * DAY + i * 3_600_000 });
    }
    expect(await getBackupNudge(NOW + 60_000)).toMatchObject({ reason: 'sessions', sessions: 10 });
  });
});

import { describe, expect, it } from 'vitest';
import {
  levelInfo,
  questFor,
  questProgress,
  streakFor,
  tonnageEquivalent,
  xpForLevel,
  xpLedger,
  type XpSession,
  type XpSet,
} from './xp';

const DAY = 86_400_000;
const sess = (id: string, day: number, extra: Partial<XpSession> = {}): XpSession => ({
  id,
  startedAt: day * DAY,
  calibration: false,
  tonnageKg: 0,
  bwPullup: false,
  ...extra,
});
let n = 0;
const set = (sessionId: string, exerciseId: string, extra: Partial<XpSet> = {}): XpSet => ({
  id: `set${n++}`,
  sessionId,
  exerciseId,
  kind: 'work',
  goalMet: true,
  bonusReps: 0,
  hurts: false,
  ...extra,
});
const empty = {
  prSetIds: new Set<string>(),
  weekCompleteSessionIds: new Set<string>(),
  questSessionIds: new Set<string>(),
};

describe('XP ledger (FR-XP-1, xp.json, D4)', () => {
  it('first exposure earns no per-set XP; first session earns the welcome bonus; calibration no sessionComplete', () => {
    const l = xpLedger({
      ...empty,
      sessions: [sess('a', 1, { calibration: true }), sess('b', 3)],
      sets: [set('a', 'x'), set('a', 'x'), set('b', 'x'), set('b', 'x'), set('b', 'y')],
    });
    expect(l[0]!.lines).toEqual([{ code: 'firstSession', count: 1, xp: 100 }]);
    expect(l[0]!.total).toBe(100);
    // b: 2 goal sets on x (y is a first exposure) + sessionComplete.
    expect(l[1]!.lines).toEqual([
      { code: 'goalSet', count: 2, xp: 20 },
      { code: 'sessionComplete', count: 1, xp: 40 },
    ]);
    expect(l[1]!.cumulative).toBe(160);
  });

  it('warm-ups, hurts and unmet sets earn nothing; bonus reps capped per exercise; one extra set per exercise', () => {
    const sets = [
      set('a', 'x'),
      set('b', 'x', { kind: 'warmup' }),
      set('b', 'x', { hurts: true }),
      set('b', 'x', { goalMet: false }),
      set('b', 'x', { bonusReps: 8 }),
      set('b', 'x', { bonusReps: 8 }),
      set('b', 'x', { kind: 'extra' }),
      set('b', 'x', { kind: 'extra' }),
    ];
    const pr = sets[4]!.id;
    const l = xpLedger({ ...empty, prSetIds: new Set([pr]), sessions: [sess('a', 1), sess('b', 2)], sets });
    const b = Object.fromEntries(l[1]!.lines.map((x) => [x.code, x]));
    expect(b.goalSet!.count).toBe(2);
    expect(b.bonusRep).toEqual({ code: 'bonusRep', count: 10, xp: 20 });
    expect(b.extraSet).toEqual({ code: 'extraSet', count: 1, xp: 5 });
    expect(b.pr).toEqual({ code: 'pr', count: 1, xp: 50 });
  });

  it('week complete and quest awards, and the per-session cap', () => {
    const sets = [set('a', 'x'), ...Array.from({ length: 80 }, () => set('b', 'x'))];
    const l = xpLedger({
      prSetIds: new Set(),
      weekCompleteSessionIds: new Set(['b']),
      questSessionIds: new Set(['b']),
      sessions: [sess('a', 1), sess('b', 2)],
      sets,
    });
    expect(l[1]!.lines.map((x) => x.code)).toEqual([
      'goalSet',
      'sessionComplete',
      'weekComplete',
      'weeklyQuest',
    ]);
    expect(l[1]!.total).toBe(600);
  });

  it('milestones: tonnage thresholds crossed, session counts, first bodyweight pull-up once', () => {
    const l = xpLedger({
      ...empty,
      sessions: [
        sess('a', 1, { tonnageKg: 600 }),
        sess('b', 2, { tonnageKg: 5_000, bwPullup: true }),
        sess('c', 3, { bwPullup: true }),
      ],
      sets: [],
    });
    expect(l[0]!.milestones).toEqual([{ id: 'sessions', count: 1 }]);
    expect(l[1]!.milestones).toEqual([
      { id: 'tonnage', thresholdKg: 5000, equivalent: { name: 'Honda Civic', count: 3.8 } },
      { id: 'first_bw_pullup' },
    ]);
    expect(l[2]!.milestones).toEqual([]);
  });

  it('tonnage equivalents pick the biggest object lifted at least once', () => {
    expect(tonnageEquivalent(1000)).toEqual({ name: 'grand piano', count: 2.2 });
    expect(tonnageEquivalent(100_000)).toEqual({ name: 'African elephant', count: 16.7 });
    expect(tonnageEquivalent(100)).toEqual({ name: 'blue whale heart', count: 0.6 });
  });
});

describe('levels (FR-XP-2, D5)', () => {
  it('cumulative thresholds from xpForLevel and titles', () => {
    expect(xpForLevel(1)).toBe(250);
    expect(xpForLevel(6)).toBe(2808);
    expect(levelInfo(0)).toMatchObject({ level: 1, title: 'Rookie', floor: 0, next: 250, progress: 0 });
    expect(levelInfo(250).level).toBe(2);
    expect(levelInfo(3000)).toMatchObject({ level: 7, title: 'Iron' });
    expect(levelInfo(xpForLevel(9)).title).toBe('Steel');
    expect(levelInfo(10_000_000).title).toBe('Legend');
  });
});

describe('streak (FR-XP-4, D6)', () => {
  const W = (complete: boolean, current = false, start = 0) => ({ complete, current, start });
  it('counts consecutive complete weeks; the current week never breaks it', () => {
    expect(streakFor([W(true), W(true), W(false, true)])).toEqual({
      weeks: 2,
      passBanked: false,
      passUsed: [],
    });
    expect(streakFor([W(true), W(false), W(true), W(true, true)])).toMatchObject({ weeks: 2 });
  });
  it('8 complete weeks bank a pass that covers the next missed week', () => {
    const weeks = [
      ...Array.from({ length: 8 }, (_, i) => W(true, false, i)),
      W(false, false, 8),
      W(true, false, 9),
    ];
    expect(streakFor(weeks)).toEqual({ weeks: 9, passBanked: false, passUsed: [8] });
    expect(streakFor(weeks.slice(0, 8))).toMatchObject({ weeks: 8, passBanked: true });
    // Without a pass a miss resets.
    expect(streakFor([...weeks.slice(0, 7), W(false), W(true)])).toMatchObject({ weeks: 1 });
  });
});

describe('weekly quest (FR-XP-6, D68)', () => {
  it('missed sessions → complete all; else the weakest muscle; else beat 3 lifts', () => {
    expect(questFor({ previous: null, sessionsPlanned: 4 })).toEqual({ kind: 'all_sessions', target: 4 });
    const prev = {
      sessionsDone: 4,
      sessionsPlanned: 4,
      muscles: [] as { muscle: 'hamstrings' | 'chest'; done: number; planned: number }[],
    };
    expect(questFor({ previous: { ...prev, sessionsDone: 3 }, sessionsPlanned: 4 })).toMatchObject({
      kind: 'all_sessions',
    });
    expect(
      questFor({
        previous: {
          ...prev,
          muscles: [
            { muscle: 'chest', done: 9, planned: 10 },
            { muscle: 'hamstrings', done: 4, planned: 7.5 },
          ],
        },
        sessionsPlanned: 4,
      }),
    ).toEqual({ kind: 'muscle', muscle: 'hamstrings', target: 8 });
    expect(questFor({ previous: prev, sessionsPlanned: 4 })).toEqual({ kind: 'progress', target: 3 });
  });

  it('progress per quest kind', () => {
    const w = { sessionsDone: 2, muscleSets: new Map([['hamstrings' as const, 8.5]]), progressed: 4 };
    expect(questProgress({ kind: 'all_sessions', target: 4 }, w)).toEqual({
      done: 2,
      target: 4,
      complete: false,
    });
    expect(questProgress({ kind: 'muscle', muscle: 'hamstrings', target: 8 }, w)).toEqual({
      done: 8,
      target: 8,
      complete: true,
    });
    expect(questProgress({ kind: 'progress', target: 3 }, w)).toEqual({ done: 3, target: 3, complete: true });
  });
});

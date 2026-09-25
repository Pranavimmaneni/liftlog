import { describe, expect, it } from 'vitest';
import exercisesJson from '@/data/exercises.json';
import {
  ageFactor,
  benchmarkResult,
  BENCHMARK_EXERCISES,
  eta,
  isGuidelineSource,
  isRepsBenchmark,
  levelFor,
  overallLevel,
  pickGroupResult,
  thresholds,
  weeklySlope,
} from './strength';
import {
  goingWell,
  hardSetsByMuscle,
  needsWork,
  recompCheck,
  relativeChange,
  strengthIndex,
  type InsightInput,
} from './review';
import { STANDARDS } from './data';
import type { Exercise } from './types';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const NOW = new Date(2026, 8, 24, 12).getTime();
const exMap = new Map((exercisesJson as Exercise[]).map((e) => [e.id, e]));

describe('strength levels (§6.6, FR-STR-1)', () => {
  it('every benchmark maps to seeded exercises and every standards key has a mapping', () => {
    for (const [key, ids] of Object.entries(BENCHMARK_EXERCISES)) {
      expect(STANDARDS.benchmarks[key], key).toBeDefined();
      for (const id of ids) expect(exMap.has(id), id).toBe(true);
    }
    for (const key of Object.keys(STANDARDS.benchmarks)) expect(BENCHMARK_EXERCISES[key], key).toBeDefined();
  });

  it('age factor follows ageAdjust bands', () => {
    const y = new Date(NOW).getFullYear();
    expect(ageFactor(undefined, NOW)).toBe(1);
    expect(ageFactor(y - 16, NOW)).toBe(0.85);
    expect(ageFactor(y - 27, NOW)).toBe(1);
    expect(ageFactor(y - 45, NOW)).toBe(0.93);
    expect(ageFactor(y - 55, NOW)).toBe(0.85);
    expect(ageFactor(y - 65, NOW)).toBe(0.76);
    expect(ageFactor(y - 80, NOW)).toBe(0.67);
  });

  it('thresholds by sex; "prefer not to say" takes the lower of each band; reps are not age-scaled', () => {
    expect(thresholds('back_squat', 'male', undefined, NOW)).toEqual([0.75, 1.25, 1.5, 2, 2.5]);
    expect(thresholds('back_squat', 'female', undefined, NOW)).toEqual([0.5, 0.75, 1, 1.5, 1.9]);
    expect(thresholds('back_squat', 'unspecified', undefined, NOW)).toEqual([0.5, 0.75, 1, 1.5, 1.9]);
    const y = new Date(NOW).getFullYear();
    expect(thresholds('back_squat', 'male', y - 45, NOW)[0]).toBeCloseTo(0.698, 3);
    expect(isRepsBenchmark('pull_up_reps')).toBe(true);
    expect(thresholds('pull_up_reps', 'male', y - 65, NOW)).toEqual([1, 5, 10, 15, 22]);
  });

  it('levelFor: segments fill as thresholds are reached; the marker sits in the next one', () => {
    const t = [1, 2, 3, 4, 5];
    expect(levelFor(0.5, t)).toEqual({ reached: -1, segment: 0, position: 0.5, next: 0 });
    expect(levelFor(2.5, t)).toEqual({ reached: 1, segment: 2, position: 0.5, next: 2 });
    expect(levelFor(3, t)).toMatchObject({ reached: 2, segment: 3, position: 0 });
    expect(levelFor(9, t)).toEqual({ reached: 4, segment: 4, position: 1, next: null });
  });

  it('weekly slope is least squares per week', () => {
    expect(weeklySlope([{ at: 0, value: 1 }])).toBeNull();
    expect(
      weeklySlope([
        { at: 0, value: 1 },
        { at: 0, value: 2 },
      ]),
    ).toBeNull();
    expect(weeklySlope([0, 1, 2, 3].map((w) => ({ at: w * WEEK, value: 100 + 2 * w })))).toBeCloseTo(2);
  });

  it('ETA: weeks, months past 12 weeks, none when flat or already there', () => {
    expect(eta(100, 110, 2)).toEqual({ weeks: 5 });
    expect(eta(100, 150, 2)).toEqual({ months: 6 });
    expect(eta(100, 110, 0)).toBeNull();
    expect(eta(100, 110, null)).toBeNull();
    expect(eta(120, 110, 2)).toBeNull();
  });

  it('benchmarkResult: best of last 8 weeks ÷ bodyweight, next milestone in kg, ETA from 6-week slope', () => {
    const points = [0, 1, 2, 3, 4, 5].map((w) => ({ at: NOW - (5 - w) * WEEK, value: 90 + w * 2 }));
    points.push({ at: NOW - 20 * WEEK, value: 200 }); // too old to count as "best"
    const r = benchmarkResult(
      { key: 'back_squat', exerciseId: 'back-squat', points },
      { sex: 'male', bodyweightKg: 80 },
      NOW,
    )!;
    expect(r.best).toBe(100);
    expect(r.ratio).toBeCloseTo(1.25);
    expect(r.level.reached).toBe(1); // novice
    expect(r.nextValue).toBeCloseTo(120); // intermediate 1.5 × 80
    expect(r.eta).toEqual({ weeks: 10 });
    expect(
      benchmarkResult(
        { key: 'back_squat', exerciseId: 'x', points: [] },
        { sex: 'male', bodyweightKg: 80 },
        NOW,
      ),
    ).toBeNull();
  });

  it('pull-ups use reps, not bodyweight ratio', () => {
    const r = benchmarkResult(
      { key: 'pull_up_reps', exerciseId: 'pull-up', points: [{ at: NOW - DAY, value: 9 }] },
      { sex: 'male', bodyweightKg: 80 },
      NOW,
    )!;
    expect(r.ratio).toBe(9);
    expect(r.level.reached).toBe(1);
    expect(r.nextValue).toBe(10);
    expect(r.eta).toBeNull();
  });

  it('group pick and overall label', () => {
    const mk = (reached: number, position: number) =>
      ({ level: { reached, segment: reached + 1, position, next: reached + 1 } }) as never;
    expect(pickGroupResult([])).toBeNull();
    expect(pickGroupResult([mk(1, 0.9), mk(2, 0.1)])).toMatchObject({ level: { reached: 2 } });
    expect(overallLevel([])).toBeNull();
    expect(overallLevel([mk(1, 0.6), mk(0, 0.1), mk(3, 0.2)])).toEqual({ band: 1, plus: true, next: 2 });
  });

  it('standards.json with a TODO source shows "Guideline values" (D23)', () => {
    expect(isGuidelineSource(STANDARDS.source)).toBe(true);
    expect(isGuidelineSource('')).toBe(true);
    expect(isGuidelineSource('ExRx strength standards, 2024')).toBe(false);
  });
});

const BASE: InsightInput = {
  sessionsDone: 3,
  sessionsPlanned: 4,
  goalSetsMet: 30,
  goalSetsTotal: 40,
  newPrs: 0,
  benchmarkChanges: [],
  muscleSets: [{ muscle: 'chest', sets: 10, target: 10 }],
  stalled: [],
  hurts: [],
};

describe('insights (§6.7), first match wins', () => {
  it('going well in order: e1RM ≥ 5% → all sessions → goal rate ≥ 90% → ≥ 2 PRs', () => {
    expect(goingWell(BASE)).toBeNull();
    const all = { ...BASE, sessionsDone: 4, goalSetsMet: 40, newPrs: 3 };
    expect(
      goingWell({
        ...all,
        benchmarkChanges: [
          { exerciseId: 'a', change: 0.04, weeks: 4 },
          { exerciseId: 'b', change: 0.09, weeks: 3 },
        ],
      }),
    ).toEqual({ code: 'e1rm_up', exerciseId: 'b', pct: 9, weeks: 3 });
    expect(goingWell(all)).toEqual({ code: 'all_sessions', done: 4 });
    expect(goingWell({ ...BASE, goalSetsMet: 36, newPrs: 3 })).toEqual({ code: 'goal_rate', pct: 90 });
    expect(goingWell({ ...BASE, newPrs: 2 })).toEqual({ code: 'prs', count: 2 });
  });

  it('needs work in order: muscle < 60% → stalled → missed ≥ 2 → hurts', () => {
    expect(needsWork(BASE)).toBeNull();
    const worst = {
      ...BASE,
      sessionsDone: 1,
      stalled: ['lat-pulldown'],
      hurts: ['dip'],
      muscleSets: [
        { muscle: 'hamstrings' as const, sets: 4, target: 10 },
        { muscle: 'calves' as const, sets: 5, target: 10 },
        { muscle: 'chest' as const, sets: 6, target: 10 },
      ],
    };
    expect(needsWork(worst)).toEqual({
      code: 'muscle_low',
      muscle: 'hamstrings',
      sets: 4,
      target: 10,
      fix: 'add',
    });
    expect(needsWork({ ...worst, muscleSets: [] })).toEqual({
      code: 'stalled',
      exerciseId: 'lat-pulldown',
      fix: 'swap',
    });
    expect(needsWork({ ...worst, muscleSets: [], stalled: [] })).toEqual({
      code: 'missed',
      missed: 3,
      fix: 'days',
    });
    expect(needsWork({ ...BASE, hurts: ['dip'] })).toEqual({ code: 'hurts', exerciseId: 'dip', fix: 'swap' });
  });

  it('hard sets done: primary 1, secondary 0.5, warm-ups 0', () => {
    const m = hardSetsByMuscle(
      [
        { exerciseId: 'bench-press', kind: 'work' },
        { exerciseId: 'bench-press', kind: 'warmup' },
        { exerciseId: 'nope', kind: 'work' },
      ],
      exMap,
    );
    expect(m.get('chest')).toBe(1);
    expect(m.get('triceps')).toBe(0.5);
  });

  it('relative change', () => {
    expect(relativeChange([])).toBeNull();
    expect(
      relativeChange([
        { at: 2, value: 110 },
        { at: 1, value: 100 },
      ]),
    ).toBeCloseTo(0.1);
    expect(
      relativeChange([
        { at: 1, value: 0 },
        { at: 2, value: 5 },
      ]),
    ).toBeNull();
  });
});

describe('recomp check (§6.8)', () => {
  const weeks = (vals: number[]) => vals.map((value, i) => ({ at: i * WEEK, value }));
  const up = weeks([100, 102, 104, 106]);
  const flat = weeks([100, 100, 100, 100]);
  const base = { weighIns: weeks([80, 80, 80]), strength: up, sessionsDone: 4, sessionsPlanned: 4 };

  it('needs 3 weigh-ins', () => {
    expect(recompCheck({ ...base, goal: 'recomp', weighIns: weeks([80, 80]) })).toEqual({
      status: 'empty',
      weighIns: 2,
    });
  });

  it('recomp: strength up and bodyweight within ±1%/week', () => {
    expect(recompCheck({ ...base, goal: 'recomp' })).toMatchObject({
      status: 'on_track',
      reason: 'on_track',
    });
    expect(recompCheck({ ...base, goal: 'recomp', weighIns: weeks([80, 78.5, 77]) })).toMatchObject({
      status: 'watch',
      reason: 'losing_fast',
    });
    expect(recompCheck({ ...base, goal: 'recomp', weighIns: weeks([80, 81.5, 83]) })).toMatchObject({
      reason: 'gaining_fast',
    });
    expect(recompCheck({ ...base, goal: 'recomp', strength: flat })).toMatchObject({
      status: 'watch',
      reason: 'strength_flat',
    });
    expect(recompCheck({ ...base, goal: 'recomp', strength: [] })).toMatchObject({
      reason: 'no_strength_data',
    });
  });

  it('build muscle: +0.25…0.5% a week', () => {
    expect(recompCheck({ ...base, goal: 'build_muscle', weighIns: weeks([80, 80.3, 80.6]) })).toMatchObject({
      status: 'on_track',
    });
    expect(recompCheck({ ...base, goal: 'build_muscle' })).toMatchObject({ reason: 'not_gaining' });
    expect(recompCheck({ ...base, goal: 'build_muscle', weighIns: weeks([80, 81, 82]) })).toMatchObject({
      reason: 'gaining_fast',
    });
  });

  it('get stronger: strength only; general fitness: consistency only', () => {
    expect(recompCheck({ ...base, goal: 'get_stronger', weighIns: weeks([80, 85, 90]) })).toMatchObject({
      status: 'on_track',
    });
    expect(recompCheck({ ...base, goal: 'general_fitness', strength: flat })).toMatchObject({
      status: 'on_track',
    });
    expect(recompCheck({ ...base, goal: 'general_fitness', sessionsDone: 2 })).toMatchObject({
      status: 'watch',
      reason: 'consistency_low',
    });
  });

  it('strength index averages each lift relative to its first week', () => {
    const starts = [0, WEEK, 2 * WEEK];
    const idx = strengthIndex(
      new Map([
        [
          'a',
          [
            { at: 1, value: 100 },
            { at: WEEK + 1, value: 110 },
            { at: 2 * WEEK + 1, value: 120 },
          ],
        ],
        [
          'b',
          [
            { at: WEEK + 2, value: 50 },
            { at: 2 * WEEK + 2, value: 55 },
          ],
        ],
        ['c', [{ at: 3, value: 70 }]], // one week only: ignored
        ['d', [{ at: -5, value: 70 }]], // before the window
      ]),
      starts,
    );
    expect(idx.map((p) => Math.round(p.value))).toEqual([100, 105, 115]);
  });
});

import { describe, expect, it } from 'vitest';
import exercisesJson from '@/data/exercises.json';
import { bodyweightOn, effectiveLoadKg, setVolume } from './load';
import { epley, equivalentReps, MAX_E1RM_REPS, setE1rm } from './e1rm';
import {
  displayNumber,
  floorTo,
  formatLoad,
  fromDisplay,
  hasLoad,
  incrementIn,
  kgToLb,
  lbToKg,
  loadUnitLabel,
  roundLoadKg,
  roundTo,
  toDisplay,
} from './units';
import { canNudge, coachCall, prescribe, repsInReserve, weeklyTarget } from './prescription';
import { warmupEligible, warmupsFor } from './warmup';
import { bonusReps, exerciseProgress, goalMeter, isGoalSet } from './goalset';
import { adjust, endsAt, formatClock, isDone, remainingMs, restSecondsFor, startTimer } from './timer';
import { advance, reorder, rotationOrder, skipTo, upNext } from './rotation';
import {
  addDays,
  dateKey,
  daysBetween,
  monthGrid,
  parseDateKey,
  startOfWeek,
  weekNumber,
  weekRange,
} from './week';
import { previewDays, recommendSplit, sessionsFor, shortName, splitById, weekLayout } from './split';
import { bestE1rmByExercise, bonusPercent, estimateMinutes, findPrs, sessionTotals } from './summary';
import { buildIndex, editDistance, normalize, search } from './search';
import type { Exercise, LoggedSet, Target } from './types';

const EX = exercisesJson as Exercise[];
const byId = new Map(EX.map((e) => [e.id, e]));
const ex = (id: string) => byId.get(id)!;

let n = 0;
const set = (p: Partial<LoggedSet>): LoggedSet => ({
  id: `s${++n}`,
  sessionId: 'S',
  exerciseId: 'bench-press',
  idx: 1,
  kind: 'work',
  loadKg: 60,
  reps: 10,
  hurts: false,
  loggedAt: n,
  ...p,
});

describe('units (FR-SET-2)', () => {
  it('FR-SET-2: converts kg ⇄ lb without drift', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3);
    expect(lbToKg(kgToLb(72.5))).toBeCloseTo(72.5, 9);
    expect(toDisplay(10, 'kg')).toBe(10);
    expect(fromDisplay(10, 'kg')).toBe(10);
    expect(fromDisplay(225, 'lb')).toBeCloseTo(102.058, 3);
  });

  it('FR-SET-2: kg/lb rounding respects the unit increment', () => {
    expect(incrementIn('kg', 2.5, 'barbell')).toBe(2.5);
    expect(incrementIn('lb', 2.5, 'barbell')).toBe(5);
    expect(incrementIn('lb', 2, 'dumbbell')).toBe(5);
    expect(incrementIn('lb', 10, 'plate_loaded')).toBe(22);
    expect(incrementIn('lb', 0, 'bodyweight')).toBe(0);
    expect(roundLoadKg(61.2, 'kg', 2.5, 'barbell')).toBe(60);
    expect(roundLoadKg(61.3, 'kg', 2.5, 'barbell')).toBe(62.5);
    // 61.2 kg = 134.9 lb → 135 lb
    expect(kgToLb(roundLoadKg(61.2, 'lb', 2.5, 'barbell'))).toBeCloseTo(135, 6);
    expect(roundTo(7.3, 0)).toBe(7.3);
    expect(floorTo(13, 2)).toBe(12);
    expect(floorTo(7.77, 0)).toBe(7.7);
  });

  it('display labels: dumbbells say "kg / hand" (M1 phone check 5)', () => {
    expect(loadUnitLabel('dumbbell', 'kg')).toBe('kg / hand');
    expect(formatLoad(26, 'dumbbell', 'kg')).toBe('26 kg / hand');
    expect(formatLoad(55, 'machine_stack', 'kg')).toBe('55 kg');
    expect(formatLoad(0, 'bodyweight', 'kg')).toBe('BW');
    expect(formatLoad(10, 'bodyweight_plus', 'kg')).toBe('BW +10 kg');
    expect(formatLoad(0, 'bodyweight_plus', 'kg')).toBe('BW');
    expect(formatLoad(20, 'assisted', 'kg')).toBe('20 kg assist');
    expect(formatLoad(null, 'barbell', 'kg')).toBe('–');
    expect(formatLoad(12, 'kettlebell', 'lb')).toBe('26.5 lb / bell');
    expect(formatLoad(30, 'timed', 'kg')).toBe('');
    expect(loadUnitLabel('timed', 'kg')).toBe('s');
    expect(loadUnitLabel('bodyweight', 'kg')).toBe('bodyweight');
    expect(loadUnitLabel('assisted', 'lb')).toBe('lb assist');
    expect(loadUnitLabel('bodyweight_plus', 'kg')).toBe('+kg');
    expect(displayNumber(22.54, 'kg')).toBe('22.5');
    expect(hasLoad('barbell')).toBe(true);
    expect(hasLoad('bodyweight')).toBe(false);
  });
});

describe('load handling (§6.1)', () => {
  it('§6.1: dumbbell volume = load × 2 × reps', () => {
    expect(setVolume({ kind: 'work', loadKg: 26, reps: 10 }, 'dumbbell', null)).toEqual({
      kg: 520,
      excluded: false,
    });
  });

  it('§6.1: bodyweight volume uses bodyweight, excluded and flagged when unknown', () => {
    expect(setVolume({ kind: 'work', loadKg: 0, reps: 8 }, 'bodyweight', 80)).toEqual({
      kg: 640,
      excluded: false,
    });
    expect(setVolume({ kind: 'work', loadKg: 0, reps: 8 }, 'bodyweight', null)).toEqual({
      kg: 0,
      excluded: true,
    });
    expect(setVolume({ kind: 'work', loadKg: 10, reps: 5 }, 'bodyweight_plus', 80)).toEqual({
      kg: 450,
      excluded: false,
    });
  });

  it('§6.1: assisted volume = (bodyweight − assistance) × reps', () => {
    expect(setVolume({ kind: 'work', loadKg: 20, reps: 10 }, 'assisted', 80)).toEqual({
      kg: 600,
      excluded: false,
    });
    expect(effectiveLoadKg(90, 'assisted', 80)).toBe(0);
    expect(effectiveLoadKg(20, 'assisted', null)).toBeNull();
  });

  it('warm-ups and timed sets add no volume', () => {
    expect(setVolume({ kind: 'warmup', loadKg: 60, reps: 8 }, 'barbell', 80).kg).toBe(0);
    expect(setVolume({ kind: 'work', loadKg: 0, reps: 45 }, 'timed', 80).kg).toBe(0);
    expect(effectiveLoadKg(10, 'timed', 80)).toBeNull();
  });

  it('uses the latest bodyweight on or before the session date', () => {
    const rows = [
      { date: '2026-09-01', kg: 80 },
      { date: '2026-09-10', kg: 79 },
      { date: '2026-09-20', kg: 78 },
    ];
    expect(bodyweightOn(rows, '2026-09-15')).toBe(79);
    expect(bodyweightOn(rows, '2026-08-01')).toBeNull();
    expect(bodyweightOn(rows, '2026-09-20')).toBe(78);
  });
});

describe('e1RM (§6.2)', () => {
  it('§6.2: Epley on work sets with reps ≤ 12', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 2);
    expect(MAX_E1RM_REPS).toBe(12);
    expect(setE1rm({ kind: 'work', loadKg: 100, reps: 13 }, 'barbell', null)).toBeNull();
    expect(setE1rm({ kind: 'warmup', loadKg: 100, reps: 5 }, 'barbell', null)).toBeNull();
    expect(setE1rm({ kind: 'work', loadKg: 100, reps: 0 }, 'barbell', null)).toBeNull();
  });

  it('§6.2: assisted uses effective load; bodyweight uses bodyweight (+ added)', () => {
    expect(setE1rm({ kind: 'work', loadKg: 20, reps: 6 }, 'assisted', 80)).toBeCloseTo(72, 5);
    expect(setE1rm({ kind: 'work', loadKg: 10, reps: 3 }, 'bodyweight_plus', 80)).toBeCloseTo(99, 5);
    expect(setE1rm({ kind: 'work', loadKg: 0, reps: 3 }, 'bodyweight', null)).toBeNull();
  });

  it('equivalent reps at a lower target load', () => {
    expect(equivalentReps(100, 10, 100)).toBeCloseTo(10, 9);
    expect(equivalentReps(105, 10, 100)).toBeCloseTo(12, 9);
    expect(equivalentReps(100, 10, 0)).toBe(10);
  });
});

describe('prescription (FR-GOAL-2, FR-ONB-2)', () => {
  const p = (
    experience: 'beginner' | 'intermediate' | 'advanced',
    goal = 'build_muscle' as const,
    nudge: -1 | 0 | 1 = 0,
  ) => ({
    experience,
    goal,
    nudge,
  });

  it('FR-GOAL-2: sets and reps come from intensity.json by level and role', () => {
    expect(prescribe(p('intermediate'), 'compound')).toMatchObject({
      sets: 3,
      repMin: 8,
      repMax: 10,
      restSec: 120,
    });
    expect(prescribe(p('intermediate'), 'isolation')).toMatchObject({
      sets: 3,
      repMin: 10,
      repMax: 12,
      restSec: 90,
    });
    expect(prescribe(p('beginner'), 'compound')).toMatchObject({ sets: 2, repMin: 10, repMax: 15 });
  });

  it('FR-GOAL-2: goal modifiers (get stronger reps + rest, general fitness sets)', () => {
    expect(
      prescribe({ experience: 'intermediate', goal: 'get_stronger', nudge: 0 }, 'compound'),
    ).toMatchObject({
      repMin: 4,
      repMax: 6,
      restSec: 180,
    });
    expect(
      prescribe({ experience: 'advanced', goal: 'general_fitness', nudge: 0 }, 'compound').setsRange,
    ).toEqual([2, 3]);
    expect(weeklyTarget({ experience: 'advanced', goal: 'general_fitness', nudge: 0 })).toEqual([6, 10]);
  });

  it('FR-ONB-2: Easier/Harder move sets and effort one level but keep rep ranges', () => {
    const harder = prescribe(p('intermediate', 'build_muscle', 1), 'compound');
    expect(harder).toMatchObject({ sets: 4, repMin: 8, repMax: 10, targetEffort: 'solid-hard' });
    const easier = prescribe(p('intermediate', 'build_muscle', -1), 'compound');
    expect(easier).toMatchObject({ sets: 2, repMin: 8, repMax: 10, targetEffort: 'easy-solid' });
    expect(weeklyTarget(p('intermediate', 'build_muscle', 1))).toEqual([14, 20]);
    expect(canNudge('beginner', 0, -1)).toBe(false);
    expect(canNudge('beginner', 0, 1)).toBe(true);
    expect(canNudge('intermediate', 1, 1)).toBe(false);
    expect(canNudge('advanced', 0, 1)).toBe(false);
  });

  it("FR-ONB-2: coach's call summary", () => {
    expect(coachCall(p('intermediate'))).toEqual({
      sets: [3, 4],
      reps: [8, 12],
      rest: [90, 120],
      effort: 'solid',
    });
    expect(repsInReserve('solid')).toEqual([1, 2]);
    expect(repsInReserve('easy-solid')).toEqual([1, 3]);
    expect(repsInReserve('solid-hard')).toEqual([0, 2]);
  });
});

describe('warm-ups (FR-WRK-7)', () => {
  it('FR-WRK-7: ramp from intensity.json, rounded down to the increment', () => {
    expect(warmupsFor(26, 2)).toEqual([
      { loadKg: 12, reps: 8 },
      { loadKg: 18, reps: 4 },
    ]);
    expect(warmupsFor(100, 2.5)).toEqual([
      { loadKg: 50, reps: 8 },
      { loadKg: 75, reps: 4 },
    ]);
  });

  it('FR-WRK-7: none below minWorkingKg, when disabled, or in calibration', () => {
    expect(warmupsFor(18, 2)).toEqual([]);
    expect(warmupsFor(60, 2.5, false)).toEqual([]);
    expect(warmupsFor(null, 2.5)).toEqual([]);
  });

  it('FR-WRK-7: only the first compound per muscle group', () => {
    const order = [
      ex('lat-pulldown'),
      ex('incline-dumbbell-press'),
      ex('bench-press'),
      ex('rope-pushdown'),
      ex('pull-up'),
    ];
    expect([...warmupEligible(order)]).toEqual(['lat-pulldown', 'incline-dumbbell-press']);
  });
});

describe('goal sets and bonus (FR-WRK-8, FR-WRK-3, FR-WRK-14)', () => {
  const tgt: Target = { sets: 3, repMin: 8, repMax: 10, loadKg: 60 };

  it('FR-WRK-8: goal set = reps ≥ repMin and load ≥ target', () => {
    expect(isGoalSet({ kind: 'work', loadKg: 60, reps: 8 }, tgt, 'barbell')).toBe(true);
    expect(isGoalSet({ kind: 'work', loadKg: 57.5, reps: 10 }, tgt, 'barbell')).toBe(false);
    expect(isGoalSet({ kind: 'work', loadKg: 60, reps: 7 }, tgt, 'barbell')).toBe(false);
    expect(isGoalSet({ kind: 'warmup', loadKg: 60, reps: 10 }, tgt, 'barbell')).toBe(false);
  });

  it('FR-WRK-8: assisted goal = assistance ≤ target', () => {
    const t: Target = { sets: 3, repMin: 8, repMax: 10, loadKg: 20 };
    expect(isGoalSet({ kind: 'work', loadKg: 15, reps: 8 }, t, 'assisted')).toBe(true);
    expect(isGoalSet({ kind: 'work', loadKg: 25, reps: 8 }, t, 'assisted')).toBe(false);
  });

  it('FR-GOAL-4: calibration (no load target) checks reps only', () => {
    expect(isGoalSet({ kind: 'work', loadKg: 40, reps: 8 }, { ...tgt, loadKg: null }, 'barbell')).toBe(true);
    expect(isGoalSet({ kind: 'work', loadKg: 0, reps: 9 }, tgt, 'bodyweight')).toBe(true);
  });

  it('FR-WRK-8: bonus = reps above repMax + extra load as rep-equivalents', () => {
    expect(bonusReps({ kind: 'work', loadKg: 60, reps: 12 }, tgt, 'barbell')).toBe(2);
    expect(bonusReps({ kind: 'work', loadKg: 60, reps: 10 }, tgt, 'barbell')).toBe(0);
    // 63 kg × 10 = 12 reps at 60 kg → +2; 62 kg × 10 ≈ 11.3 → +1
    expect(bonusReps({ kind: 'work', loadKg: 63, reps: 10 }, tgt, 'barbell')).toBe(2);
    expect(bonusReps({ kind: 'work', loadKg: 62, reps: 10 }, tgt, 'barbell')).toBe(1);
    expect(bonusReps({ kind: 'work', loadKg: 60, reps: 7 }, tgt, 'barbell')).toBe(0);
    expect(bonusReps({ kind: 'work', loadKg: 0, reps: 13 }, tgt, 'bodyweight')).toBe(3);
  });

  it('FR-WRK-8: assisted bonus inverts the ratio on effective load', () => {
    const t: Target = { sets: 3, repMin: 8, repMax: 10, loadKg: 20 };
    // bw 80: 70 kg effective × 10 ≈ 16.7 reps at 60 kg effective → +6
    expect(bonusReps({ kind: 'work', loadKg: 10, reps: 10 }, t, 'assisted', 80)).toBe(6);
    expect(bonusReps({ kind: 'work', loadKg: 20, reps: 11 }, t, 'assisted', null)).toBe(1);
    expect(bonusReps({ kind: 'work', loadKg: 0, reps: 11 }, { ...t, loadKg: 90 }, 'assisted', 80)).toBe(1);
  });

  it('FR-WRK-3: meter counts goal sets per plan, gold on any bonus; unplanned ignored', () => {
    const prog = exerciseProgress(
      [
        set({ idx: 1, reps: 12 }),
        set({ idx: 2, reps: 9 }),
        set({ idx: 3, reps: 7 }),
        set({ kind: 'warmup', idx: 0 }),
      ],
      tgt,
      'barbell',
      false,
    );
    expect(prog).toMatchObject({
      goalMet: 2,
      logged: 3,
      bonusReps: 2,
      bonusSet: false,
      dots: ['bonus', 'met', 'missed'],
    });
    const other = exerciseProgress([set({ idx: 1 })], tgt, 'barbell', false);
    const meter = goalMeter([
      { target: tgt, progress: prog, planned: true },
      { target: tgt, progress: other, planned: true },
      { target: tgt, progress: other, planned: false },
    ]);
    expect(meter).toMatchObject({ done: 3, total: 6, bonus: true, bonusReps: 2 });
    expect(meter.segments).toEqual([true, true, false, true, false, false]);
  });

  it('FR-WRK-8: one extra set beyond the plan counts as a bonus set', () => {
    const prog = exerciseProgress(
      [1, 2, 3, 4, 5].map((i) => set({ idx: i })),
      tgt,
      'barbell',
      false,
    );
    expect(prog.goalMet).toBe(3);
    expect(prog.bonusSet).toBe(true);
    expect(goalMeter([{ target: tgt, progress: prog, planned: true }]).bonus).toBe(true);
  });

  it('FR-WRK-14: a unilateral goal set needs both sides', () => {
    const t: Target = { sets: 2, repMin: 8, repMax: 10, loadKg: 20 };
    const prog = exerciseProgress(
      [
        set({ idx: 1, side: 'L', loadKg: 20 }),
        set({ idx: 1, side: 'R', loadKg: 20, reps: 7 }),
        set({ idx: 2, side: 'L', loadKg: 20 }),
      ],
      t,
      'dumbbell',
      true,
    );
    expect(prog).toMatchObject({ goalMet: 0, logged: 1, dots: ['missed', null] });
    const ok = exerciseProgress(
      [set({ idx: 1, side: 'L', loadKg: 20 }), set({ idx: 1, side: 'R', loadKg: 20 })],
      t,
      'dumbbell',
      true,
    );
    expect(ok.goalMet).toBe(1);
  });
});

describe('rest timer (FR-TMR-1…4)', () => {
  const settings = { restCompoundSec: 120, restIsolationSec: 90 };

  it('FR-TMR-1: length comes from settings by role', () => {
    expect(restSecondsFor('compound', settings)).toBe(120);
    expect(restSecondsFor('isolation', settings)).toBe(90);
  });

  it('FR-TMR-2: computed from start timestamp + duration (survives backgrounding)', () => {
    const t = startTimer(1_000, 90);
    expect(remainingMs(t, 1_000)).toBe(90_000);
    expect(remainingMs(t, 61_000)).toBe(30_000);
    // app was backgrounded for 5 minutes
    expect(remainingMs(t, 301_000)).toBe(0);
    expect(isDone(t, 91_000)).toBe(true);
    expect(endsAt(t)).toBe(91_000);
  });

  it('FR-TMR-3: ±15 s, never below now', () => {
    const t = startTimer(0, 90);
    expect(remainingMs(adjust(t, 15_000, 10_000), 10_000)).toBe(95_000);
    expect(remainingMs(adjust(t, -15_000, 10_000), 10_000)).toBe(65_000);
    expect(remainingMs(adjust(t, -120_000, 10_000), 10_000)).toBe(0);
  });

  it('formats the clock', () => {
    expect(formatClock(84_000)).toBe('1:24');
    expect(formatClock(4_200)).toBe('0:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(720_000)).toBe('12:00');
  });
});

describe('rotation (FR-RTN-4)', () => {
  const routine = {
    sessions: ['Upper A', 'Lower A', 'Upper B', 'Lower B'].map((name, i) => ({ id: `r-${i}`, name })),
  };

  it('FR-RTN-4: up next, then completing a session advances the queue', () => {
    const q = { nextSessionIndex: 2 };
    expect(upNext(routine, q)).toMatchObject({ position: 2, total: 4, session: { name: 'Upper B' } });
    expect(advance(routine, q, 'r-2').nextSessionIndex).toBe(3);
    expect(advance(routine, { nextSessionIndex: 3 }, 'r-3').nextSessionIndex).toBe(0);
    expect(advance(routine, q, 'nope')).toBe(q);
  });

  it('FR-RTN-4: skip to any session; finishing it continues from there', () => {
    const q = skipTo(routine, { nextSessionIndex: 0 }, 3);
    expect(upNext(routine, q)!.session.name).toBe('Lower B');
    expect(advance(routine, q, 'r-3').nextSessionIndex).toBe(0);
    expect(skipTo({ sessions: [] }, q, 1)).toBe(q);
    expect(upNext({ sessions: [] }, q)).toBeNull();
  });

  it('reorder keeps the same session up next', () => {
    const q = reorder(routine, { nextSessionIndex: 1 }, 0, 3);
    expect(q.order).toEqual([1, 2, 3, 0]);
    expect(upNext(routine, q)!.session.name).toBe('Lower A');
    expect(rotationOrder(routine, { nextSessionIndex: 0, order: [0, 0, 1, 2] })).toEqual([0, 1, 2, 3]);
    expect(reorder(routine, q, 9, 0)).toBe(q);
  });
});

describe('weeks (FR-RTN-5, D27)', () => {
  const thu = new Date(2026, 8, 24, 18, 30).getTime(); // Thu 24 Sep 2026

  it('FR-RTN-5: the week starts Monday by default (configurable)', () => {
    expect(dateKey(startOfWeek(thu))).toBe('2026-09-21');
    expect(dateKey(startOfWeek(thu, 0))).toBe('2026-09-20');
    const [s, e] = weekRange(thu);
    expect(dateKey(s)).toBe('2026-09-21');
    expect(dateKey(e)).toBe('2026-09-28');
  });

  it('D27: week number counts from the anchor week', () => {
    const anchor = new Date(2026, 8, 8, 9).getTime(); // Tue 8 Sep
    expect(weekNumber(thu, anchor)).toBe(3);
    expect(weekNumber(anchor, anchor)).toBe(1);
  });

  it('date helpers', () => {
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
    expect(dateKey(addDays(thu, 7))).toBe('2026-10-01');
    expect(parseDateKey('2026-09-24').getDate()).toBe(24);
    const grid = monthGrid(thu);
    expect(grid.slice(0, 2)).toEqual([null, 1]); // 1 Sep 2026 is a Tuesday
    expect(grid.filter((d) => d !== null)).toHaveLength(30);
  });
});

describe('splits (FR-ONB-4, FR-RTN-1)', () => {
  it('FR-ONB-4: recommendRule', () => {
    expect(recommendSplit(2, 'beginner')).toBe('full-body');
    expect(recommendSplit(3, 'advanced')).toBe('full-body');
    expect(recommendSplit(4, 'intermediate')).toBe('upper-lower');
    expect(recommendSplit(5, 'intermediate')).toBe('ppl');
    expect(recommendSplit(5, 'advanced')).toBe('body-part');
    expect(recommendSplit(6, 'beginner')).toBe('ppl');
  });

  it('sessions per template; PPL at 6 days runs twice; custom starts blank', () => {
    expect(sessionsFor('upper-lower', 4).map((s) => s.name)).toEqual([
      'Upper A',
      'Lower A',
      'Upper B',
      'Lower B',
    ]);
    const ppl6 = sessionsFor('ppl', 6);
    expect(ppl6.map((s) => s.name)).toEqual(['Push', 'Pull', 'Legs', 'Push 2', 'Pull 2', 'Legs 2']);
    expect(ppl6[3]!.secondPass).toBe(true);
    expect(sessionsFor('ppl', 3)).toHaveLength(3);
    expect(sessionsFor('custom', 3).map((s) => s.name)).toEqual(['Day A', 'Day B', 'Day C']);
    expect(sessionsFor('nope', 3)).toEqual([]);
  });

  it('S03 helpers', () => {
    expect(shortName('Upper A')).toBe('Up A');
    expect(shortName('Lower B')).toBe('Lo B');
    expect(shortName('Full C')).toBe('Full');
    expect(shortName('Push')).toBe('Push');
    expect(weekLayout(4)).toEqual([true, true, false, true, true, false, false]);
    expect(weekLayout(3)).toEqual([true, false, true, false, true, false, false]);
    expect(previewDays(splitById('upper-lower')!, 3)).toBe(4);
    expect(previewDays(splitById('ppl')!, 4)).toBe(3);
    expect(previewDays(splitById('ppl')!, 6)).toBe(6);
    expect(previewDays(splitById('full-body')!, 5)).toBe(3);
  });
});

describe('session summary (FR-SUM-1, FR-XP-3)', () => {
  const exs = new Map([
    ['incline-dumbbell-press', ex('incline-dumbbell-press')],
    ['pull-up', ex('pull-up')],
    ['bench-press', ex('bench-press')],
    ['single-arm-dumbbell-row', ex('single-arm-dumbbell-row')],
  ]);

  it('FR-SUM-1: tonnage with bodyweight rules, sets, reps, duration', () => {
    const sets = [
      set({ exerciseId: 'incline-dumbbell-press', loadKg: 26, reps: 10 }),
      set({ exerciseId: 'incline-dumbbell-press', kind: 'warmup', loadKg: 12, reps: 8 }),
      set({ exerciseId: 'pull-up', loadKg: 0, reps: 8 }),
      set({ exerciseId: 'single-arm-dumbbell-row', loadKg: 30, reps: 10, side: 'L' }),
      set({ exerciseId: 'single-arm-dumbbell-row', loadKg: 30, reps: 10, side: 'R' }),
      set({ exerciseId: 'unknown' }),
    ];
    expect(sessionTotals(sets, exs, 80, 0, 52 * 60_000)).toEqual({
      tonnageKg: 520 + 640 + 1200,
      tonnageExcluded: false,
      workSets: 3,
      reps: 38,
      durationMin: 52,
    });
    expect(sessionTotals(sets, exs, null, 0, 1000).tonnageExcluded).toBe(true);
  });

  it('FR-XP-3: PR is a new best e1RM from a work set with reps ≥ repMin; first exposure is not a PR', () => {
    const prior = new Map([['bench-press', epley(80, 8)]]);
    const sets = [
      set({ loadKg: 82.5, reps: 8 }),
      set({ loadKg: 85, reps: 5 }),
      set({ loadKg: 90, reps: 3, kind: 'warmup' }),
      set({ exerciseId: 'incline-dumbbell-press', loadKg: 30, reps: 10 }),
    ];
    const prs = findPrs(sets, prior, exs, () => 6, null);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ exerciseId: 'bench-press', loadKg: 82.5, reps: 8 });
    expect(findPrs(sets, prior, exs, () => 9, null)).toEqual([]);
  });

  it('best e1RM per exercise ignores hurts sets', () => {
    const best = bestE1rmByExercise(
      [set({ loadKg: 100, reps: 5 }), set({ loadKg: 120, reps: 5, hurts: true })],
      exs,
      () => null,
    );
    expect(best.get('bench-press')).toBeCloseTo(epley(100, 5), 6);
  });

  it('D16 bonus percent and S05 minute estimate', () => {
    expect(bonusPercent(11, 15, 10)).toBe(7);
    expect(bonusPercent(0, 0, 10)).toBe(0);
    expect(
      estimateMinutes(
        [
          { role: 'compound', sets: 3 },
          { role: 'compound', sets: 3 },
          { role: 'compound', sets: 3 },
          { role: 'isolation', sets: 3 },
          { role: 'isolation', sets: 3 },
        ],
        { compound: 180, isolation: 120 },
      ),
    ).toBe(40);
  });
});

describe('search (FR-LIB-3, NFR-PERF-4)', () => {
  const index = buildIndex(
    EX,
    (e) => e.name,
    (e) => e.aliases,
  );
  const top = (q: string) => search(index, q, 5).map((h) => h.item.name);

  it('FR-LIB-3: name and alias, case- and punctuation-insensitive', () => {
    expect(top('Lat Pulldown')[0]).toBe('Lat Pulldown');
    expect(top('rdl')[0]).toBe('Romanian Deadlift');
    expect(top('skull crusher')).toContain('Lying Triceps Extension');
    expect(top('PULLUP')[0]).toBe('Pull-Up');
    expect(top('pull up')[0]).toBe('Pull-Up');
  });

  it('FR-LIB-3: prefix and multi-word prefix', () => {
    expect(top('incl db')).toContain('Incline Dumbbell Press');
    expect(top('leg ext')[0]).toBe('Leg Extension');
  });

  it('FR-LIB-3: tolerates one typo', () => {
    expect(top('romanain deadlift')).toContain('Romanian Deadlift');
    expect(top('bech press')).toContain('Bench Press');
    expect(top('pulldwn')).toContain('Lat Pulldown');
  });

  it('empty and unmatched queries return nothing', () => {
    expect(search(index, '  ')).toEqual([]);
    expect(search(index, 'zzzzqqqq')).toEqual([]);
  });

  it('reports the alias that matched', () => {
    expect(search(index, 'pendlay')[0]).toMatchObject({ viaAlias: 'pendlay row' });
  });

  it('NFR-PERF-4: under 100 ms for the whole library', () => {
    const t0 = performance.now();
    for (const q of ['row', 'press', 'curl', 'squat', 'bech', 'lat pull']) search(index, q);
    expect((performance.now() - t0) / 6).toBeLessThan(100);
  });

  it('helpers', () => {
    expect(normalize("Farmer's  Carry!")).toBe('farmers carry');
    expect(editDistance('bench', 'bech')).toBe(1);
    expect(editDistance('abcd', 'abdc')).toBe(1);
    expect(editDistance('abc', 'xyzzz')).toBe(2);
    expect(editDistance('press', 'curls')).toBeGreaterThan(1);
  });
});

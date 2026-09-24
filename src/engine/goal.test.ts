import { describe, expect, it } from 'vitest';
import {
  deltaIn,
  exposuresFrom,
  goalFor,
  initialState,
  progress,
  replay,
  setsByIdx,
  TIMED_RANGE,
  type Exposure,
} from './goal';
import { nudgeAfterSet } from './calibration';
import { kgToLb } from './units';
import type { Effort, Exercise, LoggedSet } from './types';

const profile = {
  experience: 'intermediate' as const,
  goal: 'build_muscle' as const,
  nudge: 0 as const,
  units: 'kg' as const,
};
const barbell: Pick<Exercise, 'role' | 'loadType' | 'incrementKg' | 'unilateral'> = {
  role: 'compound',
  loadType: 'barbell',
  incrementKg: 2.5,
  unilateral: false,
};
const dumbbell = { ...barbell, loadType: 'dumbbell' as const, incrementKg: 2 };
const stack = { ...barbell, loadType: 'machine_stack' as const, incrementKg: 5 };

let n = 0;
let day = 0;
/** One exposure: [load, reps, effort?][] */
function exp(
  rows: [number, number, Effort?][],
  opts: { deload?: boolean; hurts?: boolean; side?: boolean } = {},
): Exposure {
  day++;
  const sets: LoggedSet[] = rows.map(([loadKg, reps, effort], i) => ({
    id: `x${++n}`,
    sessionId: `s${day}`,
    exerciseId: 'e',
    idx: i + 1,
    kind: 'work',
    loadKg,
    reps,
    effort,
    hurts: !!opts.hurts && i === rows.length - 1,
    loggedAt: day * 1000 + i,
  }));
  return { at: day * 86_400_000, deload: !!opts.deload, sets };
}

describe('goal engine (FR-GOAL-1…5)', () => {
  it('FR-GOAL-2: prescription from intensity.json by level, goal and role', () => {
    expect(goalFor(barbell, [], profile)).toMatchObject({ sets: 3, repMin: 8, repMax: 10 });
    expect(goalFor({ ...barbell, role: 'isolation' }, [], profile)).toMatchObject({ repMin: 10, repMax: 12 });
  });

  it('FR-GOAL-4: no history → calibration: load empty, reason "first"', () => {
    const g = goalFor(barbell, [], profile);
    expect(g.loadKg).toBeNull();
    expect(g.calibration).toBe(true);
    expect(g.reason.code).toBe('first');
    expect(g.warmups).toEqual([]);
  });

  it('FR-GOAL-4: the first exposure sets the load from what was lifted', () => {
    const g = goalFor(
      barbell,
      [
        exp([
          [60, 10],
          [62.5, 9],
          [62.5, 7],
        ]),
      ],
      profile,
    );
    expect(g).toMatchObject({
      loadKg: 62.5,
      calibration: false,
      reason: { code: 'calibrated', loadKg: 62.5 },
    });
  });

  it('FR-GOAL-4: calibration with no set reaching repMin steps one increment down', () => {
    expect(
      goalFor(
        barbell,
        [
          exp([
            [80, 5],
            [80, 4],
          ]),
        ],
        profile,
      ).loadKg,
    ).toBe(77.5);
  });

  it('FR-GOAL-3: loads are rounded to the increment and respect lb users', () => {
    const lb = { ...profile, units: 'lb' as const };
    const first = exp([
      [61.235, 10],
      [61.235, 10],
      [61.235, 10],
    ]); // 135 lb
    const g = goalFor(
      barbell,
      [
        first,
        exp([
          [61.235, 10],
          [61.235, 10],
          [61.235, 10],
        ]),
      ],
      lb,
    );
    expect(kgToLb(g.loadKg!)).toBeCloseTo(140, 4);
    expect(deltaIn('lb', 2.268)).toBe(5);
    expect(deltaIn('kg', -2.5)).toBe(2.5);
  });

  it('FR-GOAL-1: warm-ups for the first compound per muscle', () => {
    const g = goalFor(
      barbell,
      [
        exp([
          [60, 10],
          [60, 10],
          [60, 10],
        ]),
      ],
      profile,
      { warmupEligible: true },
    );
    expect(g.warmups).toEqual([
      { loadKg: 30, reps: 8 },
      { loadKg: 45, reps: 4 },
    ]);
    expect(
      goalFor(barbell, [exp([[60, 10]])], profile, { warmupEligible: true, warmupsEnabled: false }).warmups,
    ).toEqual([]);
  });
});

describe('progression (FR-PRG-1…6)', () => {
  const base = exp([
    [60, 10],
    [60, 10],
    [60, 10],
  ]); // calibrates 60

  it('FR-PRG-1: evaluated after each exposure (not weekly)', () => {
    const s1 = replay(barbell, [base], profile);
    const s2 = replay(
      barbell,
      [
        base,
        exp([
          [60, 10],
          [60, 10],
          [60, 10],
        ]),
      ],
      profile,
    );
    expect(s1.target.loadKg).toBe(60);
    expect(s2.target.loadKg).toBe(62.5);
  });

  it('FR-PRG-2: adds one increment when all sets hit repMax', () => {
    const g = goalFor(
      barbell,
      [
        base,
        exp([
          [60, 10],
          [60, 11],
          [60, 10, 'solid'],
        ]),
      ],
      profile,
    );
    expect(g).toMatchObject({
      loadKg: 62.5,
      repMin: 8,
      repMax: 10,
      reason: { code: 'up', deltaKg: 2.5, reps: 10 },
    });
  });

  it("FR-PRG-2: doesn't add weight when the last set's effort was Hard", () => {
    const g = goalFor(
      barbell,
      [
        base,
        exp([
          [60, 10],
          [60, 10],
          [60, 10, 'hard'],
        ]),
      ],
      profile,
    );
    expect(g).toMatchObject({ loadKg: 60, reason: { code: 'hold_hard' } });
  });

  it('FR-PRG-2: big-jump rule raises repMax by 2 when the increment is > 5% of the load', () => {
    const first = exp([
      [55, 10],
      [55, 10],
      [55, 10],
    ]);
    const g1 = goalFor(
      stack,
      [
        first,
        exp([
          [55, 10],
          [55, 10],
          [55, 10],
        ]),
      ],
      profile,
    );
    expect(g1).toMatchObject({ loadKg: 55, repMax: 12, reason: { code: 'widen', reps: 12 } });
    // Then once every set reaches 12, the weight goes up and the range resets.
    const g2 = goalFor(
      stack,
      [
        first,
        exp([
          [55, 10],
          [55, 10],
          [55, 10],
        ]),
        exp([
          [55, 12],
          [55, 12],
          [55, 12],
        ]),
      ],
      profile,
    );
    expect(g2).toMatchObject({ loadKg: 60, repMin: 8, repMax: 10, reason: { code: 'up' } });
  });

  it('FR-PRG-3: all sets reached repMin but not repMax → hold, +1 rep on the weakest set', () => {
    const g = goalFor(
      barbell,
      [
        base,
        exp([
          [60, 10],
          [60, 9],
          [60, 8],
        ]),
      ],
      profile,
    );
    expect(g).toMatchObject({ loadKg: 60, reason: { code: 'hold_reps', reps: 9, set: 3 } });
  });

  it('FR-PRG-4: any set below repMin → hold; two misses in a row → −10% and reset to repMin', () => {
    const miss = () =>
      exp([
        [60, 9],
        [60, 8],
        [60, 6],
      ]);
    const g1 = goalFor(barbell, [base, miss()], profile);
    expect(g1).toMatchObject({ loadKg: 60, reason: { code: 'hold_miss', set: 3 } });
    const g2 = goalFor(barbell, [base, miss(), miss()], profile);
    expect(g2).toMatchObject({ loadKg: 55, repMin: 8, repMax: 10, reason: { code: 'down' } });
    expect(g2.reason.deltaKg).toBeCloseTo(-5, 6);
  });

  it('FR-PRG-4: a good session in between resets the miss streak', () => {
    const miss = () =>
      exp([
        [60, 9],
        [60, 8],
        [60, 6],
      ]);
    const g = goalFor(
      barbell,
      [
        base,
        miss(),
        exp([
          [60, 9],
          [60, 9],
          [60, 8],
        ]),
        miss(),
      ],
      profile,
    );
    expect(g.loadKg).toBe(60);
    expect(g.reason.code).toBe('hold_miss');
  });

  it('FR-PRG-4: −10% still drops at least one increment on light loads', () => {
    const light = exp([
      [10, 12],
      [10, 12],
      [10, 12],
    ]);
    const miss = () =>
      exp([
        [10, 5],
        [10, 5],
        [10, 5],
      ]);
    expect(goalFor(barbell, [light, miss(), miss()], profile).loadKg).toBe(7.5);
  });

  it('FR-PRG-5: assisted progresses by reducing assistance, and a double miss adds it back', () => {
    const assisted = { ...barbell, loadType: 'assisted' as const, incrementKg: 5 };
    const first = exp([
      [30, 10],
      [30, 10],
      [30, 10],
    ]);
    const g = goalFor(
      assisted,
      [
        first,
        exp([
          [30, 10],
          [30, 10],
          [30, 10],
        ]),
      ],
      profile,
    );
    expect(g).toMatchObject({ loadKg: 25, reason: { code: 'less_assist', deltaKg: 5 } });
    const miss = () =>
      exp([
        [30, 5],
        [30, 5],
        [30, 5],
      ]);
    expect(goalFor(assisted, [first, miss(), miss()], profile).loadKg).toBe(35);
    // Calibration takes the least assistance that reached repMin, or one step more if none did.
    expect(
      goalFor(
        assisted,
        [
          exp([
            [40, 5],
            [40, 4],
          ]),
        ],
        profile,
      ).loadKg,
    ).toBe(45);
  });

  it('FR-PRG-5: bodyweight progresses reps, then suggests bodyweight_plus at repMax + 3', () => {
    const bw = { ...barbell, loadType: 'bodyweight' as const, incrementKg: 0 };
    const hist: Exposure[] = [];
    let g = goalFor(bw, hist, profile);
    expect(g.loadKg).toBe(0);
    expect(g.calibration).toBe(false);
    for (let i = 0; i < 3; i++) {
      hist.push(
        exp([
          [0, g.repMax],
          [0, g.repMax],
          [0, g.repMax],
        ]),
      );
      g = goalFor(bw, hist, profile);
    }
    expect(g).toMatchObject({ repMin: 11, repMax: 13, reason: { code: 'more_reps', reps: 13 } });
    hist.push(
      exp([
        [0, 13],
        [0, 13],
        [0, 13],
      ]),
    );
    g = goalFor(bw, hist, profile);
    expect(g).toMatchObject({ suggestLoadType: 'bodyweight_plus', reason: { code: 'add_weight' } });
  });

  it('timed holds progress by +5 s', () => {
    const timed = { ...barbell, loadType: 'timed' as const, incrementKg: 0, role: 'isolation' as const };
    expect(initialState(timed, profile).target).toMatchObject({
      repMin: TIMED_RANGE[0],
      repMax: TIMED_RANGE[1],
    });
    const g = goalFor(
      timed,
      [
        exp([
          [0, 45],
          [0, 45],
          [0, 45],
        ]),
      ],
      profile,
    );
    expect(g).toMatchObject({ repMin: 35, repMax: 50 });
  });

  it('FR-PRG-6: "Hurts" freezes progression; one pain-free exposure clears it', () => {
    const hurt = exp(
      [
        [60, 10],
        [60, 10],
        [60, 10],
      ],
      { hurts: true },
    );
    const g1 = goalFor(barbell, [base, hurt], profile);
    expect(g1).toMatchObject({ loadKg: 60, frozen: true, reason: { code: 'frozen' } });
    const g2 = goalFor(
      barbell,
      [
        base,
        hurt,
        exp([
          [60, 10],
          [60, 10],
          [60, 10],
        ]),
      ],
      profile,
    );
    expect(g2).toMatchObject({ loadKg: 62.5, frozen: false });
  });

  it('fewer sets than planned holds the load', () => {
    const g = goalFor(
      barbell,
      [
        base,
        exp([
          [60, 10],
          [60, 10],
        ]),
      ],
      profile,
    );
    expect(g).toMatchObject({ loadKg: 60, reason: { code: 'hold_incomplete', set: 3 } });
  });

  it('a heavier load chosen in-session becomes the new baseline', () => {
    const g = goalFor(
      barbell,
      [
        base,
        exp([
          [65, 9],
          [65, 9],
          [65, 8],
        ]),
      ],
      profile,
    );
    expect(g).toMatchObject({ loadKg: 65, reason: { code: 'hold_reps' } });
  });

  it('FR-PRG-7: deload = 60% of the usual sets, same weights; deload exposures do not move the target', () => {
    const g = goalFor(barbell, [base], profile, { deload: true });
    expect(g).toMatchObject({ sets: 2, loadKg: 60, reason: { code: 'deload' } });
    const after = goalFor(
      barbell,
      [
        base,
        exp(
          [
            [60, 10],
            [60, 10],
          ],
          { deload: true },
        ),
      ],
      profile,
    );
    expect(after.loadKg).toBe(60);
    expect(after.reason.code).toBe('calibrated');
  });

  it('S24: an override replaces the target with its own reason', () => {
    const g = goalFor(barbell, [base], profile, { override: { sets: 4, repMin: 6, repMax: 8, loadKg: 70 } });
    expect(g).toMatchObject({ sets: 4, repMin: 6, repMax: 8, loadKg: 70, reason: { code: 'override' } });
  });

  it('D17: stalls after 3 exposures without load or rep gains, or after two misses', () => {
    const same = () =>
      exp([
        [60, 9],
        [60, 9],
        [60, 8],
      ]);
    expect(goalFor(barbell, [base, same(), same()], profile).stalled).toBe(false);
    expect(goalFor(barbell, [base, same(), same(), same()], profile).stalled).toBe(true);
  });

  it('FR-WRK-14: unilateral sets collapse to the weaker side', () => {
    const e = exp([
      [20, 10],
      [20, 10],
    ]);
    e.sets = [
      { ...e.sets[0]!, idx: 1, side: 'L', reps: 10 },
      { ...e.sets[1]!, idx: 1, side: 'R', reps: 8 },
    ];
    expect(setsByIdx(e.sets)).toEqual([{ idx: 1, loadKg: 20, reps: 8, effort: undefined, hurts: false }]);
  });

  it('ignores empty exposures and groups sets into exposures by session', () => {
    const s = initialState(barbell, profile);
    expect(progress(s, { at: 0, deload: false, sets: [] }, barbell, profile)).toBe(s);
    const e1 = exp([[60, 10]]);
    const e2 = exp([[62.5, 8]]);
    const sessions = new Map([
      [e1.sets[0]!.sessionId, { startedAt: 2, deload: false }],
      [e2.sets[0]!.sessionId, { startedAt: 1, deload: true }],
    ]);
    const exps = exposuresFrom([...e1.sets, ...e2.sets, { ...e1.sets[0]!, sessionId: 'gone' }], sessions);
    expect(exps.map((x) => x.at)).toEqual([1, 2]);
    expect(exps[0]!.deload).toBe(true);
  });
});

describe('in-session nudges (FR-WRK-9, §6.4)', () => {
  const t = { sets: 3, repMin: 8, repMax: 10 };

  it('§6.4: steps up when reps ≥ repMax + 2', () => {
    expect(nudgeAfterSet({ idx: 1, loadKg: 26, reps: 12 }, t, dumbbell, 'kg')).toEqual({
      dir: 1,
      loadKg: 28,
      fromSet: 1,
      why: 'reps_high',
    });
  });

  it('§6.4 / D3: steps up when effort is Easy and reps ≥ repMax', () => {
    expect(nudgeAfterSet({ idx: 1, loadKg: 26, reps: 10, effort: 'easy' }, t, dumbbell, 'kg')).toMatchObject({
      dir: 1,
      loadKg: 28,
      why: 'easy',
    });
    expect(nudgeAfterSet({ idx: 1, loadKg: 26, reps: 9, effort: 'easy' }, t, dumbbell, 'kg')).toBeNull();
  });

  it('§6.4: steps down when reps < repMin', () => {
    expect(nudgeAfterSet({ idx: 1, loadKg: 26, reps: 6 }, t, dumbbell, 'kg')).toMatchObject({
      dir: -1,
      loadKg: 24,
      why: 'reps_low',
    });
  });

  it('§6.4 / D2: never nudges on the last set', () => {
    expect(nudgeAfterSet({ idx: 2, loadKg: 26, reps: 14 }, t, dumbbell, 'kg')).not.toBeNull();
    expect(nudgeAfterSet({ idx: 3, loadKg: 26, reps: 14 }, t, dumbbell, 'kg')).toBeNull();
  });

  it('assisted steps reduce assistance; bodyweight and zero increments never nudge', () => {
    const assisted = { loadType: 'assisted' as const, incrementKg: 5 };
    expect(nudgeAfterSet({ idx: 1, loadKg: 30, reps: 12 }, t, assisted, 'kg')!.loadKg).toBe(25);
    expect(
      nudgeAfterSet({ idx: 1, loadKg: 0, reps: 12 }, t, { loadType: 'bodyweight', incrementKg: 0 }, 'kg'),
    ).toBeNull();
    expect(
      nudgeAfterSet({ idx: 1, loadKg: 0, reps: 5 }, t, { loadType: 'barbell', incrementKg: 2.5 }, 'kg'),
    ).toBeNull();
    expect(
      nudgeAfterSet({ idx: 1, loadKg: 20, reps: 12 }, t, { loadType: 'cable', incrementKg: 0 }, 'kg'),
    ).toBeNull();
  });

  it('works on the lb grid', () => {
    const nudge = nudgeAfterSet({ idx: 1, loadKg: 61.235, reps: 12 }, t, barbell, 'lb')!;
    expect(kgToLb(nudge.loadKg)).toBeCloseTo(140, 4);
  });
});

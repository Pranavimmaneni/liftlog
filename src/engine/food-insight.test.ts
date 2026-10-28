import { describe, expect, it } from 'vitest';
import { emptyNutrients, type Nutrients } from './food-types';
import { buildFoodIndex, foodTerms, searchFoods, type SearchableFood } from './food-search';
import { strengthChange, trainingDates, usualTrainingTime, volumeChange } from './training-link';
import { reviewPeriod, summarizeDay, topSources, type DayEntry, type DayTargets } from './food-review';
import { coachInsights, preLiftCarbs, suggestFoods, type CoachInput } from './coach';
import { fastState, fastStreak, trainingInFast, weekStrip } from './fasting';
import { dailyQuests, foodStreak, foodXp, weeklyQuest } from './food-quests';
import { macroTargets } from './macros';
import { microTargets } from './micros';
import { addDays, dateKey } from './week';

const n = (p: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...p });
const HOUR = 3_600_000;
const MON = new Date(2026, 9, 19).getTime(); // Monday 19 Oct 2026
const at = (day: number, h: number, m = 0) => new Date(2026, 9, 19 + day, h, m).getTime();

const TARGETS: DayTargets = {
  ...macroTargets({ kcal: 2950, weightKg: 78.4, goal: 'build_muscle', phase: 'gain' }),
  micros: microTargets({ sex: 'male', age: 29, kcal: 2950 }),
};

/** One food per 100 g carrying the day's whole intake, eaten at `h`. */
function entry(day: number, h: number, p: Partial<Nutrients>, name = 'Meal', meal = 'lunch'): DayEntry {
  return { foodId: `f:${name}`, name, meal, loggedAt: at(day, h), grams: 100, per100g: n(p) };
}

describe('food search (FR-FOOD-3, NFR-PERF-5)', () => {
  const foods: (SearchableFood & { kind: string })[] = [
    { id: 'in:paneer-bhurji', name: 'Paneer bhurji', aliases: ['scrambled paneer'], kind: 'indian' },
    { id: 'in:palak-paneer', name: 'Palak paneer', aliases: ['saag paneer'], kind: 'indian' },
    { id: 'g:1', name: 'Chicken breast, grilled', aliases: [], kind: 'generic' },
    {
      id: 'b:1',
      name: 'Nonfat Greek Yogurt',
      brand: 'Kirkland Signature',
      aliases: ['curd', 'dahi'],
      kind: 'branded',
    },
    { id: 'c:1', name: 'Paneer, homemade', aliases: [], kind: 'custom' },
  ];
  const index = buildFoodIndex(foods);

  it('FR-FOOD-3: terms cover name, brand and aliases, normalised', () => {
    expect(foodTerms(foods[3]!)).toEqual([
      'nonfat',
      'greek',
      'yogurt',
      'kirkland',
      'signature',
      'curd',
      'dahi',
    ]);
  });

  it('FR-FOOD-3: prefix words, brand words, aliases and one typo all match', () => {
    expect(searchFoods(index, 'chick bre').map((h) => h.food.id)).toEqual(['g:1']);
    expect(searchFoods(index, 'kirkland yogurt')[0]!.food.id).toBe('b:1');
    expect(searchFoods(index, 'dahi')[0]!.food.id).toBe('b:1');
    expect(searchFoods(index, 'paner bhurji')[0]!.food.id).toBe('in:paneer-bhurji');
    expect(searchFoods(index, 'pizza')).toEqual([]);
    expect(searchFoods(index, '  ')).toEqual([]);
  });

  it('FR-FOOD-3: name matches beat alias matches; own foods rank first with a boost', () => {
    // "paneer …" names start with the query (90), "Palak paneer" only has the word (80).
    expect(searchFoods(index, 'paneer').map((h) => h.food.id)).toEqual([
      'in:paneer-bhurji',
      'c:1',
      'in:palak-paneer',
    ]);
    const boosted = searchFoods(index, 'paneer', { boost: (id) => (id.startsWith('c:') ? 30 : 0) });
    expect(boosted[0]!.food.id).toBe('c:1');
  });

  it('NFR-PERF-5: a query over 30,000 foods with ~20,000 distinct words takes under 150 ms', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const word = () =>
      Array.from(
        { length: 4 + Math.floor(rnd() * 5) },
        () => 'abcdefghijklmnoprstuvwy'[Math.floor(rnd() * 23)],
      ).join('');
    const vocab = Array.from({ length: 20_000 }, word);
    const big = Array.from({ length: 30_000 }, (_, i) => ({
      id: `g:${i}`,
      name: Array.from(
        { length: 3 + Math.floor(rnd() * 3) },
        () => vocab[Math.floor(rnd() * vocab.length)],
      ).join(' '),
      aliases: [],
    }));
    big.push({ id: 'g:target', name: 'Chicken tikka masala', aliases: [] });
    const idx = buildFoodIndex(big);
    const queries = [
      'chicken tik',
      'chiken tikka',
      'masala',
      vocab[5]!.slice(0, 3),
      `${vocab[9]} ${vocab[11]!.slice(0, 2)}`,
    ];
    let worst = 0;
    for (const q of queries) {
      const t0 = performance.now();
      searchFoods(idx, q);
      worst = Math.max(worst, performance.now() - t0);
    }
    expect(searchFoods(idx, 'chiken tikka')[0]!.food.id).toBe('g:target');
    expect(worst).toBeLessThan(150);
  });
});

describe('training link (FR-COACH-3, FR-SHR-1)', () => {
  const sessions = [
    { startedAt: at(0, 18, 30), endedAt: at(0, 19, 30), volumeKg: 5000 },
    { startedAt: at(2, 18, 0), endedAt: at(2, 19), volumeKg: 5400 },
    { startedAt: at(4, 19, 0), endedAt: at(4, 20), volumeKg: 5400 },
    { startedAt: at(7, 18, 30), endedAt: at(7, 19, 30), volumeKg: 5500 },
    { startedAt: at(9, 18, 30), endedAt: at(9, 19, 30), volumeKg: 6000 },
    { startedAt: at(10, 7, 0) }, // still open: ignored
  ];

  it('FR-COACH-3: usual training time is the median start of recent finished sessions', () => {
    expect(usualTrainingTime(sessions, at(11, 12))).toBe(18 * 60 + 30);
    expect(usualTrainingTime(sessions.slice(0, 2), at(11, 12))).toBeNull();
  });

  it('FR-COACH-3: training dates, volume change and strength change', () => {
    expect([...trainingDates(sessions, MON, addDays(MON, 7))]).toEqual([
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
    ]);
    expect(volumeChange(sessions, addDays(MON, 7), addDays(MON, 14))).toBeCloseTo(11500 / 15800 - 1);
    expect(volumeChange(sessions, MON, addDays(MON, 7))).toBeNull();
    expect(
      strengthChange(
        [
          { at: at(0, 1), value: 100 },
          { at: at(5, 1), value: 105 },
        ],
        MON,
        addDays(MON, 7),
      ),
    ).toBeCloseTo(0.05);
    expect(strengthChange([{ at: at(0, 1), value: 100 }], MON, addDays(MON, 7))).toBeNull();
  });
});

/** The F06 mockup's week: on target 4 of 7, protein short on 3 of 4 training days, carbs before every session. */
function mockWeek() {
  const training = new Set([0, 2, 4, 6]);
  return Array.from({ length: 7 }, (_, d) => {
    const proteinG = training.has(d) && d !== 6 ? 110 : 140;
    const kcal = d === 5 ? 2400 : 2900;
    const entries = [
      entry(
        d,
        8,
        {
          kcal: kcal / 2,
          protein: proteinG / 2,
          carbs: 200,
          fat: 35,
          fibre: 15,
          vitD: 2,
          iron: d < 3 ? 3 : null,
          sodium: 1200,
        },
        'Poha',
        'breakfast',
      ),
      entry(
        d,
        16,
        { kcal: kcal / 2, protein: proteinG / 2, carbs: 220, fat: 35, fibre: 14, vitD: 3.5, sodium: 900 },
        'Dal chawal',
        'snacks',
      ),
    ];
    return summarizeDay(dateKey(addDays(MON, d)), entries, TARGETS);
  });
}

describe('food review (FR-NUT-1, FR-NUT-2)', () => {
  it('FR-NUT-1: on target = calories within 10% and protein at least 90%', () => {
    const days = mockWeek();
    expect(days.map((d) => d.onTarget)).toEqual([false, true, false, true, false, false, true]);
    expect(days[0]!.meals).toBe(2);
    expect(summarizeDay('2026-10-26', [], TARGETS).onTarget).toBe(false);
  });

  it('FR-NUT-2: averages over logged days; micros judged on known values only', () => {
    const r = reviewPeriod([...mockWeek(), summarizeDay('2026-10-26', [], TARGETS)]);
    expect(r.loggedDays).toBe(7);
    expect(r.daysOnTarget).toBe(3);
    expect(r.micros.iron.knownDays).toBe(3);
    expect(r.micros.vitD.avgPct).toBeCloseTo(5.5 / 15);
    expect(r.micros.magnesium.avgPct).toBeNull();
    expect(r.low[0]).toBe('vitD');
    expect(r.low).toContain('iron');
    expect(r.over).toEqual([]);
    expect(r.avgPct.protein).toBeCloseTo((3 * 110 + 4 * 140) / 7 / 140);
  });

  it('FR-NUT-2: top sources merge by food', () => {
    expect(topSources(mockWeek(), 'carbs', 1)).toEqual([
      { foodId: 'f:Dal chawal', name: 'Dal chawal', amount: 1540 },
    ]);
  });
});

describe('combined coach (FR-COACH-1, FR-COACH-2)', () => {
  const candidates = [
    { id: 'c:eggs', per100g: n({ protein: 13, vitD: 2 }), portion: { label: '2 eggs', grams: 100 } },
    {
      id: 'in:paneer-bhurji',
      per100g: n({ protein: 12, carbs: 6 }),
      portion: { label: '1 katori', grams: 150 },
    },
    { id: 'g:banana', per100g: n({ protein: 1, carbs: 23 }), portion: { label: '1 banana', grams: 118 } },
  ];
  const base = (): CoachInput => {
    const days = mockWeek();
    return {
      days,
      review: reviewPeriod(days),
      trainingDates: new Set(['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-25']),
      sessionStarts: [at(0, 18, 30), at(2, 18, 30), at(4, 18, 30), at(6, 18, 30)],
      volumeChange: 0.08,
      strengthChange: 0.02,
      trendKgPerWeek: 0.2,
      trendWeeks: 4,
      bodyweightKg: 78.4,
      phase: 'gain',
      rateKgPerWeek: 0.25,
      candidates,
    };
  };

  it('FR-COACH-1: suggestions rank by amount per portion', () => {
    expect(suggestFoods(candidates, 'protein')).toEqual(['in:paneer-bhurji', 'c:eggs']);
    expect(suggestFoods(candidates, 'vitD', 5)).toEqual(['c:eggs']);
  });

  it('FR-COACH-1: carbs counted in the 3 hours before each session', () => {
    // 18:30 counts the 16:00 snack; 10:00 counts the 8:00 breakfast; 12:30 is 4.5 h after breakfast.
    expect(preLiftCarbs(mockWeek(), [at(0, 18, 30), at(0, 10), at(0, 12, 30)])).toEqual([220, 200, 0]);
  });

  it('FR-COACH-2: the F06 week: protein short on training days, carbs before every session', () => {
    const r = coachInsights(base());
    expect(r.needsWork).toEqual({
      id: 'protein-short-training',
      data: { short: 3, trainingDays: 4, volumePct: 8 },
      fix: { kind: 'suggest-foods', nutrient: 'protein', foodIds: ['in:paneer-bhurji', 'c:eggs'] },
    });
    expect(r.goingWell).toEqual({ id: 'pre-lift-carbs-good', data: { sessions: 4 } });
    expect(r.all.map((x) => x.id)).toContain('micro-low');
  });

  it('FR-COACH-1: low carbs before training, a flat gain and a micro gap each have a fix', () => {
    const i = base();
    i.sessionStarts = [at(0, 12, 30), at(2, 12, 30)]; // nothing eaten 9:30–12:30
    i.trendKgPerWeek = 0.01;
    const ids = coachInsights(i).all.map((x) => [x.id, x.fix?.kind]);
    expect(ids).toEqual(
      expect.arrayContaining([
        ['pre-lift-carbs-low', 'suggest-foods'],
        ['gain-flat', 'raise-kcal'],
        ['micro-low', 'suggest-foods'],
      ]),
    );
  });

  it('FR-COACH-1: losing over 1% a week while strength drops suggests a slower rate', () => {
    const i = {
      ...base(),
      phase: 'lose' as const,
      rateKgPerWeek: 0.75,
      trendKgPerWeek: -0.9,
      strengthChange: -0.03,
    };
    const fast = coachInsights(i).all.find((x) => x.id === 'loss-too-fast')!;
    expect(fast.fix).toEqual({ kind: 'slow-rate', to: 0.5 });
  });

  it('FR-COACH-2: weight on track and protein on target are "Going well"', () => {
    const i = base();
    i.sessionStarts = [];
    expect(coachInsights(i).goingWell?.id).toBe('weight-on-track');
  });
});

describe('fasting timer (FR-FAST-1)', () => {
  const f = { startedAt: at(4, 20), planHours: 16 };

  it('FR-FAST-1: elapsed and remaining come from timestamps', () => {
    const s = fastState(f, at(5, 10, 20));
    expect(s.elapsedMs).toBe(14 * HOUR + 20 * 60_000);
    expect(s.remainingMs).toBe(HOUR + 40 * 60_000);
    expect(s.done).toBe(false);
    expect(s.eatFrom).toBe(at(5, 12));
  });

  it('FR-FAST-1: "4 in a row" and the week strip count fasts of 12 h or more', () => {
    const done = [0, 1, 2, 3].map((d) => ({
      startedAt: at(d - 1, 20),
      endedAt: at(d, 12 + (d === 1 ? 1 : 0)),
      planHours: 16,
    }));
    const short = { startedAt: at(-3, 20), endedAt: at(-2, 2), planHours: 16 };
    expect(fastStreak([...done, short], at(4, 9))).toBe(4);
    expect(weekStrip([...done, short], MON).map((x) => x.hours)).toEqual([16, 17, 16, 16, null, null, null]);
  });

  it('FR-FAST-1: says when the usual training time falls inside the fast', () => {
    expect(trainingInFast({ startedAt: at(0, 2), planHours: 18 }, 18 * 60 + 30, at(0, 9))).toBe(true);
    expect(trainingInFast(f, 18 * 60 + 30, at(5, 9))).toBe(false);
    expect(trainingInFast(f, null, at(5, 9))).toBe(false);
  });
});

describe('food quests and streak (FR-GAME-1)', () => {
  it('FR-GAME-1: protein quest is done in range (90–120%), not for eating more', () => {
    const day = (g: number) =>
      summarizeDay('2026-10-27', [entry(8, 8, { protein: g, carbs: 40, fibre: 41 })], TARGETS);
    expect(dailyQuests(day(130), null).map((q) => [q.id, q.done])).toEqual([
      ['protein', true],
      ['fibre', true],
    ]);
    expect(dailyQuests(day(180), null)[0]!.done).toBe(false);
    expect(dailyQuests(day(100), null)[0]!.done).toBe(false);
  });

  it('FR-GAME-1: the pre-lift quest appears with a training time', () => {
    const d = summarizeDay('2026-10-19', [entry(0, 16, { carbs: 45 })], TARGETS);
    const q = dailyQuests(d, at(0, 18, 30));
    expect(q.map((x) => x.id)).toEqual(['protein', 'pre-lift-carbs', 'fibre']);
    expect(q[1]).toMatchObject({ progress: 45, goal: 30, done: true, xp: 20 });
  });

  it('FR-GAME-1: weekly quest and derived XP', () => {
    const week = mockWeek();
    expect(weeklyQuest(week)).toMatchObject({ progress: 4, goal: 5, done: false });
    const xp = foodXp(
      week.map((day) => ({ day, sessionStart: null })),
      [week],
    );
    expect(xp).toBe(4 * 40);
  });

  it('FR-GAME-1: food streak counts days with 2+ meals, today optional', () => {
    const prev = (d: string) => dateKey(addDays(new Date(`${d}T12:00:00`).getTime(), -1));
    const meals = new Map([
      ['2026-10-23', 3],
      ['2026-10-24', 2],
      ['2026-10-25', 2],
      ['2026-10-26', 2],
      ['2026-10-27', 1],
    ]);
    expect(foodStreak(meals, '2026-10-27', prev)).toBe(4);
    meals.set('2026-10-27', 2);
    expect(foodStreak(meals, '2026-10-27', prev)).toBe(5);
  });
});

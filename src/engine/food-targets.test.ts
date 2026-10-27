import { describe, expect, it } from 'vitest';
import { emptyNutrients, normalizeGtin, decodeRow, encodeRow, NUTRIENTS, type Nutrients } from './food-types';
import { kcalFromMacros, recipePer100g, scale, sumNutrients } from './nutrition';
import { activityFactor, bmr, energyTarget } from './energy';
import { applyOverrides, macroTargets } from './macros';
import { microTargets, overLimit } from './micros';
import { adaptiveTarget, estimateExpenditure, trendRatePerWeek, trendWeights } from './adaptive';

const NOW = new Date(2026, 9, 27, 12).getTime();
const n = (p: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...p });

/** The mockups' sample person (F05): 78.4 kg, 178 cm, born 1997, light activity, 4 lifts a week, slow gain. */
const PRANAV = {
  weightKg: 78.4,
  sex: 'male' as const,
  birthYear: 1997,
  heightCm: 178,
  activity: 'light' as const,
  sessionsPerWeek: 4,
  phase: 'gain' as const,
  rateKgPerWeek: 0.25,
  now: NOW,
};

describe('food data format (FR-FOOD-1, FR-FOOD-4)', () => {
  it('FR-FOOD-1: compact rows round-trip, unknown stays null', () => {
    const f = {
      id: 'b:1',
      name: 'Greek yogurt',
      brand: 'Kirkland Signature',
      aliases: ['curd'],
      source: 'branded' as const,
      per100g: n({ kcal: 59, protein: 10, calcium: null }),
      portions: [{ label: '1 cup', grams: 227 }],
      gtin: '00096619871234',
    };
    expect(decodeRow(encodeRow(f), NUTRIENTS, 'branded')).toEqual(f);
  });

  it('FR-FOOD-4: barcodes of 8, 12 and 13 digits match as 14 digits', () => {
    expect(normalizeGtin('012345678905')).toBe('00012345678905');
    expect(normalizeGtin('8901234567890')).toBe('08901234567890');
    expect(normalizeGtin('123')).toBeNull();
  });
});

describe('nutrition (FR-DIARY-2, FR-FOOD-5)', () => {
  it('FR-DIARY-2: scales per-100 g values to a portion', () => {
    const s = scale(n({ kcal: 193, protein: 12 }), 150);
    expect(s.kcal).toBeCloseTo(289.5);
    expect(s.protein).toBeCloseTo(18);
    expect(s.iron).toBeNull();
  });

  it('FR-DIARY-2: totals keep unknown apart from zero and count what is known', () => {
    const t = sumNutrients([
      { per100g: n({ kcal: 100, iron: 2 }), grams: 100 },
      { per100g: n({ kcal: 50, iron: null }), grams: 200 },
    ]);
    expect(t.total.kcal).toBe(200);
    expect(t.total.iron).toBe(2);
    expect(t.known.iron).toBe(1);
    expect(t.total.vitD).toBeNull();
    expect(t.items).toBe(2);
  });

  it('FR-FOOD-5: a recipe divides summed ingredients by the cooked yield', () => {
    const per100g = recipePer100g(
      [
        { per100g: n({ kcal: 350, protein: 24 }), grams: 100 }, // dry dal
        { per100g: n({ kcal: 0, protein: 0 }), grams: 300 }, // water
      ],
      320,
    );
    expect(per100g.kcal).toBeCloseTo((350 / 320) * 100);
    expect(per100g.protein).toBeCloseTo((24 / 320) * 100);
    expect(per100g.iron).toBeNull();
    expect(recipePer100g([], 100).kcal).toBeNull();
  });

  it('kcal from macros (4/4/9)', () => {
    expect(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 })).toBe(165);
    expect(kcalFromMacros({ protein: 10, carbs: null, fat: 5 })).toBeNull();
  });
});

describe('energy target (FR-TGT-1, FR-TGT-2)', () => {
  it('FR-TGT-2: Mifflin-St Jeor', () => {
    expect(bmr(78.4, 178, 29, 'male')).toBeCloseTo(1756.5);
    expect(bmr(60, 160, 30, 'female')).toBeCloseTo(1289);
  });

  it('FR-TGT-2: each weekly session raises the activity factor, up to the cap', () => {
    expect(activityFactor('light', 4)).toBeCloseTo(1.535);
    expect(activityFactor('very', 10)).toBe(1.9);
  });

  it('FR-TGT-2: the sample person gets 2,950 kcal: burns about 2,700, plus 250 to gain slowly', () => {
    const t = energyTarget(PRANAV);
    expect(t.kcal).toBe(2950);
    expect(t.burn).toBe(2700);
    expect(t.adjust).toBe(250);
    expect(t.floored).toBe(false);
    expect(t.defaults).toEqual([]);
  });

  it('FR-TGT-2: a deficit is capped at 25% of burn, and the floor wins', () => {
    const t = energyTarget({
      weightKg: 60,
      sex: 'female',
      birthYear: 1996,
      heightCm: 160,
      activity: 'desk',
      sessionsPerWeek: 0,
      phase: 'lose',
      rateKgPerWeek: 0.75,
      now: NOW,
    });
    expect(t.kcal).toBe(1200);
    expect(t.floored).toBe(true);
  });

  it('FR-TGT-1: missing inputs fall back to defaults and are named', () => {
    const t = energyTarget({
      weightKg: 70,
      sessionsPerWeek: 3,
      phase: 'maintain',
      rateKgPerWeek: 0,
      now: NOW,
    });
    expect(t.defaults).toEqual(['age', 'height', 'activity', 'sex']);
    expect(t.kcal).toBeGreaterThan(1500);
  });
});

describe('macro targets (FR-TGT-3, FR-TGT-6)', () => {
  const base = { kcal: 2950, weightKg: 78.4, goal: 'build_muscle' as const, phase: 'gain' as const };

  it('FR-TGT-3: 1.8 g/kg protein, fat floor, carbs the rest, fibre 14 g per 1,000 kcal', () => {
    expect(macroTargets(base)).toEqual({ kcal: 2950, protein: 140, carbs: 440, fat: 70, fibre: 41 });
  });

  it('FR-TGT-3: more protein when losing', () => {
    expect(macroTargets({ ...base, kcal: 2200, phase: 'lose' }).protein).toBe(170);
  });

  it('FR-TGT-6: training days get more carbs, rest days fewer', () => {
    const lift = macroTargets({ ...base, trainingDay: true });
    const rest = macroTargets({ ...base, trainingDay: false });
    expect(lift.carbs).toBe(500);
    expect(lift.kcal).toBe(3190);
    expect(rest.carbs).toBe(380);
    expect(rest.kcal).toBe(2710);
  });

  it('FR-TGT-6: overrides keep the parts adding up; none = the coach’s pick', () => {
    const coach = macroTargets(base);
    expect(applyOverrides(coach, {})).toEqual({ ...coach, overridden: [] });
    const k = applyOverrides(coach, { kcal: 2700 });
    expect(k.carbs).toBe(380); // (2,700 − 560 − 630) / 4 = 377.5, to the nearest 5 g
    expect(k.overridden).toEqual(['kcal']);
    const p = applyOverrides(coach, { protein: 160 });
    expect(p.kcal).toBe(160 * 4 + 440 * 4 + 70 * 9);
  });
});

describe('micro targets (FR-TGT-4)', () => {
  it('FR-TGT-4: men 19–30, fibre from energy, sodium is a limit', () => {
    const t = microTargets({ sex: 'male', age: 29, kcal: 2950 });
    expect(t.fibre.value).toBe(41);
    expect(t.sodium).toEqual({ value: 2300, kind: 'limit' });
    expect(t.potassium.value).toBe(3400);
    expect(t.iron).toEqual({ value: 8, kind: 'target', ul: 45 });
    expect(t.magnesium.value).toBe(400);
    expect(t.vitD.value).toBe(15);
    expect(t.b12.value).toBe(2.4);
  });

  it('FR-TGT-4: women 19–50 need more iron; no sex uses the lower value', () => {
    expect(microTargets({ sex: 'female', age: 35 }).iron.value).toBe(18);
    const u = microTargets({ age: 29 });
    expect(u.iron.value).toBe(8);
    expect(u.potassium.value).toBe(2600);
    expect(u.fibre.value).toBe(25);
  });

  it('FR-TGT-4: flags intake over the sodium limit or an upper limit', () => {
    const t = microTargets({ sex: 'male', age: 29 });
    expect(overLimit(n({ sodium: 2500, iron: 50, calcium: null }), t)).toEqual(['sodium', 'iron']);
  });
});

describe('adaptive expenditure (FR-TGT-5)', () => {
  const days = (count: number) =>
    Array.from({ length: count }, (_, i) => {
      const d = new Date(2026, 9, 1 + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

  it('FR-TGT-5: the trend smooths daily swings', () => {
    const t = trendWeights([
      { date: '2026-10-01', kg: 80 },
      { date: '2026-10-02', kg: 82 },
      { date: '2026-10-03', kg: 79 },
    ]);
    expect(t.map((w) => w.kg)).toEqual([80, 80.2, expect.closeTo(80.08, 5)]);
    expect(trendRatePerWeek(t.slice(0, 1))).toBeNull();
  });

  it('FR-TGT-5: losing on 2,500 kcal means burning more than 2,500', () => {
    const dates = days(28);
    const weighIns = dates.map((date, i) => ({ date, kg: 80 - (0.5 * i) / 27 }));
    const intake = dates.map((date) => ({ date, kcal: 2500 }));
    const est = estimateExpenditure(intake, weighIns)!;
    expect(est.loggedDays).toBe(28);
    expect(est.spanDays).toBe(27);
    expect(est.burn).toBeGreaterThan(2500);
    expect(est.trendKgPerWeek).toBeLessThan(0);
  });

  it('FR-TGT-5: needs 3 weeks and 14 logged days', () => {
    const dates = days(15);
    expect(
      estimateExpenditure(
        dates.map((date) => ({ date, kcal: 2500 })),
        dates.map((date) => ({ date, kg: 80 })),
      ),
    ).toBeNull();
    const long = days(28);
    expect(
      estimateExpenditure(
        long.slice(0, 10).map((date) => ({ date, kcal: 2500 })),
        long.map((date) => ({ date, kg: 80 })),
      ),
    ).toBeNull();
  });

  it('FR-TGT-5: offers a new target only when it moves by more than 100 kcal', () => {
    const est = { burn: 2700, avgIntake: 2700, loggedDays: 20, spanDays: 21, trendKgPerWeek: 0 };
    expect(adaptiveTarget({ kcal: 2950, adjust: 250 }, est)).toBeNull();
    expect(adaptiveTarget({ kcal: 2950, adjust: 250 }, { ...est, burn: 2900 })).toBe(3150);
    expect(adaptiveTarget({ kcal: 2950, adjust: 250 }, null)).toBeNull();
  });
});

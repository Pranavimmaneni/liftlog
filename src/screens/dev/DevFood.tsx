import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { en } from '@/copy/en';
import { db } from '@/db/schema';
import { importLibrary, LIBRARY_MANIFEST, searchableFoods } from '@/db/food-lib';
import { buildFoodIndex, searchFoods, type FoodIndex } from '@/engine/food-search';
import { energyTarget } from '@/engine/energy';
import { macroTargets } from '@/engine/macros';
import { microTargets } from '@/engine/micros';
import { scale } from '@/engine/nutrition';
import { MICROS, type FoodItem } from '@/engine/food-types';

/** The F05 mockup's sample person, so the numbers can be checked against the design. */
const SAMPLE = {
  weightKg: 78.4,
  sex: 'male' as const,
  birthYear: 1997,
  heightCm: 178,
  activity: 'light' as const,
  sessionsPerWeek: 4,
  phase: 'gain' as const,
  rateKgPerWeek: 0.25,
};

/**
 * /dev/food: the M10 phone check for the food library (PRD-1.2 FR-FOOD-1..3, NFR-PERF-5, NFR-OFF-3)
 * and the target engines (FR-TGT-2..4). Dev only, like /dev/poses (DECISIONS D33).
 */
export default function DevFood() {
  const stored = useLiveQuery(async () => ({
    rows: await db.foodLib.count(),
    v: ((await db.meta.get('foodLibVersion'))?.value as string | undefined) ?? '–',
  }));
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [index, setIndex] = useState<FoodIndex<FoodItem> | null>(null);
  // `?subset=indian` imports one small chunk: Playwright's WebKit on Windows writes IndexedDB too
  // slowly for the full library (D58, D113). The version gets a suffix so a later full import runs.
  const [params] = useSearchParams();
  const subset = params.get('subset');
  const manifest =
    LIBRARY_MANIFEST && subset
      ? {
          v: `${LIBRARY_MANIFEST.v}+${subset}`,
          chunks: LIBRARY_MANIFEST.chunks.filter((c) => c.source === subset),
        }
      : LIBRARY_MANIFEST;
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!stored?.rows) return;
    void searchableFoods().then((foods) => setIndex(buildFoodIndex(foods)));
  }, [stored?.rows]);

  const result = useMemo(() => {
    if (!index || !q.trim()) return null;
    const t0 = performance.now();
    const hits = searchFoods(index, q, { limit: 30 });
    return { hits, ms: performance.now() - t0 };
  }, [index, q]);

  const targets = useMemo(() => {
    const now = Date.now();
    const energy = energyTarget({ ...SAMPLE, now });
    const macros = macroTargets({
      kcal: energy.kcal,
      weightKg: SAMPLE.weightKg,
      goal: 'build_muscle',
      phase: SAMPLE.phase,
    });
    const micros = microTargets({
      sex: SAMPLE.sex,
      age: new Date(now).getFullYear() - SAMPLE.birthYear,
      kcal: energy.kcal,
    });
    return { energy, macros, micros };
  }, []);

  return (
    <main className="pb-10">
      <ScreenHeader title={en.dev.food} subtitle="/dev/food" backTo="/" />
      <section className="px-5 pt-3">
        <p className="t-label" data-testid="food-lib-status">
          {LIBRARY_MANIFEST ? en.dev.foodLibrary(stored?.v ?? '–', stored?.rows ?? 0) : en.dev.foodNoLibrary}
        </p>
        {LIBRARY_MANIFEST && (
          <Button
            variant="secondary"
            className="mt-3"
            disabled={!!progress}
            onClick={async () => {
              setProgress([0, 1]);
              try {
                await importLibrary({ manifest, onProgress: (d, t) => setProgress([d, t]) });
              } finally {
                setProgress(null);
              }
            }}
          >
            {progress ? en.dev.foodImporting(progress[0], progress[1]) : en.dev.foodImport}
          </Button>
        )}
      </section>

      <section className="px-5 pt-5">
        <input
          className="ll-input w-full"
          type="search"
          aria-label={en.dev.foodSearch}
          placeholder={en.dev.foodSearch}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {result && (
          <>
            <p className="t-label pt-2" data-testid="food-search-time">
              {en.dev.foodTook(result.ms, result.hits.length)}
            </p>
            <ul className="mt-2 divide-y divide-rule border-y border-rule" data-testid="food-results">
              {result.hits.map(({ food }) => {
                const p = food.portions[0]!;
                const kcal = scale(food.per100g, p.grams).kcal;
                return (
                  <li key={food.id} className="flex items-baseline justify-between gap-3 py-2 text-[14px]">
                    <span>
                      <b>{food.name}</b>
                      <span className="block text-[12px] text-ink2">
                        {[food.brand, food.source, p.label].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="t-mono shrink-0">{kcal === null ? '–' : Math.round(kcal)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="px-5 pt-6" data-testid="food-targets">
        <h2 className="t-label">{en.dev.foodTargets}</h2>
        <p className="t-mono pt-2 text-[13px] leading-6">
          kcal {targets.macros.kcal} (burn {targets.energy.burn}, {targets.energy.adjust >= 0 ? '+' : ''}
          {targets.energy.adjust})<br />P {targets.macros.protein} g · C {targets.macros.carbs} g · F{' '}
          {targets.macros.fat} g · fibre {targets.macros.fibre} g
          <br />
          {MICROS.map((k) => `${k} ${targets.micros[k].value}`).join(' · ')}
        </p>
      </section>
    </main>
  );
}

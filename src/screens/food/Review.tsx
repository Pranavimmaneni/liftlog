import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { SectionSwitch } from '@/components/SectionSwitch';
import { en } from '@/copy/en';
import { monthName, shortDate } from '@/copy/format';
import { defaultReviewTime } from '@/db/insight';
import { getRawSetting, setRawSetting, useSettings } from '@/db/settings';
import { saveProfile } from '@/db/repo';
import type { MacroOverrides } from '@/engine/macros';
import type { Fix, Insight } from '@/engine/coach';
import { MICROS, type MicroKey } from '@/engine/food-types';
import { addDays, dateKey } from '@/engine/week';
import { FOOD_KEYS } from './hooks';
import { isoWeek, loadFoodReview, nextMeal, type FoodReviewData, type PeriodKind } from './ReviewData';
import { BigNumber, Label, SegBar, TextLink } from './ui';

const r = en.food.review;
const pct = (v: number) => Math.round(v * 100);

export function insightText(i: Insight): string {
  const d = i.data as Record<string, number | string>;
  switch (i.id) {
    case 'protein-short-training':
      return r.insights[i.id](d as { short: number; trainingDays: number; volumePct: number | string });
    case 'pre-lift-carbs-low':
      return r.insights[i.id](d as { low: number; sessions: number; grams: number; hours: number });
    case 'gain-flat':
      return r.insights[i.id](d as { weeks: number });
    case 'loss-too-fast':
      return r.insights[i.id](d as { kgPerWeek: number; strengthPct: number });
    case 'micro-low':
      return r.insights[i.id]({ name: en.food.micros[d.nutrient as MicroKey], pct: d.pct as number });
    case 'pre-lift-carbs-good':
      return r.insights[i.id](d as { sessions: number });
    case 'weight-on-track':
      return r.insights[i.id](d as { kgPerWeek: number });
    case 'protein-on-target':
      return r.insights[i.id](d as { days: number; logged: number });
    case 'days-on-target':
      return r.insights[i.id](d as { days: number });
  }
}

export function fixText(f: Fix): string {
  if (f.kind === 'raise-kcal') return r.fix.raiseKcal(f.by);
  if (f.kind === 'slow-rate') return r.fix.slowRate(f.to);
  if (f.nutrient === 'protein') return r.fix.protein;
  if (f.nutrient === 'carbs') return r.fix.carbs;
  return r.fix.micro(en.food.micros[f.nutrient as MicroKey] ?? f.nutrient);
}

/**
 * F06 Food review (PRD-1.2 FR-NUT-2, FR-COACH-1/2): week or month, days on target, macro shares,
 * "Needs work" and "Going well" drawn from food and training together, each fix one tap away.
 * Combined feedback lives only here; LiftLog's S10 is unchanged (FR-NAV-2).
 */
export default function Review() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [t, setT] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  // Captured once so the default period (and the live query below) stays stable across renders.
  const [now] = useState(() => Date.now());
  const anchor = t ?? (kind === 'week' ? defaultReviewTime(now, settings.weekStart) : now);
  const data = useLiveQuery(() => loadFoodReview(kind, anchor), [kind, anchor]);

  const step = (dir: 1 | -1) => {
    if (kind === 'week') setT(addDays(anchor, 7 * dir));
    else {
      const d = new Date(anchor);
      setT(new Date(d.getFullYear(), d.getMonth() + dir, 1).getTime());
    }
  };

  const applyFix = async (f: Fix, d: FoodReviewData) => {
    if (f.kind === 'suggest-foods') {
      const q = new URLSearchParams({
        suggest: f.foodIds.join(','),
        meal: nextMeal(),
        date: dateKey(Date.now()),
      });
      navigate(`/food/add?${q}`);
    } else if (f.kind === 'raise-kcal' && d.current) {
      const prev = (await getRawSetting<MacroOverrides>(FOOD_KEYS.overrides)) ?? {};
      const kcal = d.current.macros.kcal + f.by;
      await setRawSetting(FOOD_KEYS.overrides, { ...prev, kcal });
      toast(r.fixed.raiseKcal(kcal.toLocaleString()));
    } else if (f.kind === 'slow-rate' && d.current) {
      await saveProfile({ diet: { phase: d.current.phase, rateKgPerWeek: f.to } });
      toast(r.fixed.slowRate(f.to));
    }
  };

  const title = data
    ? kind === 'week'
      ? r.title(isoWeek(data.start))
      : r.monthTitle(monthName(data.start))
    : '';
  const range = data ? r.range(shortDate(data.start), shortDate(addDays(data.end, -1))) : '';
  const elapsed = data ? data.days.filter((x) => x.date <= dateKey(now)).length : 0;

  return (
    <main className="px-6 pt-5">
      <div className="flex items-center justify-between gap-3">
        <SectionSwitch current="food" />
        <TextLink
          onClick={() => {
            setKind(kind === 'week' ? 'month' : 'week');
            setT(null);
          }}
        >
          {kind === 'week' ? r.monthly : r.weekly}
        </TextLink>
      </div>

      <div className="mt-5 flex items-end justify-between gap-2">
        <div>
          <h1 className="t-display text-[34px] leading-none">{title}</h1>
          <p className="mt-2 text-[13px] text-ink2">{range}</p>
        </div>
        <div className="flex">
          <button
            type="button"
            aria-label={r.prev}
            className="inline-flex h-11 w-11 items-center justify-center text-ink"
            onClick={() => step(-1)}
          >
            <Icon name="back" />
          </button>
          <button
            type="button"
            aria-label={r.next}
            className="inline-flex h-11 w-11 items-center justify-center text-ink disabled:text-rule"
            disabled={!!data && data.end > now}
            onClick={() => step(1)}
          >
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>

      {data && !data.hasTargets && <p className="mt-8 text-[15px] text-ink2">{r.noTargets}</p>}
      {data && data.hasTargets && !data.review.loggedDays && (
        <p className="mt-8 text-[15px] text-ink2">{r.empty}</p>
      )}

      {data && data.hasTargets && data.review.loggedDays > 0 && (
        <>
          <div className="mt-8" data-testid="days-on-target">
            <BigNumber value={String(data.review.daysOnTarget)} unit={`/ ${elapsed}`} size={72} />
            <p className="mt-2 text-[13px] text-ink2">{r.daysOnTarget}</p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-5">
            {(
              [
                [r.kcal, data.review.avgPct.kcal],
                [r.protein, data.review.avgPct.protein],
                [r.carbs, data.review.avgPct.carbs],
              ] as [string, number][]
            ).map(([label, v]) => (
              <div key={label}>
                <Label>{label}</Label>
                <p className={`mt-2 font-mono text-[15px] ${v < 0.9 ? 'text-accent' : ''}`}>
                  {r.pct(pct(v))}
                </p>
              </div>
            ))}
          </div>

          {data.needsWork && (
            <section className="mt-10" aria-labelledby="needs-work">
              <h2
                id="needs-work"
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent"
              >
                {r.needsWork}
              </h2>
              <p className="mt-2 text-[16px] leading-snug">{insightText(data.needsWork)}</p>
              {data.needsWork.fix && (
                <TextLink onClick={() => void applyFix(data.needsWork!.fix!, data)}>
                  {fixText(data.needsWork.fix)}
                </TextLink>
              )}
            </section>
          )}

          {data.goingWell && (
            <section className="mt-8" aria-labelledby="going-well">
              <h2
                id="going-well"
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink2"
              >
                {r.goingWell}
              </h2>
              <p className="mt-2 text-[16px] leading-snug">{insightText(data.goingWell)}</p>
            </section>
          )}

          {data.review.low.length > 0 && (
            <section className="mt-8" aria-labelledby="low-micros">
              <h2
                id="low-micros"
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink2"
              >
                {kind === 'week' ? r.lowThisWeek : r.lowThisMonth}
              </h2>
              <ul className="mt-3 flex flex-col gap-4">
                {data.review.low.map((k) => {
                  const v = data.review.micros[k].avgPct ?? 0;
                  return (
                    <li key={k}>
                      <div className="flex justify-between text-[14px]">
                        <span>{en.food.micros[k]}</span>
                        <span className="font-mono text-accent">{r.pct(pct(v))}</span>
                      </div>
                      <div className="mt-2">
                        <SegBar value={v} max={1} tone="accent" label={en.food.micros[k]} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="mt-4">
            <TextLink onClick={() => setAll(true)}>{r.allNutrients}</TextLink>
          </div>

          {data.quest && (
            <p className="mt-4 flex justify-between gap-3 text-[14px]">
              <span>
                {data.quest.done
                  ? r.questDone(data.quest.progress)
                  : r.quest(data.quest.progress, data.quest.goal)}
              </span>
              {data.quest.done && (
                <span className="font-mono text-[12px] font-semibold text-brass-text">
                  {r.xp(data.quest.xp)}
                </span>
              )}
            </p>
          )}

          <Sheet open={all} onClose={() => setAll(false)} title={r.allNutrients}>
            <ul>
              {MICROS.map((k) => {
                const m = data.review.micros[k];
                return (
                  <li
                    key={k}
                    className="flex min-h-14 items-center justify-between gap-3 border-b border-rule"
                  >
                    <span className="text-[15px]">
                      {en.food.micros[k]}
                      {m.kind === 'limit' && <span className="ml-1 text-[13px] text-ink2">{r.limit}</span>}
                      <span className="block text-[12px] text-ink2">
                        {m.knownDays ? r.basedOn(m.knownDays) : r.noData}
                      </span>
                    </span>
                    <span className="font-mono text-[15px]">
                      {m.avgPct === null ? '–' : r.pct(pct(m.avgPct))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Sheet>
        </>
      )}
    </main>
  );
}

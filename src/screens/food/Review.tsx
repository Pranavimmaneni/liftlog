import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { SectionSwitch } from '@/components/SectionSwitch';
import { SunTop } from '@/components/sun/SunTop';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { monthName, shortDate } from '@/copy/format';
import { defaultReviewTime } from '@/db/insight';
import { getRawSetting, setRawSetting, useSettings } from '@/db/settings';
import { saveProfile } from '@/db/repo';
import type { MacroOverrides } from '@/engine/macros';
import type { Fix, Insight } from '@/engine/coach';
import { MICROS, type MicroKey } from '@/engine/food-types';
import { addDays, dateKey, parseDateKey } from '@/engine/week';
import { FOOD_KEYS } from './hooks';
import { isoWeek, loadFoodReview, nextMeal, type FoodReviewData, type PeriodKind } from './ReviewData';
import { BigNumber, Label, SegBar, SunMeter, TextLink } from './ui';

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
 * Combined feedback lives only here; LiftLog's S10 is unchanged (FR-NAV-2). The Rising Sun look
 * (FR-DSN-11, mockup F06) shows the same on glass, with the period's calories as one bar a day.
 */
export default function Review() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [t, setT] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const sun = useDesign() === 'sun';
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

  const pickKind = (k: PeriodKind) => {
    if (k === kind) return;
    setKind(k);
    setT(null);
  };
  const allSheet = data ? (
    <Sheet open={all} onClose={() => setAll(false)} title={r.allNutrients}>
      <ul>
        {MICROS.map((k) => {
          const m = data.review.micros[k];
          return (
            <li key={k} className="flex min-h-14 items-center justify-between gap-3 border-b border-rule">
              <span className="text-[15px]">
                {en.food.micros[k]}
                {m.kind === 'limit' && <span className="ml-1 text-[13px] text-ink2">{r.limit}</span>}
                <span className="block text-[12px] text-ink2">
                  {m.knownDays ? r.basedOn(m.knownDays) : r.noData}
                </span>
              </span>
              <span className="font-mono text-[15px]">{m.avgPct === null ? '–' : r.pct(pct(m.avgPct))}</span>
            </li>
          );
        })}
      </ul>
    </Sheet>
  ) : null;

  if (sun) {
    const s = en.sun.food.review;
    const todayKey = dateKey(now);
    return (
      <main className="px-5 pt-5">
        <SunTop title={s.title} right={title} section="food" />
        <div className="mt-3 flex items-center justify-between gap-2">
          <div role="group" aria-label={s.period} className="flex gap-2">
            {(['week', 'month'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="sun-pill sun-food-onpage !min-h-11"
                aria-pressed={kind === k}
                onClick={() => pickKind(k)}
              >
                {s[k]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="ll-icon-btn" aria-label={r.prev} onClick={() => step(-1)}>
              <Icon name="back" />
            </button>
            <button
              type="button"
              className="ll-icon-btn disabled:opacity-40"
              aria-label={r.next}
              disabled={!!data && data.end > now}
              onClick={() => step(1)}
            >
              <Icon name="chevronRight" />
            </button>
          </div>
        </div>

        {data && !(data.hasTargets && data.review.loggedDays > 0) && (
          <section className="sun-glass mt-3 rounded-[18px] px-[18px] py-4">
            <p className="text-[14px] text-ink2">{range}</p>
            <p className="mt-2 text-[16px]">{data.hasTargets ? r.empty : r.noTargets}</p>
          </section>
        )}

        {data && data.hasTargets && data.review.loggedDays > 0 && (
          <>
            <section className="sun-glass mt-3 rounded-[18px] px-[18px] py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="font-bold">{s.calories}</h2>
                <p className="text-ink2" data-testid="days-on-target">
                  {s.daysOnTarget(data.review.daysOnTarget, elapsed)}
                </p>
              </div>
              <p className="text-[13px] text-ink2">{range}</p>
              <ul className="mt-2 flex">
                {data.days.map((d) => {
                  const date = parseDateKey(d.date);
                  const logged = d.entries.length > 0;
                  const share = Math.min(1, d.pct.kcal / 1.2);
                  return (
                    <li
                      key={d.date}
                      className="min-w-0 flex-1 text-center"
                      aria-label={s.day(
                        date.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' }),
                        logged ? pct(d.pct.kcal) : null,
                      )}
                    >
                      <div className="flex h-[70px] items-end justify-center" aria-hidden="true">
                        <i
                          className={`block w-[14px] max-w-[70%] rounded-full ${
                            !logged ? 'bg-track' : d.onTarget ? 'bg-accent' : 'bg-fat'
                          }`}
                          style={{ height: logged ? Math.max(8, Math.round(share * 70)) : 6 }}
                        />
                      </div>
                      {kind === 'week' && (
                        <span
                          aria-hidden="true"
                          className={`text-[13px] ${d.date === todayKey ? 'font-bold text-ink' : 'text-ink2'}`}
                        >
                          {date.toLocaleDateString('en', { weekday: 'narrow' })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {(data.goingWell || data.needsWork || data.quest) && (
              <section className="sun-glass mt-3 flex flex-col gap-3 rounded-[18px] px-[18px] py-4">
                {data.goingWell && (
                  <div>
                    <h2 className="font-bold">{r.goingWell}</h2>
                    <p className="mt-0.5 text-[15px] text-ink2">{insightText(data.goingWell)}</p>
                  </div>
                )}
                {data.needsWork && (
                  <div>
                    <h2 className="font-bold">{r.needsWork}</h2>
                    <p className="mt-0.5 text-[15px] text-ink2">{insightText(data.needsWork)}</p>
                    {data.needsWork.fix && (
                      <button
                        type="button"
                        className="sun-pill mt-2 !h-auto !min-h-11 py-2 text-left"
                        onClick={() => void applyFix(data.needsWork!.fix!, data)}
                      >
                        {fixText(data.needsWork.fix)}
                      </button>
                    )}
                  </div>
                )}
                {data.quest && (
                  <p className="flex justify-between gap-3 border-t border-rule pt-3 text-[14px]">
                    <span>
                      {data.quest.done
                        ? r.questDone(data.quest.progress)
                        : r.quest(data.quest.progress, data.quest.goal)}
                    </span>
                    {data.quest.done && (
                      <b className="shrink-0 tabular-nums text-accent-text">{r.xp(data.quest.xp)}</b>
                    )}
                  </p>
                )}
              </section>
            )}

            <section className="sun-glass mt-3 overflow-hidden rounded-[14px]" aria-label={s.averages}>
              <h2 className="px-4 pb-1 pt-3 font-bold">{s.averages}</h2>
              {(
                [
                  [r.kcal, data.review.avgPct.kcal],
                  [r.protein, data.review.avgPct.protein],
                  [r.carbs, data.review.avgPct.carbs],
                ] as [string, number][]
              ).map(([label, v]) => (
                <div key={label} className="sun-list-row">
                  <span>{label}</span>
                  <span className="shrink-0 tabular-nums">
                    <b>{r.pct(pct(v))}</b>
                    {v < 0.9 && <span className="text-ink2"> · {s.low}</span>}
                  </span>
                </div>
              ))}
              {data.review.low.map((k) => {
                const v = data.review.micros[k].avgPct ?? 0;
                return (
                  <div key={k} className="sun-list-row !block !py-2.5">
                    <div className="flex justify-between gap-3">
                      <span>{en.food.micros[k]}</span>
                      <span className="shrink-0 tabular-nums">
                        <b>{r.pct(pct(v))}</b>
                        <span className="text-ink2"> · {s.low}</span>
                      </span>
                    </div>
                    <div className="mt-2">
                      <SunMeter value={v} max={1} color="var(--ll-fat)" label={en.food.micros[k]} />
                    </div>
                  </div>
                );
              })}
              <button type="button" className="sun-list-row" onClick={() => setAll(true)}>
                <span>{r.allNutrients}</span>
                <Icon name="chevronRight" size={16} className="text-ink2" />
              </button>
            </section>
            {allSheet}
          </>
        )}
      </main>
    );
  }

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

          {allSheet}
        </>
      )}
    </main>
  );
}

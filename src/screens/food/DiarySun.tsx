import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { SunTop } from '@/components/sun/SunTop';
import { en } from '@/copy/en';
import { MEAL_SLOTS } from '@/db/types';
import { parseDateKey } from '@/engine/week';
import type { DiaryState } from './state';
import { SunMeter } from './ui';
import { fmt, shortDate } from './format';

const BARS = [
  { key: 'protein', color: 'var(--ll-accent)' },
  { key: 'carbs', color: 'var(--ll-ink)' },
  { key: 'fat', color: 'var(--ll-fat)' },
  { key: 'fibre', color: 'var(--ll-sage)' },
] as const;

/**
 * F01 Diary in the Rising Sun look (FR-DSN-11, handoff §7): calories left as the hero number, four
 * bars (protein, carbs, fat, fibre: eaten / target) and the meals as one glass list. The day
 * arrows, the streak, the quest and the targets link of the classic diary are all kept (§8.1).
 */
export function DiarySun({ d }: { d: DiaryState }) {
  const { date, isToday, targets, day, streak, eaten, target, left, quest, addHref } = d;
  const t = en.sun.food.diary;
  const dayLabel = isToday ? shortDate(parseDateKey(date)) : d.title;

  const dayNav = (
    <div className="-my-2 -mr-2.5 flex shrink-0 items-center text-[14px] text-ink2">
      <button
        type="button"
        className="inline-flex h-11 w-9 items-center justify-center text-ink"
        aria-label={en.food.diary.prevDay}
        onClick={d.prev}
      >
        <Icon name="back" size={18} />
      </button>
      <span className="tabular-nums" aria-live="polite">
        {dayLabel}
      </span>
      <button
        type="button"
        className="inline-flex h-11 w-9 items-center justify-center text-ink disabled:opacity-30"
        aria-label={en.food.diary.nextDay}
        disabled={isToday}
        onClick={d.next}
      >
        <Icon name="chevronRight" size={18} />
      </button>
    </div>
  );

  return (
    <main className="px-5 pt-5">
      <SunTop
        title={t.title}
        section="food"
        right={
          <>
            <Link to="/food/targets" className="ll-icon-btn !text-ink" aria-label={en.food.diary.targets}>
              <Icon name="sliders" />
            </Link>
            <Link
              to={d.logHref()}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-btn !text-btn-ink"
              aria-label={en.food.diary.logFood}
            >
              <Icon name="plus" />
            </Link>
          </>
        }
      />

      <section
        className="sun-glass mt-4 rounded-[18px] px-[18px] py-4"
        aria-label={left >= 0 ? t.left : t.over}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[15px] text-ink2">
            {targets ? (left >= 0 ? t.left : t.over) : en.food.diary.targets}
          </span>
          {dayNav}
        </div>
        {targets ? (
          <>
            <p className="sun-display mt-0.5 break-words text-[54px]">{fmt(Math.abs(left))}</p>
            <p className="mt-1 text-[14px] text-ink2">
              {t.eaten(fmt(eaten), fmt(target))}
              {isToday && streak > 0 ? ` · ${en.food.diary.streak(streak)}` : ''}
            </p>
            <ul className="mt-3 grid grid-cols-4 gap-2 text-[13px] min-[380px]:gap-2.5">
              {BARS.map(({ key, color }) => {
                const v = day?.totals.total[key] ?? 0;
                const goal = targets.macros[key];
                const name = key === 'fibre' ? en.food.micros.fibre : en.food.macros[key];
                return (
                  <li key={key} className="min-w-0">
                    <p className="whitespace-nowrap tabular-nums" aria-hidden="true">
                      <b className="text-[15px]">{fmt(v)}</b> <span className="text-ink2">/ {fmt(goal)}</span>
                    </p>
                    <div className="mb-1 mt-1.5">
                      <SunMeter value={v} max={goal} color={color} label={t.bar(name, fmt(v), fmt(goal))} />
                    </div>
                    <span aria-hidden="true">{name}</span>
                  </li>
                );
              })}
            </ul>
            {quest && isToday && (
              <p className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-3 text-[14px]">
                <span>{quest.done ? en.food.diary.questDone : en.food.diary.quest(quest.goal)}</span>
                <b className="shrink-0 tabular-nums text-accent-text">{en.food.diary.xp(quest.xp)}</b>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-[16px]">{en.food.diary.noTargets}</p>
            <Link to="/food/targets" className="sun-pill mt-3 !text-ink">
              {en.food.diary.targets}
            </Link>
          </>
        )}
      </section>

      <section className="sun-glass mt-3 overflow-hidden rounded-[14px]" aria-label={en.food.diary.meals}>
        {MEAL_SLOTS.map((m) => {
          const items = day?.byMeal[m] ?? [];
          const kcal = items.reduce((n, e) => n + ((e.per100g.kcal ?? 0) * e.grams) / 100, 0);
          return items.length ? (
            <Link key={m} to={`/food/meal/${date}/${m}`} className="sun-list-row !text-ink">
              <span className="min-w-0">
                <span className="block">{en.food.meals[m]}</span>
                <span className="block truncate text-[13px] text-ink2">
                  {items.map((e) => e.name).join(', ')}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="sr-only">{t.mealKcal(fmt(kcal))}</span>
                <span aria-hidden="true">{fmt(kcal)}</span>
              </span>
            </Link>
          ) : (
            <Link
              key={m}
              to={addHref(m)}
              className="sun-list-row !text-ink"
              aria-label={`${en.food.diary.add}: ${en.food.meals[m]}`}
            >
              <span className="min-w-0">
                <span className="block">{en.food.meals[m]}</span>
                <span className="block text-[13px] text-ink2">{t.nothing}</span>
              </span>
              <b className="shrink-0">{en.food.diary.add}</b>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

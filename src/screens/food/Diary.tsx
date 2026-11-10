import { Link, useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { SectionSwitch } from '@/components/SectionSwitch';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { MEAL_SLOTS } from '@/db/types';
import { parseDateKey } from '@/engine/week';
import { DiarySun } from './DiarySun';
import { useDiary, type DiaryState } from './state';
import { BigNumber, Cta, Label, SegBar } from './ui';
import { fmt, shortDate } from './format';

/**
 * F01 Diary (PRD-1.2 FR-DIARY-1, FR-NUT-1, FR-GAME-1): calories left, macro bars, today's quest and
 * the meals. `?date=YYYY-MM-DD` shows another day. The Rising Sun look has its own layout
 * (FR-DSN-11, DiarySun); both read the same state.
 */
export default function Diary() {
  const d = useDiary();
  return useDesign() === 'sun' ? <DiarySun d={d} /> : <DiaryClassic d={d} />;
}

function DiaryClassic({ d }: { d: DiaryState }) {
  const navigate = useNavigate();
  const { date, isToday, targets, day, streak, title, eaten, target, left, quest, addHref } = d;

  return (
    <main className="px-6">
      <div className="flex items-center justify-between pt-5">
        <SectionSwitch current="food" />
        <Link
          to="/food/targets"
          className="-mr-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink"
          aria-label={en.food.diary.targets}
        >
          <Icon name="sliders" />
        </Link>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="t-display text-[34px] leading-none">{title}</h1>
          <p className="mt-2 text-[13px] text-ink2">
            {shortDate(parseDateKey(date))}
            {isToday && streak > 0 ? ` · ${en.food.diary.streak(streak)}` : ''}
          </p>
        </div>
        <div className="flex">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center text-ink"
            aria-label={en.food.diary.prevDay}
            onClick={d.prev}
          >
            <Icon name="back" />
          </button>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center text-ink disabled:text-rule"
            aria-label={en.food.diary.nextDay}
            disabled={isToday}
            onClick={d.next}
          >
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>

      {targets ? (
        <section aria-label={en.food.diary.left}>
          <Label className="mt-8">{left >= 0 ? en.food.diary.left : en.food.diary.over}</Label>
          <div className="mt-2">
            <BigNumber value={fmt(Math.abs(left))} unit={en.food.units.kcal} />
          </div>
          <div className="mt-4">
            <SegBar value={eaten} max={target} segments={20} thick label={en.food.macros.kcal} />
          </div>
          <p className="mt-2 text-[13px] text-ink2">{en.food.diary.eatenOf(fmt(eaten), fmt(target))}</p>

          <div className="mt-8 grid grid-cols-3 gap-5">
            {(['protein', 'carbs', 'fat'] as const).map((k) => {
              const v = day?.totals.total[k] ?? 0;
              const t = targets.macros[k];
              return (
                <div key={k}>
                  <Label>{en.food.macros[k]}</Label>
                  <p className="mt-2 font-mono text-[15px]">
                    {fmt(v)}
                    <span className="text-ink2">/{fmt(t)} g</span>
                  </p>
                  <div className="mt-2">
                    <SegBar
                      value={v}
                      max={t}
                      tone={k === 'protein' ? 'accent' : 'ink'}
                      label={en.food.macros[k]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {quest && isToday && (
            <div className="mt-4 flex items-center justify-between text-[13px]">
              <span>{quest.done ? en.food.diary.questDone : en.food.diary.quest(quest.goal)}</span>
              <span className="font-mono text-[12px] font-semibold text-brass-text">
                {en.food.diary.xp(quest.xp)}
              </span>
            </div>
          )}
        </section>
      ) : (
        <div className="mt-8 border-y border-rule py-4">
          <p className="text-[15px]">{en.food.diary.noTargets}</p>
          <Link to="/food/targets" className="ll-link mt-2 inline-block">
            {en.food.diary.targets}
          </Link>
        </div>
      )}

      <Label className="mt-8">{en.food.diary.meals}</Label>
      <ul className="mt-2 border-b border-rule">
        {MEAL_SLOTS.map((m) => {
          const items = day?.byMeal[m] ?? [];
          const kcal = items.reduce((n, e) => n + ((e.per100g.kcal ?? 0) * e.grams) / 100, 0);
          return (
            <li key={m} className="border-t border-rule">
              {items.length ? (
                <Link
                  to={`/food/meal/${date}/${m}`}
                  className="flex min-h-14 items-center gap-3 py-2.5 text-ink no-underline"
                >
                  <span className="min-w-0 grow">
                    <span className="block font-semibold">{en.food.meals[m]}</span>
                    <span className="block truncate text-[13px] text-ink2">
                      {items.map((e) => e.name).join(', ')}
                    </span>
                  </span>
                  <span className="font-mono text-[14px]">{fmt(kcal)}</span>
                </Link>
              ) : (
                <div className="flex min-h-14 items-center justify-between py-2.5">
                  <span className="font-semibold text-ink2">{en.food.meals[m]}</span>
                  <Link
                    to={addHref(m)}
                    className="ll-link"
                    aria-label={`${en.food.diary.add}: ${en.food.meals[m]}`}
                  >
                    {en.food.diary.add}
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-[calc(86px+env(safe-area-inset-bottom))] mt-6 pb-2">
        <Cta onClick={() => navigate(d.logHref())}>
          <Icon name="plus" /> {en.food.diary.logFood}
        </Cta>
      </div>
    </main>
  );
}

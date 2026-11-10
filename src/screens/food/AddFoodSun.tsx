import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';
import type { FoodItem } from '@/engine/food-types';
import { ADD_TABS, type AddFoodState } from './state';
import { FoodHeader, TextTabs } from './ui';
import { fmt, foodPortion } from './format';

/**
 * F02 Add food in the Rising Sun look (FR-DSN-11, handoff §7): search with Scan, a prominent
 * "Create a new food" button, then suggestions and recents (or results) as glass lists. The tabs
 * and the library download notices of the classic screen are kept (§8.1).
 */
export function AddFoodSun({ a }: { a: AddFoodState }) {
  const { meal, q, setQ, tab, setTab, setPicked, suggested, results, empty, targets, day } = a;
  const t = en.sun.food.add;
  const mealName = en.food.meals[meal];

  const row = (f: FoodItem) => {
    const p = foodPortion(f);
    return (
      <li key={f.id} className="sun-list-row !min-h-[56px] !py-1 !pr-2.5">
        <button type="button" className="min-w-0 grow py-1 text-left" onClick={() => setPicked(f)}>
          <span className="block break-words">{f.name}</span>
          <span className="block truncate text-[13px] text-ink2">
            {f.brand ? `${f.brand} · ` : ''}
            {t.portion(p.label, p.protein)}
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="tabular-nums">
            {p.kcal}
            <span className="sr-only"> {en.food.units.kcal}</span>
          </span>
          <button
            type="button"
            className="sun-food-plus"
            aria-label={en.food.add.addOne(f.name)}
            onClick={() => setPicked(f)}
          >
            <span>
              <Icon name="plus" size={20} />
            </span>
          </button>
        </span>
      </li>
    );
  };

  const kcalLeft = targets ? Math.round(targets.macros.kcal) - Math.round(day?.totals.total.kcal ?? 0) : 0;
  const proteinLeft = targets ? Math.round(targets.macros.protein - (day?.totals.total.protein ?? 0)) : 0;
  const isToday = a.date === a.today;

  return (
    <main className="flex min-h-dvh flex-col pb-[calc(20px+env(safe-area-inset-bottom))]">
      <FoodHeader title={en.food.add.title(mealName)} backTo={a.backTo} />
      <div className="flex grow flex-col px-5">
        <label className="sun-glass sun-food-search mt-3.5">
          <Icon name="search" size={20} className="shrink-0 text-ink2" />
          <input
            type="search"
            className="h-full min-w-0 grow bg-transparent text-[16px] outline-none placeholder:text-ink2"
            placeholder={en.food.add.search}
            aria-label={en.food.add.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Link
            to={a.scanHref}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[14px] font-semibold !text-paper no-underline"
            aria-label={en.food.add.scan}
          >
            <Icon name="barcode" size={18} />
            {t.scan}
          </Link>
        </label>

        <Link
          to={a.createHref}
          className="mt-2.5 flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-btn text-[16px] font-bold !text-btn-ink no-underline"
        >
          <Icon name="plus" size={20} />
          {t.create}
        </Link>

        {a.notices.length > 0 && (
          <div className="sun-glass mt-3 rounded-[14px] px-4 py-3">
            {a.notices.map((text) => (
              <p key={text} className="text-[14px] text-ink2 [&+p]:mt-2" role="status">
                {text}
              </p>
            ))}
          </div>
        )}

        <div className="mt-2">
          <TextTabs
            label={en.food.add.search}
            value={tab}
            onChange={setTab}
            tabs={ADD_TABS.map((x) => [x, en.food.add.tabs[x]])}
          />
        </div>

        {suggested.length > 0 && !q && (
          <section className="sun-glass mt-2 overflow-hidden rounded-[14px]">
            <h2 className="px-4 pb-1 pt-3 font-bold">{t.suggested(mealName)}</h2>
            <ul aria-label="suggested">{suggested.map(row)}</ul>
          </section>
        )}

        <section className="sun-glass mt-3 overflow-hidden rounded-[14px]">
          <h2 className="px-4 pb-1 pt-3 font-bold">
            {q.trim() && tab === 'all' ? t.results : en.food.add.tabs[tab === 'all' ? 'recent' : tab]}
          </h2>
          {results.length ? (
            <ul aria-label={en.food.add.tabs[tab]}>{results.map(row)}</ul>
          ) : (
            <p className="px-4 pb-3.5 pt-1 text-[15px] text-ink2">{empty}</p>
          )}
        </section>

        {targets && (
          <div className="sticky bottom-[calc(16px+env(safe-area-inset-bottom))] mt-auto pt-4">
            <p className="sun-glass rounded-[24px] px-4 py-3 text-center text-[15px]">
              {kcalLeft >= 0 ? t.left(fmt(kcalLeft), isToday) : t.over(fmt(-kcalLeft), isToday)}
              {proteinLeft > 0 ? ` · ${t.proteinToGo(fmt(proteinLeft))}` : ''}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

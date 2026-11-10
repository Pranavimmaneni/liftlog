import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import type { FoodItem } from '@/engine/food-types';
import { AddFoodSun } from './AddFoodSun';
import { PortionSheet } from './PortionSheet';
import { ADD_TABS, useAddFood, type AddFoodState } from './state';
import { FoodHeader, TextTabs } from './ui';
import { foodSub } from './format';

/**
 * F02 Add food (PRD-1.2 FR-FOOD-3/4): search the library and the user's own foods, scan a barcode,
 * or create a food. `?meal=&date=` say where it goes; `?food=<id>` opens that food's portion sheet
 * (barcode hits); `?suggest=a,b` lists coach suggestions first (F06 fixes). The Rising Sun look has
 * its own layout (FR-DSN-11, AddFoodSun); both read the same state and share the portion sheet.
 */
export default function AddFood() {
  const a = useAddFood();
  const sun = useDesign() === 'sun';
  const { meal, targets, day, picked, setPicked } = a;
  return (
    <>
      {sun ? <AddFoodSun a={a} /> : <AddFoodClassic a={a} />}
      <PortionSheet
        food={picked}
        open={!!picked}
        onClose={() => setPicked(null)}
        action={en.food.portion.add(en.food.meals[meal])}
        dayProtein={
          targets ? { eaten: day?.totals.total.protein ?? 0, target: targets.macros.protein } : undefined
        }
        onDone={a.add}
      />
    </>
  );
}

function AddFoodClassic({ a }: { a: AddFoodState }) {
  const { meal, q, setQ, tab, setTab, setPicked, suggested, results, empty } = a;

  const row = (f: FoodItem) => (
    <li key={f.id} className="flex min-h-[60px] items-center gap-3 border-t border-rule py-2.5">
      <button type="button" className="min-w-0 grow text-left" onClick={() => setPicked(f)}>
        <span className="block font-semibold">{f.name}</span>
        <span className="block truncate text-[13px] text-ink2">
          {f.brand ? `${f.brand} · ` : ''}
          {foodSub(f)}
        </span>
      </button>
      <button
        type="button"
        className="-mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink"
        aria-label={en.food.add.addOne(f.name)}
        onClick={() => setPicked(f)}
      >
        <Icon name="plus" />
      </button>
    </li>
  );

  return (
    <main className="pb-[calc(32px+env(safe-area-inset-bottom))]">
      <FoodHeader title={en.food.add.title(en.food.meals[meal])} backTo={a.backTo} />
      <div className="px-6">
        <label className="mt-6 flex h-[52px] items-center gap-2.5 rounded-full border border-rule bg-card pl-4 pr-1">
          <Icon name="search" size={20} className="shrink-0 text-ink2" />
          <input
            type="search"
            className="h-full w-full bg-transparent text-[16px] outline-none"
            placeholder={en.food.add.search}
            aria-label={en.food.add.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Link
            to={a.scanHref}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink"
            aria-label={en.food.add.scan}
          >
            <Icon name="barcode" />
          </Link>
        </label>

        {a.notices.map((text) => (
          <p key={text} className="mt-3 text-[13px] text-ink2" role="status">
            {text}
          </p>
        ))}

        <div className="mt-3">
          <TextTabs
            label={en.food.add.search}
            value={tab}
            onChange={setTab}
            tabs={ADD_TABS.map((t) => [t, en.food.add.tabs[t]])}
          />
        </div>

        {suggested.length > 0 && !q && (
          <ul className="mt-2" aria-label="suggested">
            {suggested.map(row)}
          </ul>
        )}

        {results.length ? (
          <ul className="mt-2 border-b border-rule" aria-label={en.food.add.tabs[tab]}>
            {results.map(row)}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-ink2">{empty}</p>
        )}

        <div className="mt-6 flex items-center justify-between">
          <span className="text-[13px] text-ink2">{en.food.add.notFound}</span>
          <Link to={a.createHref} className="ll-link">
            {en.food.add.create}
          </Link>
        </div>
      </div>
    </main>
  );
}

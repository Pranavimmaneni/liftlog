import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon } from '@/components/Icon';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { logFood } from '@/db/food';
import { LIBRARY_MANIFEST } from '@/db/food-lib';
import { MEAL_SLOTS, type MealSlot } from '@/db/types';
import { searchFoods } from '@/engine/food-search';
import type { FoodItem } from '@/engine/food-types';
import { useDay, useFoodSearch, useFoodTargets, useToday } from './hooks';
import { PortionSheet } from './PortionSheet';
import { FoodHeader, TextTabs } from './ui';
import { foodSub, mealForNow } from './format';

type Tab = 'all' | 'recent' | 'mine' | 'indian' | 'brands';
const SOURCE: Partial<Record<Tab, FoodItem['source']>> = {
  mine: 'custom',
  indian: 'indian',
  brands: 'branded',
};

/**
 * F02 Add food (PRD-1.2 FR-FOOD-3/4): search the library and the user's own foods, scan a barcode,
 * or create a food. `?meal=&date=` say where it goes; `?food=<id>` opens that food's portion sheet
 * (barcode hits); `?suggest=a,b` lists coach suggestions first (F06 fixes).
 */
export default function AddFood() {
  const today = useToday();
  const [params] = useSearchParams();
  const date = params.get('date') ?? today;
  const mealParam = params.get('meal') as MealSlot | null;
  const meal: MealSlot =
    mealParam && MEAL_SLOTS.includes(mealParam) ? mealParam : mealForNow(new Date(), date === today);
  const search = useFoodSearch(today);
  const { targets } = useFoodTargets(date);
  const day = useDay(date);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [picked, setPicked] = useState<FoodItem | null>(null);

  const preset = params.get('food');
  useEffect(() => {
    if (preset && search.byId.has(preset)) setPicked(search.byId.get(preset)!);
  }, [preset, search.byId]);

  const suggested = useMemo(
    () =>
      (params.get('suggest') ?? '')
        .split(',')
        .map((id) => search.byId.get(id))
        .filter((f): f is FoodItem => !!f),
    [params, search.byId],
  );

  const results = useMemo((): FoodItem[] => {
    const src = SOURCE[tab];
    if (q.trim() && search.index) {
      return searchFoods(search.index, q, { limit: 200, boost: search.boost })
        .map((h) => h.food)
        .filter((f) => (tab === 'recent' ? search.recent.includes(f.id) : !src || f.source === src))
        .slice(0, 50);
    }
    if (tab === 'all' || tab === 'recent')
      return search.recent.map((id) => search.byId.get(id)).filter((f): f is FoodItem => !!f);
    if (tab === 'brands') return [];
    return [...search.byId.values()]
      .filter((f) => f.source === src)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 100);
  }, [q, tab, search]);

  const empty = q.trim()
    ? en.food.add.none(q.trim())
    : tab === 'mine'
      ? en.food.add.emptyMine
      : tab === 'brands'
        ? en.food.add.search
        : en.food.add.emptyRecent;
  const qs = `meal=${meal}&date=${date}`;

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
      <FoodHeader
        title={en.food.add.title(en.food.meals[meal])}
        backTo={`/food${date === today ? '' : `?date=${date}`}`}
      />
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
            to={`/food/scan?${qs}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink"
            aria-label={en.food.add.scan}
          >
            <Icon name="barcode" />
          </Link>
        </label>

        {LIBRARY_MANIFEST && search.libraryRows === 0 && (
          <p className="mt-3 text-[13px] text-ink2" role="status">
            {typeof navigator !== 'undefined' && navigator.onLine === false
              ? en.food.library.offline
              : en.food.library.downloading}
          </p>
        )}

        <div className="mt-3">
          <TextTabs
            label={en.food.add.search}
            value={tab}
            onChange={setTab}
            tabs={(['all', 'recent', 'mine', 'indian', 'brands'] as Tab[]).map((t) => [
              t,
              en.food.add.tabs[t],
            ])}
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
          <Link
            to={`/food/new?${qs}${q.trim() ? `&name=${encodeURIComponent(q.trim())}` : ''}`}
            className="ll-link"
          >
            {en.food.add.create}
          </Link>
        </div>
      </div>

      <PortionSheet
        food={picked}
        open={!!picked}
        onClose={() => setPicked(null)}
        action={en.food.portion.add(en.food.meals[meal])}
        dayProtein={
          targets ? { eaten: day?.totals.total.protein ?? 0, target: targets.macros.protein } : undefined
        }
        onDone={async ({ portion, servings }) => {
          if (!picked) return;
          await logFood({ date, meal, food: picked, portion, servings });
          toast(en.food.add.added(picked.name));
          setPicked(null);
        }}
      />
    </main>
  );
}

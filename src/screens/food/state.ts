import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { getFood, logFood } from '@/db/food';
import { LIBRARY_MANIFEST } from '@/db/food-lib';
import { MEAL_SLOTS, type MealSlot } from '@/db/types';
import { dailyQuests } from '@/engine/food-quests';
import { summarizeDay } from '@/engine/food-review';
import { listFoods, searchFoods } from '@/engine/food-search';
import type { FoodItem } from '@/engine/food-types';
import { parseDateKey } from '@/engine/week';
import { logWithEcho } from './echo';
import { mealForNow, shortDate } from './format';
import {
  indexesFor,
  shiftDate,
  useDay,
  useFoodsById,
  useFoodSearch,
  useFoodStreak,
  useFoodTargets,
  useToday,
} from './hooks';
import type { PortionChoice } from './PortionSheet';

/**
 * What the Diary shows (F01), shared by the classic and the Rising Sun layout: the day in
 * `?date=`, its targets and totals, the streak and today's quest.
 */
export function useDiary() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? today;
  const isToday = date === today;
  const { targets } = useFoodTargets(date);
  const day = useDay(date);
  const streak = useFoodStreak(today);

  const go = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });
  const title = isToday
    ? en.food.diary.today
    : date === shiftDate(today, -1)
      ? en.food.diary.yesterday
      : shortDate(parseDateKey(date));
  // Rounded first so "left" and "eaten of" always add up on screen.
  const eaten = Math.round(day?.totals.total.kcal ?? 0);
  const target = Math.round(targets?.macros.kcal ?? 0);
  const left = target - eaten;
  const quest = targets && day ? dailyQuests(summarizeDay(date, day.entries, targets.day), null)[0]! : null;
  const addHref = (meal: string) => `/food/add?meal=${meal}&date=${date}`;
  return {
    today,
    date,
    isToday,
    targets,
    day,
    streak,
    title,
    eaten,
    target,
    left,
    quest,
    addHref,
    logHref: () => addHref(mealForNow(new Date(), isToday)),
    prev: () => go(shiftDate(date, -1)),
    next: () => go(shiftDate(date, 1)),
  };
}
export type DiaryState = ReturnType<typeof useDiary>;

export type AddTab = 'all' | 'recent' | 'mine' | 'indian' | 'brands';
export const ADD_TABS: AddTab[] = ['all', 'recent', 'mine', 'indian', 'brands'];
const SOURCE: Partial<Record<AddTab, FoodItem['source']>> = {
  mine: 'custom',
  indian: 'indian',
  brands: 'branded',
};

/**
 * What Add food does (F02), shared by both layouts: `?meal=&date=` say where it goes; `?food=<id>`
 * opens that food's portion sheet (barcode hits); `?suggest=a,b` lists coach suggestions first.
 */
export function useAddFood() {
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
  const [tab, setTab] = useState<AddTab>('all');
  const [picked, setPicked] = useState<FoodItem | null>(null);

  const preset = params.get('food');
  useEffect(() => {
    if (!preset) return;
    let alive = true;
    void getFood(preset).then((f) => alive && f && setPicked(f));
    return () => {
      alive = false;
    };
  }, [preset]);

  const suggestIds = useMemo(() => (params.get('suggest') ?? '').split(',').filter(Boolean), [params]);
  const suggested = useFoodsById(suggestIds, search.own);

  // FR-FOOD-3/8: search gives ids; only the foods on screen are loaded (D121).
  const { libIndex, ownIndex, boost, recent } = search;
  const resultIds = useMemo((): string[] => {
    const src = SOURCE[tab];
    if (q.trim()) {
      const rec = new Set(recent);
      return searchFoods(indexesFor({ libIndex, ownIndex }, q), q, {
        limit: 50,
        boost,
        filter: (id, source) => (tab === 'recent' ? rec.has(id) : !src || source === src),
      }).map((h) => h.id);
    }
    if (tab === 'all' || tab === 'recent') return recent;
    if (tab === 'brands' || !src) return [];
    return listFoods(src === 'custom' ? ownIndex : libIndex, src).map((h) => h.id);
  }, [q, tab, libIndex, ownIndex, boost, recent]);
  const results = useFoodsById(resultIds, search.own);

  const empty = q.trim()
    ? en.food.add.none(q.trim())
    : tab === 'mine'
      ? en.food.add.emptyMine
      : tab === 'brands'
        ? en.food.add.search
        : en.food.add.emptyRecent;
  const qs = `meal=${meal}&date=${date}`;

  /** FR-DIARY-2: the entry is saved at once; today's entries ripple the sun (FR-DSN-8). */
  const add = async ({ portion, servings }: PortionChoice) => {
    if (!picked) return;
    await logWithEcho(date, targets?.macros, () => logFood({ date, meal, food: picked, portion, servings }));
    toast(en.food.add.added(picked.name));
    setPicked(null);
  };

  return {
    today,
    date,
    meal,
    search,
    targets,
    day,
    q,
    setQ,
    tab,
    setTab,
    picked,
    setPicked,
    suggested,
    results,
    empty,
    qs,
    add,
    backTo: `/food${date === today ? '' : `?date=${date}`}`,
    scanHref: `/food/scan?${qs}`,
    createHref: `/food/new?${qs}${q.trim() ? `&name=${encodeURIComponent(q.trim())}` : ''}`,
    /** FR-FOOD-2/8: library download notices, or none. */
    notices: [
      ...(LIBRARY_MANIFEST && !search.libraryReady
        ? [
            typeof navigator !== 'undefined' && navigator.onLine === false
              ? en.food.library.offline
              : en.food.library.downloading,
          ]
        : []),
      ...(search.catalogue
        ? [en.food.library.catalogue(Math.round((100 * search.catalogue.done) / search.catalogue.total))]
        : []),
    ],
  };
}
export type AddFoodState = ReturnType<typeof useAddFood>;

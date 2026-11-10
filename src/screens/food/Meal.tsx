import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, LinkButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { toast } from '@/components/Toast';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { copyEntries, deleteEntry, getFood, updateEntry } from '@/db/food';
import { MEAL_SLOTS, type DiaryRow, type MealSlot } from '@/db/types';
import type { FoodItem } from '@/engine/food-types';
import { scale } from '@/engine/nutrition';
import { parseDateKey } from '@/engine/week';
import { logWithEcho } from './echo';
import { useDay, useFoodTargets, useToday } from './hooks';
import { PortionSheet } from './PortionSheet';
import { FoodHeader, Label, TextLink } from './ui';
import { fmt, shortDate } from './format';

/**
 * One meal of one day (no mockup; composed from F01/F02 parts, D117): items with edit (F03 sheet)
 * and delete, totals, add more, and copy to today (PRD-1.2 FR-DIARY-2/3). The Rising Sun look
 * (FR-DSN-11) puts the same parts on glass: the items as one list, the total as a card.
 */
export default function Meal() {
  const { date = '', meal: mealParam = '' } = useParams();
  const meal = (MEAL_SLOTS as string[]).includes(mealParam) ? (mealParam as MealSlot) : 'snacks';
  const today = useToday();
  const navigate = useNavigate();
  const day = useDay(date);
  const sun = useDesign() === 'sun';
  const { targets } = useFoodTargets(today);
  const items = day?.byMeal[meal] ?? [];
  const [editing, setEditing] = useState<{ entry: DiaryRow; food: FoodItem } | null>(null);
  const kcal = (e: DiaryRow) => scale(e.per100g, e.grams).kcal ?? 0;
  const sum = (k: 'kcal' | 'protein' | 'carbs' | 'fat') =>
    items.reduce((n, e) => n + (scale(e.per100g, e.grams)[k] ?? 0), 0);

  const openEdit = async (e: DiaryRow) => {
    // The snapshot is what was logged; the food's current portions give the unit choices.
    const food = (await getFood(e.foodId)) ?? {
      id: e.foodId,
      name: e.name,
      aliases: [],
      source: 'custom' as const,
      per100g: e.per100g,
      portions: [e.portion],
    };
    setEditing({ entry: e, food: { ...food, name: e.name, per100g: e.per100g } });
  };

  const header = (
    <FoodHeader
      title={en.food.meals[meal]}
      sub={shortDate(parseDateKey(date))}
      backTo={`/food${date === today ? '' : `?date=${date}`}`}
    />
  );
  const remove = async (e: DiaryRow) => {
    await deleteEntry(e.id);
    toast(en.food.meal.deleted);
  };
  const copyToToday = async () => {
    // Copied entries land on today, so they ripple like any logged food (FR-DSN-8).
    const n = await logWithEcho(today, targets?.macros, () =>
      copyEntries({ fromDate: date, toDate: today, meal }),
    );
    toast(en.food.meal.copied(n));
    navigate('/food');
  };
  const portionText = (e: DiaryRow) =>
    e.servings === 1 ? e.portion.label : `${fmt(e.servings, 1)} × ${e.portion.label}`;
  const sheet = (
    <PortionSheet
      food={editing?.food ?? null}
      open={!!editing}
      onClose={() => setEditing(null)}
      action={en.food.portion.save}
      initial={editing ? { portion: editing.entry.portion, servings: editing.entry.servings } : undefined}
      onDone={async ({ portion, servings }) => {
        if (!editing) return;
        await updateEntry(editing.entry.id, { portion, servings });
        setEditing(null);
      }}
    />
  );

  if (sun)
    return (
      <main className="flex min-h-dvh flex-col pb-[calc(24px+env(safe-area-inset-bottom))]">
        {header}
        <div className="flex grow flex-col px-5">
          {items.length ? (
            <ul className="sun-glass mt-4 overflow-hidden rounded-[14px]">
              {items.map((e) => (
                <li key={e.id} className="sun-list-row !py-1 !pr-1.5">
                  <button
                    type="button"
                    className="min-w-0 grow py-1 text-left"
                    aria-label={en.food.meal.edit(e.name)}
                    onClick={() => void openEdit(e)}
                  >
                    <span className="block break-words">{e.name}</span>
                    <span className="block text-[13px] text-ink2">{portionText(e)}</span>
                  </button>
                  <span className="shrink-0 tabular-nums">
                    {fmt(kcal(e))}
                    <span className="sr-only"> {en.food.units.kcal}</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink2"
                    aria-label={en.food.meal.delete(e.name)}
                    onClick={() => void remove(e)}
                  >
                    <Icon name="trash" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sun-glass mt-4 rounded-[14px] px-4 py-3.5 text-[16px] text-ink2">
              {en.food.meal.empty}
            </p>
          )}

          {items.length > 0 && (
            <section className="sun-glass mt-3 rounded-[18px] px-[18px] py-4">
              <h2 className="text-[15px] text-ink2">{en.food.meal.total}</h2>
              <p className="mt-1">
                <span className="sun-display text-[38px]">{fmt(sum('kcal'))}</span>{' '}
                <span className="text-[15px] text-ink2">{en.food.units.kcal}</span>
              </p>
              <p className="mt-1.5 text-[14px] text-ink2">
                {en.sun.food.meal.macros(fmt(sum('protein')), fmt(sum('carbs')), fmt(sum('fat')))}
              </p>
            </section>
          )}

          <div className="sticky bottom-[calc(24px+env(safe-area-inset-bottom))] mt-auto flex flex-col gap-2.5 pt-6">
            {date !== today && items.length > 0 && (
              <Button variant="secondary" onClick={() => void copyToToday()}>
                {en.food.meal.copyToToday}
              </Button>
            )}
            <LinkButton to={`/food/add?meal=${meal}&date=${date}`}>
              <Icon name="plus" /> {en.food.meal.addMore}
            </LinkButton>
          </div>
        </div>
        {sheet}
      </main>
    );

  return (
    <main className="pb-[calc(32px+env(safe-area-inset-bottom))]">
      {header}
      <div className="px-6">
        {items.length ? (
          <ul className="mt-6 border-b border-rule">
            {items.map((e) => (
              <li key={e.id} className="flex min-h-[60px] items-center gap-2 border-t border-rule py-2">
                <button
                  type="button"
                  className="min-w-0 grow text-left"
                  aria-label={en.food.meal.edit(e.name)}
                  onClick={() => void openEdit(e)}
                >
                  <span className="block font-semibold">{e.name}</span>
                  <span className="block text-[13px] text-ink2">
                    {portionText(e)} · {fmt(kcal(e))} {en.food.units.kcal}
                  </span>
                </button>
                <button
                  type="button"
                  className="-mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink2"
                  aria-label={en.food.meal.delete(e.name)}
                  onClick={() => void remove(e)}
                >
                  <Icon name="trash" size={20} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-[15px] text-ink2">{en.food.meal.empty}</p>
        )}

        {items.length > 0 && (
          <div className="mt-6">
            <Label>{en.food.meal.total}</Label>
            <p className="mt-2 font-mono text-[14px]">
              {fmt(sum('kcal'))} {en.food.units.kcal} · P {fmt(sum('protein'))} · C {fmt(sum('carbs'))} · F{' '}
              {fmt(sum('fat'))}
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Link to={`/food/add?meal=${meal}&date=${date}`} className="ll-link">
            {en.food.meal.addMore}
          </Link>
          {date !== today && items.length > 0 && (
            <TextLink onClick={() => void copyToToday()}>{en.food.meal.copyToToday}</TextLink>
          )}
        </div>
      </div>

      {sheet}
    </main>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Icon } from '@/components/Icon';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { copyEntries, deleteEntry, getFood, updateEntry } from '@/db/food';
import { MEAL_SLOTS, type DiaryRow, type MealSlot } from '@/db/types';
import type { FoodItem } from '@/engine/food-types';
import { scale } from '@/engine/nutrition';
import { parseDateKey } from '@/engine/week';
import { useDay, useToday } from './hooks';
import { PortionSheet } from './PortionSheet';
import { FoodHeader, Label, TextLink } from './ui';
import { fmt, shortDate } from './format';

/**
 * One meal of one day (no mockup; composed from F01/F02 parts, D117): items with edit (F03 sheet)
 * and delete, totals, add more, and copy to today (PRD-1.2 FR-DIARY-2/3).
 */
export default function Meal() {
  const { date = '', meal: mealParam = '' } = useParams();
  const meal = (MEAL_SLOTS as string[]).includes(mealParam) ? (mealParam as MealSlot) : 'snacks';
  const today = useToday();
  const navigate = useNavigate();
  const day = useDay(date);
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

  return (
    <main className="pb-[calc(32px+env(safe-area-inset-bottom))]">
      <FoodHeader
        title={en.food.meals[meal]}
        sub={shortDate(parseDateKey(date))}
        backTo={`/food${date === today ? '' : `?date=${date}`}`}
      />
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
                    {e.servings === 1 ? e.portion.label : `${fmt(e.servings, 1)} × ${e.portion.label}`} ·{' '}
                    {fmt(kcal(e))} {en.food.units.kcal}
                  </span>
                </button>
                <button
                  type="button"
                  className="-mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink2"
                  aria-label={en.food.meal.delete(e.name)}
                  onClick={async () => {
                    await deleteEntry(e.id);
                    toast(en.food.meal.deleted);
                  }}
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
            <TextLink
              onClick={async () => {
                const n = await copyEntries({ fromDate: date, toDate: today, meal });
                toast(en.food.meal.copied(n));
                navigate('/food');
              }}
            >
              {en.food.meal.copyToToday}
            </TextLink>
          )}
        </div>
      </div>

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
    </main>
  );
}

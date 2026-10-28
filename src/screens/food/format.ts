import type { MealSlot } from '@/db/types';
import type { FoodItem } from '@/engine/food-types';
import { scale } from '@/engine/nutrition';
import { en } from '@/copy/en';

/** Numbers with Intl (NFR-I18N-1): whole numbers unless `digits` asks for a decimal. */
export function fmt(v: number, digits = 0): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(v);
}

/** Meal to suggest for a new entry today by the time of day; other days default to snacks. */
export function mealForNow(now: Date, isToday: boolean): MealSlot {
  if (!isToday) return 'snacks';
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 10 * 60 + 30) return 'breakfast';
  if (m < 15 * 60) return 'lunch';
  if (m < 18 * 60) return 'snacks';
  return 'dinner';
}

/** "1 katori · 290 kcal · 18 g protein" for a food's default portion (F02 rows). */
export function foodSub(f: FoodItem): string {
  const p = f.portions[0] ?? { label: '100 g', grams: 100 };
  const n = scale(f.per100g, p.grams);
  const label = f.source === 'custom' && f.portions.length === 0 ? '100 g' : p.label;
  return en.food.add.sub(
    f.source === 'custom' ? `${en.food.add.source.custom} · ${label}` : label,
    n.kcal === null ? '–' : fmt(n.kcal),
    n.protein === null || n.protein < 1 ? null : fmt(n.protein),
  );
}

/** "Tue 27 Oct" in the user's locale. */
export function shortDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

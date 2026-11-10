import { Link } from 'react-router';
import { Ring } from '@/components/sun/Ring';
import { en } from '@/copy/en';
import { useDay, useFoodTargets, useToday } from '../food/hooks';
import { fmt, mealForNow } from '../food/format';

const RINGS = [
  { key: 'protein', color: 'var(--ll-accent)' },
  { key: 'carbs', color: 'var(--ll-ink)' },
  { key: 'fat', color: 'var(--ll-fat)' },
  { key: 'fibre', color: 'var(--ll-ink2)' },
] as const;

/**
 * FR-DSN-4: the Food card on Today. Calories left, a small "Log food" button and four rings
 * (protein, carbs, fat, fibre) showing grams eaten against the day's target (FR-NUT-1). The targets
 * themselves are spelled out in the diary (handoff §8.1). Loaded lazily so the Food engines stay
 * out of the first page load (NFR-PERF-3).
 */
export default function FoodCard() {
  const today = useToday();
  const { targets, loading } = useFoodTargets(today);
  const day = useDay(today);
  const t = en.sun.today;
  const addHref = `/food/add?meal=${mealForNow(new Date(), true)}&date=${today}`;

  const eaten = Math.round(day?.totals.total.kcal ?? 0);
  const target = Math.round(targets?.macros.kcal ?? 0);
  const left = target - eaten;

  return (
    <section className="sun-glass mt-3 rounded-[18px] px-[18px] py-4" aria-label={t.food}>
      <div className="flex items-center justify-between gap-3">
        {targets ? (
          <Link to="/food" className="min-w-0 py-1 !text-ink no-underline" aria-label={t.openDiary}>
            <span className="sun-display text-[27px]">{fmt(Math.abs(left))}</span>{' '}
            <span className="text-[15px] text-ink2">{left >= 0 ? t.kcalLeft : t.kcalOver}</span>
          </Link>
        ) : (
          <p className="min-w-0 text-[15px] text-ink2">{loading ? '' : en.food.diary.noTargets}</p>
        )}
        <Link to={addHref} className="sun-pill !min-h-11 shrink-0 !px-3.5 !text-[14px] !text-ink">
          <span className="text-[18px] leading-none" aria-hidden="true">
            +
          </span>
          {t.logFood}
        </Link>
      </div>
      {targets && (
        <ul className="mt-3.5 grid grid-cols-4">
          {RINGS.map(({ key, color }) => {
            const v = day?.totals.total[key] ?? 0;
            const goal = targets.macros[key];
            const name = key === 'fibre' ? en.food.micros.fibre : en.food.macros[key];
            return (
              <li key={key} className="text-center">
                <span className="sr-only">{t.grams(name, fmt(v), fmt(goal))}</span>
                <Ring value={goal > 0 ? v / goal : 0} size={64} stroke={6} color={color} className="mx-auto">
                  <span className="text-[15px] font-bold tabular-nums" aria-hidden="true">
                    {fmt(v)}
                  </span>
                </Ring>
                <span className="mt-1.5 block text-[13px] text-ink2" aria-hidden="true">
                  {name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

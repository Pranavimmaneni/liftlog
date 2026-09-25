import { ToggleChip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';
import { dayName, MUSCLE_DAY_GROUPS } from '@/engine/custom-split';

export const MAX_CUSTOM_DAYS = 7;

/**
 * S03 "Build your own" (D79): one card per training day; tap muscle groups to combine them
 * (e.g. Chest + Biceps). The order you tap sets the day's name and which lift comes first. S04 then
 * shows the suggested exercises to add, remove or replace.
 */
export function CustomDays({ days, onChange }: { days: string[][]; onChange: (days: string[][]) => void }) {
  const c = en.onboarding.s3.customDays;
  const toggle = (i: number, id: string) =>
    onChange(days.map((d, k) => (k !== i ? d : d.includes(id) ? d.filter((x) => x !== id) : [...d, id])));
  return (
    <section className="px-5 pt-4" aria-labelledby="custom-days-h">
      <h2 id="custom-days-h" className="t-label">
        {c.title}
      </h2>
      <p className="mt-1 text-[14px] leading-snug text-ink2">{c.help}</p>
      <ol className="mt-2.5 flex flex-col gap-2.5">
        {days.map((ids, i) => (
          <li key={i} className="ll-card px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="t-label">{c.day(i + 1)}</p>
                <h3 className="t-display mt-0.5 text-[24px] leading-tight">
                  {ids.length ? dayName(ids, i) : c.empty}
                </h3>
              </div>
              {days.length > 1 && (
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-ink2"
                  aria-label={c.remove(i + 1)}
                  onClick={() => onChange(days.filter((_, k) => k !== i))}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={c.groups(i + 1)}>
              {MUSCLE_DAY_GROUPS.map((g) => (
                <ToggleChip key={g.id} on={ids.includes(g.id)} check onClick={() => toggle(i, g.id)}>
                  {g.name}
                </ToggleChip>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {days.length < MAX_CUSTOM_DAYS && (
        <button
          type="button"
          className="ll-btn mt-2.5 w-full"
          data-variant="ghost"
          onClick={() => onChange([...days, []])}
        >
          {c.add}
        </button>
      )}
    </section>
  );
}

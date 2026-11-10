import { ToggleChip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { Pill } from './shared';
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
  const sun = useDesign() === 'sun';
  // Rising Sun (FR-DSN-10): the help sits on glass, each day is a glass card of pills.
  if (sun)
    return (
      <section className="px-5 pt-3" aria-labelledby="custom-days-h">
        <div className="sun-glass rounded-[14px] p-4">
          <h2 id="custom-days-h" className="text-[15px] font-bold">
            {c.title}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-ink2">{c.help}</p>
        </div>
        <ol className="mt-2.5 flex flex-col gap-2.5">
          {days.map((ids, i) => (
            <li key={i} className="sun-glass rounded-[14px] py-3 pl-4 pr-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 pt-1">
                  <p className="text-[13px] text-ink2">{c.day(i + 1)}</p>
                  <h3 className="break-words text-[17px] font-bold leading-tight">
                    {ids.length ? dayName(ids, i) : c.empty}
                  </h3>
                </div>
                {days.length > 1 && (
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink2"
                    aria-label={c.remove(i + 1)}
                    onClick={() => onChange(days.filter((_, k) => k !== i))}
                  >
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2 pr-2" role="group" aria-label={c.groups(i + 1)}>
                {MUSCLE_DAY_GROUPS.map((g) => (
                  <Pill key={g.id} check on={ids.includes(g.id)} onClick={() => toggle(i, g.id)}>
                    {g.name}
                  </Pill>
                ))}
              </div>
            </li>
          ))}
        </ol>
        {days.length < MAX_CUSTOM_DAYS && (
          <button
            type="button"
            className="ll-btn mt-2.5 w-full"
            data-variant="secondary"
            onClick={() => onChange([...days, []])}
          >
            {c.add}
          </button>
        )}
      </section>
    );
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

import type { ReactNode } from 'react';
import { SectionSwitch, type Section } from '@/components/SectionSwitch';

/**
 * Header of a top-level Rising Sun screen (the tab screens: Today, Plan, Progress, Diary, Review,
 * Fasting): the display title on the left, a small right slot (a date, a button), and the
 * `LiftLog | Food` switch under it (handoff §4). Sub-screens use <ScreenHeader>, which renders the
 * glass bar in this look.
 */
export function SunTop({
  title,
  right,
  section,
}: {
  title: ReactNode;
  right?: ReactNode;
  /** Shows the section switch with this side selected; omit on screens without it. */
  section?: Section;
}) {
  return (
    <>
      <header className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="sun-title min-w-0 break-words">{title}</h1>
        {right && <div className="flex shrink-0 items-center gap-2 text-[15px] text-ink2">{right}</div>}
      </header>
      {section && (
        <div className="mt-3">
          <SectionSwitch current={section} />
        </div>
      )}
    </>
  );
}

/** A thin progress bar (mockup `.bar`): 6 px, soft track, token-coloured fill. Decorative. */
export function SunBar({
  value,
  max,
  color = 'var(--ll-accent)',
  className = '',
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-soft ${className}`} aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

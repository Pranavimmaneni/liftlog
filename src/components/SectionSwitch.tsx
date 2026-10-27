import { NavLink } from 'react-router';
import { en } from '@/copy/en';
import { setRawSetting } from '@/db/settings';

export type Section = 'liftlog' | 'food';

/** Remembered so the app reopens in the section used last (PRD-1.2 FR-NAV-2). */
export const LAST_SECTION_KEY = 'lastSection';

/**
 * PRD-1.2 FR-NAV-2: `LiftLog | Food` switch at the top of each section's main screens. It is the
 * only addition to LiftLog's screens (mockup X01).
 */
export function SectionSwitch({ current }: { current: Section }) {
  const item = (section: Section, to: string, label: string) => (
    <NavLink
      to={to}
      end={section === 'liftlog'}
      aria-current={current === section ? 'page' : undefined}
      onClick={() => void setRawSetting(LAST_SECTION_KEY, section)}
      className={`flex min-h-10 min-w-[84px] items-center justify-center rounded-full px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] no-underline ${
        current === section ? 'bg-ink text-card' : 'text-ink2'
      }`}
    >
      {label}
    </NavLink>
  );
  return (
    <nav aria-label={en.food.section.label} className="inline-flex rounded-full border border-rule p-[3px]">
      {item('liftlog', '/', en.food.section.liftlog)}
      {item('food', '/food', en.food.section.food)}
    </nav>
  );
}

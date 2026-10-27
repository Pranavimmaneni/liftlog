import { NavLink, Outlet } from 'react-router';
import { Icon, type IconName } from '@/components/Icon';
import { en } from '@/copy/en';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/food', label: en.food.tabs.diary, icon: 'book', end: true },
  { to: '/food/review', label: en.food.tabs.review, icon: 'trend' },
  { to: '/food/fasting', label: en.food.tabs.fasting, icon: 'timer' },
];

/** Food section tab bar: Diary · Review · Fasting (PRD-1.2 FR-NAV-2; LiftLog keeps its own). */
export function FoodTabBar() {
  return (
    <nav
      aria-label={en.food.tabs.nav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper pb-safe"
    >
      <ul className="mx-auto flex h-[70px] max-w-[480px] items-center justify-around">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-12 w-[96px] flex-col items-center justify-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] no-underline ${
                  isActive ? 'text-accent' : 'text-ink2'
                }`
              }
            >
              <Icon name={t.icon} size={22} strokeWidth={2} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Food's main tabs: the minimal Food look over Paper & Iron tokens (mockups F01, F06, F07). */
export function FoodTabLayout() {
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-[480px] bg-paper pb-[calc(96px+env(safe-area-inset-bottom))] pt-safe">
        <Outlet />
      </div>
      <FoodTabBar />
    </>
  );
}

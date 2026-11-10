import { NavLink } from 'react-router';
import { Icon, type IconName } from './Icon';
import { en } from '@/copy/en';
import { useDesign } from '@/app/design';

const TABS: { to: string; label: string; icon: IconName; sunIcon: IconName; end?: boolean }[] = [
  { to: '/', label: en.tabs.today, icon: 'bolt', sunIcon: 'target', end: true },
  { to: '/plan', label: en.tabs.plan, icon: 'calendar', sunIcon: 'list' },
  { to: '/progress', label: en.tabs.progress, icon: 'trend', sunIcon: 'bars' },
];

/** Bottom tab bar (S05): Today, Plan, Progress (FR-NAV-1). Clears the home indicator (FR-PLT-10). */
export function TabBar() {
  const sun = useDesign() === 'sun';
  return (
    <nav
      aria-label={en.tabs.nav}
      className="ll-tabbar fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-card pb-safe"
    >
      <ul className="mx-auto flex h-[70px] max-w-[480px] items-center justify-around">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `ll-tab flex min-h-12 w-[76px] flex-col items-center justify-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] no-underline ${
                  isActive ? 'text-accent' : 'text-ink2'
                }`
              }
            >
              <Icon name={sun ? t.sunIcon : t.icon} size={sun ? 24 : 22} strokeWidth={2.2} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

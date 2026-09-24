import { NavLink } from 'react-router';
import { Icon, type IconName } from './Icon';
import { en } from '@/copy/en';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: en.tabs.today, icon: 'bolt', end: true },
  { to: '/plan', label: en.tabs.plan, icon: 'calendar' },
  { to: '/library', label: en.tabs.library, icon: 'book' },
  { to: '/progress', label: en.tabs.progress, icon: 'trend' },
];

/** Bottom tab bar (S05). Clears the home indicator (FR-PLT-10). */
export function TabBar() {
  return (
    <nav
      aria-label={en.tabs.nav}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-card pb-safe"
    >
      <ul className="mx-auto flex h-[70px] max-w-[480px] items-center justify-around">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-12 w-[76px] flex-col items-center justify-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] no-underline ${
                  isActive ? 'text-accent' : 'text-ink2'
                }`
              }
            >
              <Icon name={t.icon} size={22} strokeWidth={2.2} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

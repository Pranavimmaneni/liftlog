import { useEffect } from 'react';
import { platform } from '@/platform';
import type { ResolvedTheme } from '@/platform';
import { useSettings, type ThemePref } from '@/db/settings';

const STORAGE_KEY = 'll-theme';

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePref, dark = prefersDark()): ResolvedTheme {
  if (pref === 'paper' || pref === 'iron') return pref;
  return dark ? 'iron' : 'paper';
}

/** FR-SET-1 + FR-PLT-9: applies instantly, persists a pre-paint mirror, and updates the status bar. */
export function applyTheme(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* private mode */
  }
  const bg = getComputedStyle(root).getPropertyValue('--ll-paper').trim();
  platform.statusBar(resolved, bg);
  return resolved;
}

/** Keeps <html data-theme> in sync with the setting and, for System, with the OS. */
export function useThemeSync(): void {
  const { theme } = useSettings();
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
}

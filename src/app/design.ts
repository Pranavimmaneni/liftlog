import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { create } from 'zustand';
import { getRawSetting, setRawSetting } from '@/db/settings';
import { applyTheme } from './theme';
import type { ThemePref } from '@/db/settings';

/**
 * FR-DSN-1: the look. 'classic' is Paper & Iron; 'sun' is the Rising Sun redesign
 * (docs/new-design-handoff). Classic stays the default until Pranav approves the new look (D124).
 */
export type Design = 'classic' | 'sun';
/** FR-DSN-2: the section picks the colour family in the Rising Sun look. */
export type Section = 'workout' | 'food';

export const DESIGN_KEY = 'design';
export const GLASS_KEY = 'sunGlass';
const STORAGE_KEY = 'll-design';
const GLASS_STORAGE_KEY = 'll-glass';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export function parseDesign(v: unknown): Design {
  return v === 'sun' ? 'sun' : 'classic';
}

/** The section a path belongs to: everything under /food is Food, the rest is LiftLog. */
export function sectionFor(pathname: string): Section {
  return pathname === '/food' || pathname.startsWith('/food/') ? 'food' : 'workout';
}

/**
 * FR-DSN-3: the sun shows behind the screens rebuilt for it (Today, Active workout, Logging, Rest).
 * The other screens still put text straight on the page, which would be unreadable where it
 * crosses the disc and rings, so they get the sun when they are rebuilt (D127).
 */
export function hasSun(pathname: string): boolean {
  return pathname === '/' || pathname === '/workout' || pathname.startsWith('/workout/');
}

interface LookState {
  design: Design;
  glass: boolean;
}

/** Starts from the pre-paint mirror so the first render already has the right look. */
export const useLook = create<LookState>(() => ({
  design: parseDesign(read(STORAGE_KEY)),
  glass: read(GLASS_STORAGE_KEY) !== 'off',
}));

/** The look in use; screens with a rebuilt Rising Sun layout branch on this. */
export function useDesign(): Design {
  return useLook((s) => s.design);
}

/**
 * Puts the look on <html> (data-design, data-glass), mirrors it for the boot script, and re-applies
 * the theme so the status bar picks up the new background (FR-PLT-9).
 */
export function applyLook(look: Partial<LookState>): void {
  const next = { ...useLook.getState(), ...look };
  useLook.setState(next);
  const root = document.documentElement;
  root.setAttribute('data-design', next.design);
  root.setAttribute('data-glass', next.glass ? 'on' : 'off');
  write(STORAGE_KEY, next.design);
  write(GLASS_STORAGE_KEY, next.glass ? 'on' : 'off');
  applyTheme((read('ll-theme') as ThemePref | null) ?? 'system');
}

export function applySection(section: Section): void {
  const root = document.documentElement;
  if (root.getAttribute('data-section') === section) return;
  root.setAttribute('data-section', section);
  applyTheme((read('ll-theme') as ThemePref | null) ?? 'system');
}

export async function setDesign(design: Design): Promise<void> {
  applyLook({ design });
  await setRawSetting(DESIGN_KEY, design);
}

export async function setGlass(glass: boolean): Promise<void> {
  applyLook({ glass });
  await setRawSetting(GLASS_KEY, glass);
}

/**
 * Keeps <html> in sync with the saved look (so a restored backup or another tab applies) and with
 * the section of the current route. Until Dexie has answered, the pre-paint mirror stands.
 */
export function useLookSync(): void {
  const { pathname } = useLocation();
  const saved = useLiveQuery(
    async () => ({
      design: await getRawSetting<string>(DESIGN_KEY),
      glass: await getRawSetting<boolean>(GLASS_KEY),
    }),
    [],
  );
  useLayoutEffect(() => {
    applySection(sectionFor(pathname));
  }, [pathname]);
  useLayoutEffect(() => {
    if (!saved) return;
    applyLook({
      design: saved.design === undefined ? useLook.getState().design : parseDesign(saved.design),
      glass: saved.glass === undefined ? useLook.getState().glass : saved.glass,
    });
  }, [saved]);
}

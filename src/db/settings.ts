import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './schema';
import type { SettingsLike } from '@/engine/types';

export type ThemePref = 'system' | 'paper' | 'iron';

export interface Settings extends SettingsLike {
  theme: ThemePref;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  restCompoundSec: 120,
  restIsolationSec: 90,
  warmups: true,
  restAlert: true,
  weekStart: 1,
};

type Key = keyof Settings;

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in out) (out as unknown as Record<string, unknown>)[r.key] = r.value;
  }
  return out;
}

export async function setSetting<K extends Key>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getRawSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}

export async function setRawSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Live settings with defaults applied. Returns defaults while loading. */
export function useSettings(): Settings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS);
}

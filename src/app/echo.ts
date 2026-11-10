import { create } from 'zustand';
import { toast } from '@/components/Toast';
import { celebrateOncePerDay, mergeCelebrations, type CelebratedDay, type Celebration } from '@/engine/echo';
import { dateKey } from '@/engine/week';
import { useLook } from './design';

/**
 * FR-DSN-8 Echo (handoff §6): the two motion events of the Rising Sun look. Screens call
 * `ripple()` when something is logged (a set, a food, a weigh-in) and `celebrate()` /
 * `celebrateOnce()` for a record, a reached food goal or a finished workout. <EchoLayer> draws
 * them. In the classic look both are no-ops (it keeps its own PR stamp).
 */
interface EchoState {
  /** Bumped per ripple; the layer keys its rings on it so each event plays once. */
  ripples: number;
  celebration: (Celebration & { id: number }) | null;
}

export const useEcho = create<EchoState>(() => ({ ripples: 0, celebration: null }));

const STORAGE_KEY = 'll-echo';
/** Reduced motion: the message shows as a toast for this long instead of the rings. */
export const REDUCED_TOAST_MS = 2000;

function sunOn(): boolean {
  return useLook.getState().design === 'sun';
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Set logged, food logged, weigh-in saved: three thin rings from the sun. No message. */
export function ripple(): void {
  if (!sunOn() || prefersReducedMotion()) return;
  useEcho.setState((s) => ({ ripples: s.ripples + 1 }));
}

/** New record, food goal reached, workout finished. Several at once merge into one. */
export function celebrate(c: Celebration): void {
  if (!sunOn()) return;
  if (prefersReducedMotion()) {
    toast([c.title, ...c.lines].join(' · '), REDUCED_TOAST_MS);
    return;
  }
  useEcho.setState((s) => {
    const merged = mergeCelebrations(s.celebration, c);
    return { celebration: { ...merged, id: s.celebration?.id ?? Date.now() } };
  });
}

/**
 * Celebrates each key at most once per day (handoff §6). `lines` maps a key to its line; only the
 * keys not yet celebrated today are shown. Returns the keys that were shown.
 */
export function celebrateOnce(title: string, lines: Record<string, string>, now = Date.now()): string[] {
  if (!sunOn()) return [];
  let seen: CelebratedDay | null = null;
  try {
    seen = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CelebratedDay | null;
  } catch {
    /* ignore */
  }
  const { fresh, next } = celebrateOncePerDay(seen, dateKey(now), Object.keys(lines));
  if (!fresh.length) return [];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  celebrate({ title, lines: fresh.map((k) => lines[k]!) });
  return fresh;
}

export function dismissCelebration(): void {
  useEcho.setState({ celebration: null });
}

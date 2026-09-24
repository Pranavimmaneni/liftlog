/** FR-ONB-4 / FR-RTN-1: split templates and the recommend rule from splits.json. */
import { SPLITS, type SplitSlot, type SplitTemplate } from './data';
import type { Experience } from './types';

export function splitById(id: string): SplitTemplate | undefined {
  return SPLITS.find((s) => s.id === id);
}

/** splits.json recommendRule: "2-3 days → full-body; 4 → upper-lower; 5 → ppl (advanced: body-part); 6 → ppl". */
export function recommendSplit(days: number, level: Experience): string {
  if (days <= 3) return 'full-body';
  if (days === 4) return 'upper-lower';
  if (days === 5) return level === 'advanced' ? 'body-part' : 'ppl';
  return 'ppl';
}

export interface PlannedSession {
  name: string;
  slots: SplitSlot[];
  /** Second PPL pass at 6 days: swap the first compound for an alternative (sixDayNote). */
  secondPass?: boolean;
}

/**
 * Sessions for a template at the user's days per week. PPL at 6 days runs twice (sixDayNote).
 * "Build your own" starts with one empty session per training day.
 */
export function sessionsFor(templateId: string, days: number): PlannedSession[] {
  const t = splitById(templateId);
  if (!t) return [];
  if (t.id === 'custom' || !t.sessions.length) {
    return Array.from({ length: Math.max(1, days) }, (_, i) => ({
      name: `Day ${String.fromCharCode(65 + i)}`,
      slots: [],
    }));
  }
  const base = t.sessions.map((s) => ({ name: s.name, slots: s.slots }));
  if (t.id === 'ppl' && days >= 6) {
    return [...base, ...base.map((s) => ({ name: `${s.name} 2`, slots: s.slots, secondPass: true }))];
  }
  return base;
}

/** Short chip names for S03 ("Up A", "Lo A", "Push", "Full"). */
export function shortName(name: string): string {
  return name
    .replace(/^Upper/, 'Up')
    .replace(/^Lower/, 'Lo')
    .replace(/^Full [A-Z]$/, 'Full');
}

/** Which of the 7 days of a sample week hold a session, for the S03 week strip. */
export function weekLayout(days: number): boolean[] {
  const on: Record<number, number[]> = {
    1: [0],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  const set = new Set(on[Math.max(1, Math.min(7, days))]);
  return Array.from({ length: 7 }, (_, i) => set.has(i));
}

/** Days to preview a template with: the user's days if the template supports them, else its first option. */
export function previewDays(t: SplitTemplate, userDays: number): number {
  const [lo, hi] = [Math.min(...t.daysPerWeek), Math.max(...t.daysPerWeek)];
  if (t.daysPerWeek.length === 1) return t.daysPerWeek[0]!;
  if (t.id === 'ppl') return userDays >= 6 ? 6 : 3;
  return Math.max(lo, Math.min(hi, userDays));
}

/**
 * S03 "Build your own" (FR-ONB-4, FR-RTN-1): the user combines muscle groups per day (e.g. Chest +
 * Biceps, Shoulders + Triceps, Legs + Back). Each group contributes its core movement slots, then extra
 * slots round-robin while the session fits intensity.json sessionMinutesTarget. The slots are filled
 * from the user's gym by the same suggest engine as the split templates (DECISIONS D79).
 */
import musclesJson from '@/data/muscle-days.json';
import { INTENSITY, type SplitSlot } from './data';
import { prescribe, type PrescriptionInput } from './prescription';
import { suggestRoutine, type SuggestContext } from './suggest';
import { sessionsFor, type PlannedSession } from './split';
import { buildRoutine } from './coverage';

export interface MuscleDayGroup {
  id: string;
  name: string;
  core: number;
  slots: SplitSlot[];
}

export const MUSCLE_DAY_GROUPS = (musclesJson as unknown as { groups: MuscleDayGroup[] }).groups;

/** Groups in the order the user picked them (the day's name and lift order follow it); unknown ids dropped. */
export function orderGroups(ids: string[]): MuscleDayGroup[] {
  return [...new Set(ids)]
    .map((id) => MUSCLE_DAY_GROUPS.find((g) => g.id === id))
    .filter((g): g is MuscleDayGroup => !!g);
}

export function dayName(ids: string[], index: number): string {
  const groups = orderGroups(ids);
  return groups.length ? groups.map((g) => g.name).join(' + ') : `Day ${String.fromCharCode(65 + index)}`;
}

const key = (s: SplitSlot) => `${s.pattern}|${s.muscle}|${s.role}`;

function seconds(slots: SplitSlot[], profile: PrescriptionInput): number {
  return slots.reduce(
    (t, s) => t + prescribe(profile, s.role).sets * INTENSITY.secondsPerSetIncludingRest[s.role],
    0,
  );
}

/**
 * Slots for one day. Core slots of every picked group come first (round-robin, so each group gets its
 * main lift early); extras are added round-robin while the estimate stays under the time target.
 * A slot two groups share (e.g. calves in Legs and Calves) is used once, except deliberate repeats
 * within a group (two biceps curls).
 */
export function slotsForDay(groupIds: string[], profile: PrescriptionInput): SplitSlot[] {
  const groups = orderGroups(groupIds);
  const out: SplitSlot[] = [];
  const takenByOtherGroup = new Map<string, string>();
  const push = (g: MuscleDayGroup, s: SplitSlot) => {
    const owner = takenByOtherGroup.get(key(s));
    if (owner && owner !== g.id) return false;
    takenByOtherGroup.set(key(s), g.id);
    out.push(s);
    return true;
  };
  const maxCore = Math.max(0, ...groups.map((g) => g.core));
  for (let i = 0; i < maxCore; i++)
    for (const g of groups) if (i < g.core && g.slots[i]) push(g, g.slots[i]!);
  const budget = INTENSITY.sessionMinutesTarget * 60;
  const maxLen = Math.max(0, ...groups.map((g) => g.slots.length));
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.core || !g.slots[i]) continue;
      if (seconds([...out, g.slots[i]!], profile) > budget) continue;
      push(g, g.slots[i]!);
    }
  }
  return out;
}

/** Planned sessions for the custom days (names from the groups, deduplicated). */
export function customSessions(days: string[][], profile: PrescriptionInput): PlannedSession[] {
  const seen = new Map<string, number>();
  return days.map((ids, i) => {
    let name = dayName(ids, i);
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (n > 1) name = `${name} ${n}`;
    return { name, slots: slotsForDay(ids, profile) };
  });
}

/**
 * The suggested routine for custom days: slots filled from the gym. Unlike templates, no gap-filling
 * pass: the user chose what each day trains.
 */
export function buildCustomRoutine(
  days: string[][],
  ctx: SuggestContext & { profile: PrescriptionInput },
): { name: string; exerciseIds: string[] }[] {
  return suggestRoutine(customSessions(days, ctx.profile), ctx).map((s) => ({
    name: s.name,
    exerciseIds: s.exerciseIds,
  }));
}

/** S03 → S04: the suggested routine for any split; "Build your own" uses the picked muscle days. */
export function suggestForSplit(
  splitId: string,
  daysPerWeek: number,
  customDays: string[][] | undefined,
  ctx: SuggestContext & { profile: PrescriptionInput & { daysPerWeek: number } },
): { name: string; exerciseIds: string[] }[] {
  if (splitId === 'custom' && customDays?.length) return buildCustomRoutine(customDays, ctx);
  return buildRoutine(sessionsFor(splitId, daysPerWeek), ctx);
}

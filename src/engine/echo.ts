/**
 * FR-DSN-8 Echo motion rules (handoff §6), as pure functions: which food goals count as reached,
 * "once per goal per day", and merging celebrations that fire together.
 */

export type FoodGoal = 'kcal' | 'protein' | 'carbs' | 'fat';

export interface GoalNumbers {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Share of the target at which a goal counts as reached. Calories and protein follow the "on
 * target" rule of FR-NUT-1 (D108: from 90% of the target); carbs and fat are reached at the target.
 */
export const REACHED_AT: Record<FoodGoal, number> = { kcal: 0.9, protein: 0.9, carbs: 1, fat: 1 };

const GOALS: FoodGoal[] = ['kcal', 'protein', 'carbs', 'fat'];

/** Goals the day's totals have reached. A missing or zero target is never reached. */
export function goalsReached(eaten: Partial<GoalNumbers>, targets: Partial<GoalNumbers>): FoodGoal[] {
  return GOALS.filter((g) => {
    const t = targets[g] ?? 0;
    return t > 0 && (eaten[g] ?? 0) >= t * REACHED_AT[g];
  });
}

/** Goals reached by this change: reached now and not before it. */
export function newlyReached(
  before: Partial<GoalNumbers>,
  after: Partial<GoalNumbers>,
  targets: Partial<GoalNumbers>,
): FoodGoal[] {
  const had = new Set(goalsReached(before, targets));
  return goalsReached(after, targets).filter((g) => !had.has(g));
}

/** What has already been celebrated today (kept in localStorage, never a running total). */
export interface CelebratedDay {
  date: string;
  keys: string[];
}

/** Keys not yet celebrated on `date`, and the record to store once they have been. */
export function celebrateOncePerDay(
  seen: CelebratedDay | null,
  date: string,
  keys: string[],
): { fresh: string[]; next: CelebratedDay } {
  const today = seen && seen.date === date ? seen.keys : [];
  const fresh = [...new Set(keys)].filter((k) => !today.includes(k));
  return { fresh, next: { date, keys: [...today, ...fresh] } };
}

export interface Celebration {
  title: string;
  lines: string[];
}

/** Several celebrations at once show as one: the first title, every distinct line. */
export function mergeCelebrations(current: Celebration | null, next: Celebration): Celebration {
  if (!current) return { title: next.title, lines: [...new Set(next.lines)] };
  return { title: current.title, lines: [...new Set([...current.lines, ...next.lines])] };
}

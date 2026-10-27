/**
 * PRD-1.2 FR-GAME-1: daily food quests, the weekly food quest and the food streak. Quests reward
 * hitting targets (in range), never eating more. XP is derived from the diary, never stored
 * (FR-XP-1), and adds to the one shared level.
 */
import type { DaySummary } from './food-review';
import { preLiftCarbs } from './coach';
import { FOOD_XP, NUTRITION } from './food-data';

export type QuestId = 'protein' | 'pre-lift-carbs' | 'fibre';

export interface Quest {
  id: QuestId;
  progress: number;
  goal: number;
  done: boolean;
  xp: number;
}

/**
 * Today's quests. Protein counts as done from 90% of target up to 120% (in range, not "more"); the
 * pre-lift quest only appears on a day with a known training time.
 */
export function dailyQuests(day: DaySummary, sessionStart: number | null): Quest[] {
  const protein = day.totals.total.protein ?? 0;
  const fibre = day.totals.total.fibre ?? 0;
  const pShare = day.targets.protein > 0 ? protein / day.targets.protein : 0;
  const quests: Quest[] = [
    {
      id: 'protein',
      progress: Math.round(protein),
      goal: day.targets.protein,
      done: pShare >= NUTRITION.onTarget.proteinMinFraction && pShare <= 1.2,
      xp: FOOD_XP.proteinQuest,
    },
  ];
  if (sessionStart !== null) {
    const carbs = preLiftCarbs([day], [sessionStart])[0]!;
    quests.push({
      id: 'pre-lift-carbs',
      progress: Math.round(carbs),
      goal: NUTRITION.coach.preWorkoutCarbsG,
      done: carbs >= NUTRITION.coach.preWorkoutCarbsG,
      xp: FOOD_XP.preLiftCarbsQuest,
    });
  }
  quests.push({
    id: 'fibre',
    progress: Math.round(fibre),
    goal: day.targets.fibre,
    done: day.targets.fibre > 0 && fibre >= day.targets.fibre,
    xp: FOOD_XP.fibreQuest,
  });
  return quests;
}

/** Weekly quest: protein in range on `weeklyQuestDays` days of the week. */
export function weeklyQuest(week: DaySummary[]): Quest {
  const days = week.filter((d) => dailyQuests(d, null)[0]!.done).length;
  return {
    id: 'protein',
    progress: days,
    goal: FOOD_XP.weeklyQuestDays,
    done: days >= FOOD_XP.weeklyQuestDays,
    xp: FOOD_XP.weeklyQuest,
  };
}

/** XP earned from food over these days (completed daily quests + completed weekly quests). */
export function foodXp(
  days: { day: DaySummary; sessionStart: number | null }[],
  weeks: DaySummary[][],
): number {
  const daily = days.reduce(
    (n, { day, sessionStart }) =>
      n + dailyQuests(day, sessionStart).reduce((m, q) => m + (q.done ? q.xp : 0), 0),
    0,
  );
  return daily + weeks.reduce((n, w) => n + (weeklyQuest(w).done ? FOOD_XP.weeklyQuest : 0), 0);
}

/**
 * Food streak: consecutive days, up to today (or yesterday while today is still open), with food
 * logged in at least `streak.minMeals` meals. `meals` maps date → meals logged.
 */
export function foodStreak(
  meals: Map<string, number>,
  today: string,
  yesterday: (d: string) => string,
): number {
  const ok = (d: string) => (meals.get(d) ?? 0) >= NUTRITION.streak.minMeals;
  let d = ok(today) ? today : yesterday(today);
  let n = 0;
  while (ok(d)) {
    n++;
    d = yesterday(d);
  }
  return n;
}

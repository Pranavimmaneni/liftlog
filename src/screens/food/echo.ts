import { celebrateOnce, ripple } from '@/app/echo';
import { useLook } from '@/app/design';
import { en } from '@/copy/en';
import { db } from '@/db/schema';
import { newlyReached, type GoalNumbers } from '@/engine/echo';
import { sumNutrients } from '@/engine/nutrition';
import { dateKey } from '@/engine/week';

/** The day's calories and macros so far, computed from the diary (never stored). */
async function eatenOn(date: string): Promise<GoalNumbers> {
  const t = sumNutrients(await db.diary.where('date').equals(date).toArray()).total;
  return { kcal: t.kcal ?? 0, protein: t.protein ?? 0, carbs: t.carbs ?? 0, fat: t.fat ?? 0 };
}

/**
 * FR-DSN-8 Echo for Food: runs `log` (which writes diary entries for `date`) and, when that day is
 * today, ripples the sun and celebrates each calorie or macro goal the entry just reached (once a
 * day per goal). The classic look has no Echo, so there it only runs `log`.
 */
export async function logWithEcho<T>(
  date: string,
  targets: Partial<GoalNumbers> | null | undefined,
  log: () => Promise<T>,
): Promise<T> {
  if (useLook.getState().design !== 'sun' || date !== dateKey(Date.now())) return log();
  const before = await eatenOn(date);
  const out = await log();
  ripple();
  if (targets) {
    const fresh = newlyReached(before, await eatenOn(date), targets);
    if (fresh.length)
      celebrateOnce(en.sun.echo.goal, Object.fromEntries(fresh.map((g) => [g, en.sun.echo.goals[g]])));
  }
  return out;
}

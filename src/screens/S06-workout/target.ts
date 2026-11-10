import { en } from '@/copy/en';
import type { ItemModel } from '@/app/session-model';
import { formatLoad, hasLoad } from '@/engine/units';
import type { Units } from '@/engine/types';

/** "3 × 8–10 · 67.5 kg": the planned target of one exercise (FR-WRK-2). */
export function targetLine(item: Pick<ItemModel, 'goal' | 'exercise'>, units: Units): string {
  const g = item.goal;
  const reps = g.repMin === g.repMax ? `${g.repMin}` : `${g.repMin}–${g.repMax}`;
  const lt = item.exercise.loadType;
  if (lt === 'timed') return en.workout.target(g.sets, `${reps} s`, '');
  const load = hasLoad(lt) && g.loadKg !== null ? formatLoad(g.loadKg, lt, units) : '';
  return en.workout.target(g.sets, reps, load);
}

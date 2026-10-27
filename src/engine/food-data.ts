/**
 * Typed access to the Food constants in src/data (copied from /data, NFR-MAINT-2). Kept apart from
 * engine/data.ts so the training screens never load them.
 */
import nutritionJson from '@/data/nutrition.json';
import driJson from '@/data/dri.json';
import xpJson from '@/data/xp.json';
import type { MicroKey } from './food-types';

export type Sex = 'male' | 'female' | 'unspecified';

export const NUTRITION = nutritionJson;
export type NutritionConstants = typeof nutritionJson;

export interface DriTable {
  ageBands: { from: number; to: number }[];
  male: Record<MicroKey, number[]>;
  female: Record<MicroKey, number[]>;
  ul: Partial<Record<MicroKey, number[]>>;
  limits: MicroKey[];
}
export const DRI = driJson as unknown as DriTable;

export const FOOD_XP = xpJson.food;

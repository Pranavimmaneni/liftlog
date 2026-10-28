import { normalizeGtin, type FoodItem } from '@/engine/food-types';

/** PRD-1.2 FR-FOOD-4: what a decoded barcode leads to. */
export type ScanResult =
  { kind: 'invalid' } | { kind: 'found'; gtin: string; food: FoodItem } | { kind: 'missing'; gtin: string };

/** Normalises the code to 14 digits and looks it up (own foods first, then the library). */
export async function resolveScan(
  raw: string,
  lookup: (gtin: string) => Promise<FoodItem | undefined>,
): Promise<ScanResult> {
  const gtin = normalizeGtin(raw);
  if (!gtin) return { kind: 'invalid' };
  const food = await lookup(gtin);
  return food ? { kind: 'found', gtin, food } : { kind: 'missing', gtin };
}

/** Meal and date travel with the scan so the food lands in the right place. */
export function carryParams(from: URLSearchParams, extra: Record<string, string>): string {
  const out = new URLSearchParams();
  for (const k of ['meal', 'date']) {
    const v = from.get(k);
    if (v) out.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) out.set(k, v);
  return out.toString();
}

/** The code as people read it (leading zeros of the 14-digit form dropped, at least 8 digits). */
export function displayCode(gtin: string): string {
  const trimmed = gtin.replace(/^0+/, '');
  return trimmed.length >= 8 ? trimmed : gtin.slice(-8);
}

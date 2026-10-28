import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { en } from '@/copy/en';
import type { FoodItem, Portion } from '@/engine/food-types';
import { scale } from '@/engine/nutrition';
import { Choices, Cta, Label, RoundStepper, SegBar } from './ui';
import { fmt } from './format';

const GRAMS = '__grams';

export interface PortionChoice {
  portion: Portion;
  servings: number;
}

/**
 * F03 portion sheet (PRD-1.2 FR-DIARY-2): pick a unit (the food's own portions, or grams), set the
 * amount with − / +, see kcal and macros, and what this does to today's protein before adding.
 */
export function PortionSheet({
  food,
  open,
  onClose,
  onDone,
  action,
  initial,
  dayProtein,
}: {
  food: FoodItem | null;
  open: boolean;
  onClose: () => void;
  onDone: (choice: PortionChoice) => void;
  /** Button text ("Add to dinner" / "Save"). */
  action: string;
  initial?: PortionChoice;
  /** Today's protein so far and its target, for the "after this" line. */
  dayProtein?: { eaten: number; target: number };
}) {
  const portions = food?.portions.length ? food.portions : [{ label: '100 g', grams: 100 }];
  const [unit, setUnit] = useState<string>(GRAMS);
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(100);

  useEffect(() => {
    if (!food || !open) return;
    const p = initial?.portion ?? portions[0]!;
    const known = portions.findIndex((x) => x.label === p.label && x.grams === p.grams);
    if (initial && known === -1) {
      setUnit(GRAMS);
      setGrams(Math.round(p.grams * initial.servings));
    } else {
      setUnit(String(known === -1 ? 0 : known));
      setServings(initial?.servings ?? 1);
      setGrams(Math.round(p.grams * (initial?.servings ?? 1)));
    }
    // Reset when another food opens; portions derive from food.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food?.id, open]);

  if (!food) return null;
  const isGrams = unit === GRAMS;
  const portion = isGrams ? { label: `${grams} g`, grams } : portions[Number(unit)]!;
  const amount = isGrams ? 1 : servings;
  const total = portion.grams * amount;
  const n = scale(food.per100g, total);
  const choices: [string, string][] = [
    // "100 g" is what "Grams" already offers.
    ...portions
      .map((p, i) => [String(i), p.label.replace(/^1 /, '')] as [string, string])
      .filter(([i]) => portions[Number(i)]!.label !== '100 g' || unit === i)
      .slice(0, 3),
    [GRAMS, en.food.portion.grams],
  ];
  const first = portions[0]!;
  const sub = [
    en.food.add.source[food.source],
    food.brand,
    first.label !== '100 g' ? en.food.portion.oneIs(first.label, first.grams) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const macro = (v: number | null) => (v === null ? '–' : `${fmt(v)} g`);

  return (
    <Sheet open={open} onClose={onClose} title={food.name}>
      <p className="-mt-1 text-[13px] text-ink2">{sub}</p>

      <div className="mt-5">
        <Choices options={choices} value={unit} onChange={setUnit} label={en.food.portion.grams} />
      </div>

      <div className="mt-6">
        {isGrams ? (
          <RoundStepper
            value={fmt(grams)}
            unit={en.food.units.grams}
            canLess={grams > 10}
            onLess={() => setGrams((g) => Math.max(10, g - 10))}
            onMore={() => setGrams((g) => g + 10)}
          />
        ) : (
          <RoundStepper
            value={fmt(servings, 1)}
            unit={portion.label.replace(/^1 /, '')}
            canLess={servings > 0.5}
            onLess={() => setServings((s) => Math.max(0.5, s - 0.5))}
            onMore={() => setServings((s) => s + 0.5)}
          />
        )}
      </div>

      <p className="mt-6 text-center leading-none">
        <span className="t-display text-[40px] font-extrabold">{n.kcal === null ? '–' : fmt(n.kcal)}</span>
        <span className="font-mono text-[13px] text-ink2"> {en.food.units.kcal}</span>
      </p>
      <div className="mt-4 grid grid-cols-3 text-center">
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <div key={k}>
            <p className="font-mono text-[15px]">{macro(n[k])}</p>
            <Label className="mt-1">{en.food.macros[k]}</Label>
          </div>
        ))}
      </div>

      {dayProtein && dayProtein.target > 0 && (
        <div className="mt-6">
          <div className="flex justify-between text-[13px]">
            <span>{en.food.portion.after}</span>
            <span className="font-mono">
              {fmt(dayProtein.eaten + (n.protein ?? 0))}
              <span className="text-ink2">/{fmt(dayProtein.target)} g</span>
            </span>
          </div>
          <div className="mt-2">
            <SegBar
              value={dayProtein.eaten}
              extra={n.protein ?? 0}
              max={dayProtein.target}
              tone="accent"
              label={en.food.portion.after}
            />
          </div>
        </div>
      )}

      <div className="mt-6">
        <Cta onClick={() => onDone({ portion, servings: amount })}>{action}</Cta>
      </div>
    </Sheet>
  );
}

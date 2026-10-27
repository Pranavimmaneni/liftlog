import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { logFood, quickAdd, saveCustomFood, saveRecipe } from '@/db/food';
import { MEAL_SLOTS, type MealSlot } from '@/db/types';
import { emptyNutrients, type FoodItem, type NutrientKey, type Nutrients } from '@/engine/food-types';
import { recipePer100g } from '@/engine/nutrition';
import { searchFoods } from '@/engine/food-search';
import { Choices, Cta, FoodHeader, Label, TextLink, TextTabs } from './ui';
import { useFoodSearch, useToday } from './hooks';

type Tab = 'food' | 'recipe' | 'quick';
const MORE: NutrientKey[] = ['sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'vitD', 'b12'];
const UNIT: Partial<Record<NutrientKey, string>> = {
  kcal: 'kcal',
  sodium: 'mg',
  potassium: 'mg',
  calcium: 'mg',
  iron: 'mg',
  magnesium: 'mg',
  vitD: 'µg',
  b12: 'µg',
};

/** Parses a typed number ("12,5" too); blank → null (unknown, not zero). NaN → undefined (error). */
export function parseAmount(s: string): number | null | undefined {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** FR-FOOD-5: per-serving label values → per-100 g, keeping unknown as null. */
export function perServingTo100g(
  values: Partial<Record<NutrientKey, number | null>>,
  grams: number,
): Nutrients {
  const out = emptyNutrients();
  for (const [k, v] of Object.entries(values) as [NutrientKey, number | null][])
    out[k] = v === null || v === undefined ? null : Math.round(((v * 100) / grams) * 100) / 100;
  return out;
}

function mealByTime(now = new Date()): MealSlot {
  const h = now.getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snacks' : 'dinner';
}

function Field({ label, error, children }: { label: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="border-b border-rule">
      <label className="flex min-h-14 items-center justify-between gap-3 py-2">
        <span className="shrink-0 text-[15px] text-ink2">{label}</span>
        {children}
      </label>
      {error && (
        <p role="alert" className="pb-2 text-[13px] text-accent">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = 'min-w-0 grow bg-transparent text-right text-[16px] outline-none';
const numCls = 'w-24 bg-transparent text-right font-mono text-[16px] outline-none';

function NumField({
  label,
  unit,
  value,
  onChange,
  error,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <Field label={label} error={error}>
      <span className="flex items-baseline gap-1.5">
        <input
          className={numCls}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="w-8 font-mono text-[13px] text-ink2">{unit}</span>
      </span>
    </Field>
  );
}

/**
 * F04 New food (PRD-1.2 FR-FOOD-4/5): a single food from a label, a recipe from ingredients, or a quick
 * add. `?meal=&date=` logs one serving after saving; `?name=` and `?barcode=` prefill (search, scan).
 */
export default function NewFood() {
  const nf = en.food.newFood;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = useToday();
  const meal = (MEAL_SLOTS as string[]).includes(params.get('meal') ?? '')
    ? (params.get('meal') as MealSlot)
    : null;
  const date = params.get('date') ?? (meal ? today : null);
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'food');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // single food
  const [name, setName] = useState(params.get('name') ?? '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(params.get('barcode') ?? '');
  const [servingName, setServingName] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const [values, setValues] = useState<Partial<Record<NutrientKey, string>>>({});
  const [more, setMore] = useState(false);
  // recipe
  const [ingredients, setIngredients] = useState<{ food: FoodItem; grams: string }[]>([]);
  const [yieldGrams, setYieldGrams] = useState('');
  const [servings, setServings] = useState('1');
  const [picking, setPicking] = useState(false);
  // quick add
  const [quickMeal, setQuickMeal] = useState<MealSlot>(meal ?? mealByTime());

  const set = (k: NutrientKey) => (v: string) => setValues((x) => ({ ...x, [k]: v }));

  const done = async (food: FoodItem | null, label: string) => {
    if (food && meal && date) {
      await logFood({ date, meal, food, portion: food.portions[0]!, servings: 1 });
      toast(nf.savedLogged(label, en.food.meals[meal]));
      navigate('/food', { replace: true });
      return;
    }
    toast(nf.saved(label));
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (idx) navigate(-1);
    else navigate('/food', { replace: true });
  };

  const saveFood = async () => {
    const e: Record<string, string> = {};
    const grams = parseAmount(servingGrams);
    const kcal = parseAmount(values.kcal ?? '');
    if (!name.trim()) e.name = nf.errors.name;
    if (!grams) e.grams = nf.errors.grams;
    if (kcal === null || kcal === undefined) e.kcal = nf.errors.kcal;
    const parsed: Partial<Record<NutrientKey, number | null>> = {};
    for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fibre', ...MORE] as NutrientKey[]) {
      const v = parseAmount(values[k] ?? '');
      if (v === undefined) e[k] = nf.errors.number;
      else parsed[k] = v;
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    const row = await saveCustomFood({
      name,
      ...(brand.trim() ? { brand } : {}),
      ...(barcode.trim() ? { barcode } : {}),
      portions: [{ label: servingName.trim() || '1 serving', grams: grams! }],
      per100g: perServingTo100g(parsed, grams!),
    });
    await done(row, row.name);
  };

  const recipe = useMemo(() => {
    const items = ingredients
      .map((i) => ({ per100g: i.food.per100g, grams: parseAmount(i.grams) ?? 0 }))
      .filter((i) => i.grams > 0);
    const raw = items.reduce((n, i) => n + i.grams, 0);
    const y = parseAmount(yieldGrams) || undefined;
    const per100g = recipePer100g(items, y);
    const total = y ?? raw;
    const n = Math.max(1, Math.round(parseAmount(servings) || 1));
    const kcal = per100g.kcal === null ? null : (per100g.kcal * total) / 100 / n;
    return { total, n, kcal, y };
  }, [ingredients, yieldGrams, servings]);

  const saveRecipeTab = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = nf.errors.name;
    if (!ingredients.some((i) => (parseAmount(i.grams) ?? 0) > 0)) e.ingredients = nf.errors.ingredients;
    setErrors(e);
    if (Object.keys(e).length) return;
    const portions = [
      { label: nf.recipe.servingLabel(recipe.n), grams: Math.round((recipe.total / recipe.n) * 10) / 10 },
      ...(recipe.n > 1 ? [{ label: 'whole recipe', grams: recipe.total }] : []),
    ];
    const row = await saveRecipe({
      name,
      ingredients: ingredients
        .map((i) => ({ food: i.food, grams: parseAmount(i.grams) ?? 0 }))
        .filter((i) => i.grams > 0),
      ...(recipe.y ? { yieldGrams: recipe.y } : {}),
      portions,
    });
    await done(row, row.name);
  };

  const saveQuick = async () => {
    const e: Record<string, string> = {};
    const kcal = parseAmount(values.kcal ?? '');
    if (kcal === null || kcal === undefined) e.kcal = nf.errors.kcal;
    const macro = (k: NutrientKey) => parseAmount(values[k] ?? '');
    for (const k of ['protein', 'carbs', 'fat'] as NutrientKey[])
      if (macro(k) === undefined) e[k] = nf.errors.number;
    setErrors(e);
    if (Object.keys(e).length) return;
    const label = name.trim() || nf.tabs.quick;
    await quickAdd({
      date: date ?? today,
      meal: quickMeal,
      name: label,
      kcal: kcal!,
      ...(macro('protein') != null ? { protein: macro('protein')! } : {}),
      ...(macro('carbs') != null ? { carbs: macro('carbs')! } : {}),
      ...(macro('fat') != null ? { fat: macro('fat')! } : {}),
    });
    toast(en.food.add.added(label));
    navigate('/food', { replace: true });
  };

  const save = tab === 'food' ? saveFood : tab === 'recipe' ? saveRecipeTab : saveQuick;

  return (
    <main className="flex grow flex-col bg-paper pb-[calc(110px+env(safe-area-inset-bottom))]">
      <FoodHeader title={nf.title} />
      <div className="px-6 pt-4">
        <TextTabs<Tab>
          label={nf.tabsLabel}
          value={tab}
          onChange={(t) => {
            setTab(t);
            setErrors({});
          }}
          tabs={[
            ['food', nf.tabs.food],
            ['recipe', nf.tabs.recipe],
            ['quick', nf.tabs.quick],
          ]}
        />

        <div className="mt-4">
          <Field label={nf.name} error={errors.name}>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>

        {tab === 'food' && (
          <>
            <Field label={nf.brand}>
              <input
                className={inputCls}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label={nf.servingName}>
              <input
                className={inputCls}
                placeholder={nf.servingNamePlaceholder}
                value={servingName}
                onChange={(e) => setServingName(e.target.value)}
              />
            </Field>
            <NumField
              label={nf.servingGrams}
              unit="g"
              value={servingGrams}
              onChange={setServingGrams}
              error={errors.grams}
            />
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-rule">
              <label className="flex grow items-center justify-between gap-3">
                <span className="text-[15px] text-ink2">{nf.barcode}</span>
                <input
                  className={`${inputCls} font-mono`}
                  inputMode="numeric"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </label>
              <TextLink
                onClick={() =>
                  navigate(
                    `/food/scan?${new URLSearchParams({ ...(meal ? { meal } : {}), ...(date ? { date } : {}) })}`,
                  )
                }
              >
                {nf.scan}
              </TextLink>
            </div>

            <Label className="mt-8">{nf.perServing}</Label>
            <div className="mt-1">
              <NumField
                label={nf.kcal}
                unit="kcal"
                value={values.kcal ?? ''}
                onChange={set('kcal')}
                error={errors.kcal}
              />
              {(['protein', 'carbs', 'fat', 'fibre'] as NutrientKey[]).map((k) => (
                <NumField
                  key={k}
                  label={nf[k as 'protein']}
                  unit="g"
                  value={values[k] ?? ''}
                  onChange={set(k)}
                  error={errors[k]}
                />
              ))}
              {more &&
                MORE.map((k) => (
                  <NumField
                    key={k}
                    label={en.food.micros[k as 'sodium']}
                    unit={UNIT[k]!}
                    value={values[k] ?? ''}
                    onChange={set(k)}
                    error={errors[k]}
                  />
                ))}
            </div>
            <div className="mt-3">
              <TextLink aria-expanded={more} onClick={() => setMore(!more)}>
                {more ? nf.fewerNutrients : nf.moreNutrients}
              </TextLink>
            </div>
            <p className="mt-2 text-[13px] text-ink2">{nf.unknownNote}</p>
          </>
        )}

        {tab === 'recipe' && (
          <>
            <Label className="mt-8">{nf.recipe.ingredients}</Label>
            <ul className="mt-1">
              {ingredients.map((i, idx) => (
                <li
                  key={`${i.food.id}-${idx}`}
                  className="flex min-h-14 items-center gap-2 border-b border-rule"
                >
                  <span className="min-w-0 grow text-[15px]">{i.food.name}</span>
                  <label className="flex items-baseline gap-1">
                    <span className="sr-only">{nf.recipe.grams(i.food.name)}</span>
                    <input
                      className="w-16 bg-transparent text-right font-mono text-[16px] outline-none"
                      inputMode="decimal"
                      value={i.grams}
                      onChange={(e) =>
                        setIngredients((xs) =>
                          xs.map((x, j) => (j === idx ? { ...x, grams: e.target.value } : x)),
                        )
                      }
                    />
                    <span className="font-mono text-[13px] text-ink2">g</span>
                  </label>
                  <button
                    type="button"
                    className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-ink2"
                    aria-label={nf.recipe.remove(i.food.name)}
                    onClick={() => setIngredients((xs) => xs.filter((_, j) => j !== idx))}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            {!ingredients.length && <p className="mt-2 text-[14px] text-ink2">{nf.recipe.none}</p>}
            {errors.ingredients && (
              <p role="alert" className="mt-2 text-[13px] text-accent">
                {errors.ingredients}
              </p>
            )}
            <div className="mt-2">
              <TextLink onClick={() => setPicking(true)}>{nf.recipe.addIngredient}</TextLink>
            </div>
            <div className="mt-4">
              <NumField label={nf.recipe.yield} unit="g" value={yieldGrams} onChange={setYieldGrams} />
              <NumField label={nf.recipe.servings} unit="" value={servings} onChange={setServings} />
            </div>
            <p className="mt-2 text-[13px] text-ink2">{nf.recipe.yieldHint}</p>
            {recipe.kcal !== null && recipe.total > 0 && (
              <p className="mt-3 font-mono text-[14px]">
                {nf.recipe.perServing(String(Math.round(recipe.kcal)))}
              </p>
            )}
            <IngredientPicker
              open={picking}
              onClose={() => setPicking(false)}
              onPick={(food) => {
                setIngredients((xs) => [...xs, { food, grams: String(food.portions[0]?.grams ?? 100) }]);
                setPicking(false);
              }}
            />
          </>
        )}

        {tab === 'quick' && (
          <>
            <p className="mt-3 text-[13px] text-ink2">{nf.quick.hint}</p>
            <div className="mt-2">
              <NumField
                label={nf.kcal}
                unit="kcal"
                value={values.kcal ?? ''}
                onChange={set('kcal')}
                error={errors.kcal}
              />
              {(['protein', 'carbs', 'fat'] as NutrientKey[]).map((k) => (
                <NumField
                  key={k}
                  label={nf[k as 'protein']}
                  unit="g"
                  value={values[k] ?? ''}
                  onChange={set(k)}
                  error={errors[k]}
                />
              ))}
            </div>
            <Label className="mt-6">{nf.quick.meal}</Label>
            <div className="mt-2">
              <Choices<MealSlot>
                label={nf.quick.meal}
                value={quickMeal}
                onChange={setQuickMeal}
                options={MEAL_SLOTS.map((m) => [m, en.food.meals[m]])}
              />
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] bg-paper px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3">
        <Cta onClick={() => void save()}>{nf.save}</Cta>
      </div>
    </main>
  );
}

function IngredientPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (f: FoodItem) => void;
}) {
  const nf = en.food.newFood;
  const today = useToday();
  const { index, boost } = useFoodSearch(today);
  const [q, setQ] = useState('');
  const hits = useMemo(
    () => (index && q.trim() ? searchFoods(index, q, { limit: 30, boost }) : []),
    [index, q, boost],
  );
  return (
    <Sheet open={open} onClose={onClose} title={nf.recipe.pick}>
      <label className="flex h-[52px] items-center gap-2.5 rounded-full border border-rule bg-card px-4">
        <Icon name="search" size={20} className="shrink-0 text-ink2" />
        <input
          type="search"
          className="h-full w-full bg-transparent text-[16px] outline-none"
          aria-label={nf.recipe.search}
          placeholder={nf.recipe.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <ul className="mt-2">
        {hits.map(({ food }) => (
          <li key={food.id} className="border-b border-rule">
            <button
              type="button"
              className="flex min-h-14 w-full items-center text-left text-[15px]"
              onClick={() => onPick(food)}
            >
              <span className="grow">
                {food.name}
                {food.brand && <span className="block text-[13px] text-ink2">{food.brand}</span>}
              </span>
              <Icon name="plus" size={20} />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

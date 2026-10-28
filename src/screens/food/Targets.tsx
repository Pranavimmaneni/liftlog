import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '@/components/Sheet';
import { Switch } from '@/components/Switch';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { getRawSetting, setRawSetting } from '@/db/settings';
import { saveProfile, useBodyweights, useProfile } from '@/db/repo';
import type { Activity, DietPhase } from '@/db/types';
import { displayNumber } from '@/engine/units';
import { NUTRITION } from '@/engine/food-data';
import { MICROS } from '@/engine/food-types';
import type { MacroOverrides } from '@/engine/macros';
import { WeighInSheet } from '../S20-weighin/WeighInSheet';
import { defaultPhase, FOOD_KEYS, useFoodTargets, useToday, type FoodTargets } from './hooks';
import { BigNumber, Choices, Cta, FieldRow, FoodHeader, Label, RoundStepper, TextLink } from './ui';

const t = en.food.targets;
const n = (v: number) => Math.round(v).toLocaleString('en');
type Macro = 'protein' | 'carbs' | 'fat';
type SheetKind = 'weight' | 'height' | 'activity' | 'goal' | 'micros' | Macro | null;

const MICRO_UNITS: Record<(typeof MICROS)[number], string> = {
  fibre: en.food.units.g,
  sodium: en.food.units.mg,
  potassium: en.food.units.mg,
  calcium: en.food.units.mg,
  iron: en.food.units.mg,
  magnesium: en.food.units.mg,
  vitD: en.food.units.ug,
  b12: en.food.units.ug,
};

/** The one-line explanation of the calorie number (FR-TGT-2: every automated number has a reason). */
export function targetReason(x: FoodTargets): string {
  const e = x.energy;
  const parts = [t.burn(n(e.burn))];
  if (e.floored) parts.push(t.floored(n(e.kcal)));
  else if (e.adjust > 0) parts.push(t.plus(n(e.adjust)));
  else if (e.adjust < 0) parts.push(t.minus(n(-e.adjust)));
  else parts.push(t.maintain);
  return parts.join(' ');
}

/**
 * F05 Targets (PRD-1.2 FR-TGT-1..4, FR-TGT-6): the coach's calorie and macro pick with its reason,
 * and the inputs it comes from. Weight, height, sex and age are shared with LiftLog (FR-SHR-1).
 */
export default function Targets() {
  const today = useToday();
  const profile = useProfile();
  const weighIns = useBodyweights();
  const { targets } = useFoodTargets(today);
  const settings = useLiveQuery(async () => ({
    cycling: !!(await getRawSetting<boolean>(FOOD_KEYS.carbCycling)),
    overrides: (await getRawSetting<MacroOverrides>(FOOD_KEYS.overrides)) ?? {},
  }));
  const [sheet, setSheet] = useState<SheetKind>(null);
  if (!profile || !weighIns || !settings) return null;
  const units = profile.units;
  const lastKg = [...weighIns].sort((a, b) => a.date.localeCompare(b.date)).pop()?.kg ?? null;
  const close = () => setSheet(null);
  const weightSheet = (
    <WeighInSheet open={sheet === 'weight'} onClose={close} lastKg={lastKg} units={units} />
  );

  if (!targets)
    return (
      <main className="pb-10">
        <FoodHeader title={t.title} />
        <div className="px-6 pt-8">
          <p className="text-[15px]">{t.noWeight}</p>
          <Cta className="mt-6" onClick={() => setSheet('weight')}>
            {t.logWeight}
          </Cta>
        </div>
        {weightSheet}
      </main>
    );

  const phase = targets.phase;
  const rate = targets.rateKgPerWeek;
  const defaults = targets.energy.defaults.filter((d) => d !== 'sex' || !profile.sex);
  const macroCol = (k: Macro) => (
    <button
      type="button"
      className="min-h-11 text-left"
      aria-label={`${en.food.macros[k]} ${targets.macros[k]} ${en.food.units.g}`}
      onClick={() => setSheet(k)}
    >
      <Label>{en.food.macros[k]}</Label>
      <p className="mt-2 font-mono text-[15px]">
        {targets.macros[k]} {en.food.units.g}
        {targets.macros.overridden.includes(k) && <span className="text-ink2"> · {t.edited}</span>}
      </p>
    </button>
  );

  return (
    <main className="pb-10">
      <FoodHeader title={t.title} />
      <div className="px-6">
        <Label className="mt-8">{t.kcalLabel}</Label>
        <div className="mt-2" data-testid="target-kcal">
          <BigNumber value={n(targets.macros.kcal)} size={80} />
        </div>
        <p className="mt-4 text-[13px] text-ink2" data-testid="target-reason">
          {targetReason(targets)}
        </p>
        {defaults.length > 0 && (
          <p className="mt-2 text-[13px] text-ink2">
            {t.defaults(defaults.map((d) => t.defaultNames[d]).join(', '))}
          </p>
        )}

        <div className="mt-8 grid grid-cols-3 gap-5">
          {macroCol('protein')}
          {macroCol('carbs')}
          {macroCol('fat')}
        </div>

        <div className="mt-8 border-t border-rule">
          <FieldRow
            label={t.weight}
            value={lastKg === null ? t.notSet : `${displayNumber(lastKg, units)} ${units}`}
            onClick={() => setSheet('weight')}
          />
          <FieldRow
            label={t.height}
            value={profile.heightCm ? `${profile.heightCm} ${t.heightUnit}` : t.notSet}
            muted={!profile.heightCm}
            onClick={() => setSheet('height')}
          />
          <FieldRow
            label={t.activity}
            value={profile.activity ? t.activities[profile.activity].name : t.notSet}
            muted={!profile.activity}
            onClick={() => setSheet('activity')}
          />
          <FieldRow
            label={t.goal}
            value={t.phaseValue(t.phases[phase], phase === 'maintain' ? '' : String(rate))}
            onClick={() => setSheet('goal')}
          />
          {(!profile.sex || profile.sex === 'unspecified' || !profile.birthYear) && (
            <Link
              to="/progress/body-stats"
              className="flex min-h-14 items-center justify-between gap-3 border-b border-rule py-2 text-ink no-underline"
            >
              <span className="text-[15px]">{t.bodyStats}</span>
              <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">
                {t.bodyStatsAdd}
              </span>
            </Link>
          )}
          <FieldRow
            label={t.micros}
            value={t.microsCount(MICROS.length)}
            muted
            onClick={() => setSheet('micros')}
          />
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-rule py-1">
            <span className="text-[15px]">{t.carbCycling}</span>
            <Switch
              checked={settings.cycling}
              label={t.carbCycling}
              onChange={(v) => void setRawSetting(FOOD_KEYS.carbCycling, v)}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink2">{t.disclaimer}</span>
          <TextLink
            onClick={async () => {
              await setRawSetting(FOOD_KEYS.overrides, {});
              toast(t.resetDone);
            }}
          >
            {t.reset}
          </TextLink>
        </div>
      </div>

      {weightSheet}
      <HeightSheet open={sheet === 'height'} onClose={close} cm={profile.heightCm ?? null} />
      <ActivitySheet open={sheet === 'activity'} onClose={close} value={profile.activity ?? null} />
      <GoalSheet
        open={sheet === 'goal'}
        onClose={close}
        phase={phase}
        rate={rate}
        fallback={defaultPhase(profile.goal)}
      />
      <Sheet open={sheet === 'micros'} onClose={close} title={t.microsTitle}>
        <ul className="border-t border-rule">
          {MICROS.map((k) => (
            <li
              key={k}
              className="flex min-h-12 items-center justify-between border-b border-rule text-[15px]"
            >
              <span>{en.food.micros[k]}</span>
              <span className="font-mono">
                {targets.micros[k].kind === 'limit'
                  ? `< ${n(targets.micros[k].value)}`
                  : targets.micros[k].value.toLocaleString('en')}{' '}
                {MICRO_UNITS[k]}
                {targets.micros[k].kind === 'limit' && <span className="text-ink2"> · {t.limit}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-ink2">{t.microsSource}</p>
      </Sheet>
      {(['protein', 'carbs', 'fat'] as const).map((k) => (
        <MacroSheet
          key={k}
          macro={k}
          open={sheet === k}
          onClose={close}
          value={targets.macros[k]}
          overrides={settings.overrides}
        />
      ))}
    </main>
  );
}

function HeightSheet({ open, onClose, cm }: { open: boolean; onClose: () => void; cm: number | null }) {
  const [value, setValue] = useState(cm ?? NUTRITION.energy.defaults.heightCm);
  useEffect(() => {
    if (open) setValue(cm ?? NUTRITION.energy.defaults.heightCm);
  }, [open, cm]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.heightTitle}
      footer={
        <Button
          onClick={async () => {
            await saveProfile({ heightCm: value });
            onClose();
          }}
        >
          {t.save}
        </Button>
      }
    >
      <label className="sr-only" htmlFor="food-height">
        {t.heightLabel}
      </label>
      <div id="food-height">
        <RoundStepper
          value={String(value)}
          unit={t.heightUnit}
          onLess={() => setValue((v) => Math.max(120, v - 1))}
          onMore={() => setValue((v) => Math.min(230, v + 1))}
        />
      </div>
    </Sheet>
  );
}

function ActivitySheet({
  open,
  onClose,
  value,
}: {
  open: boolean;
  onClose: () => void;
  value: Activity | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={t.activityTitle}>
      <div role="radiogroup" aria-label={t.activityTitle} className="flex flex-col gap-2">
        {(Object.keys(t.activities) as Activity[]).map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={value === a}
            className={`min-h-14 rounded-lg border px-4 py-2 text-left ${
              value === a ? 'border-ink bg-ink text-card' : 'border-rule'
            }`}
            onClick={async () => {
              await saveProfile({ activity: a });
              onClose();
            }}
          >
            <span className="block text-[15px] font-semibold">{t.activities[a].name}</span>
            <span className={`block text-[13px] ${value === a ? '' : 'text-ink2'}`}>
              {t.activities[a].desc}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function GoalSheet({
  open,
  onClose,
  phase,
  rate,
  fallback,
}: {
  open: boolean;
  onClose: () => void;
  phase: DietPhase;
  rate: number;
  fallback: { phase: DietPhase; rateKgPerWeek: number };
}) {
  const [p, setP] = useState<DietPhase>(phase);
  const [r, setR] = useState(rate);
  useEffect(() => {
    if (!open) return;
    setP(phase);
    setR(rate);
  }, [open, phase, rate]);
  const rates = NUTRITION.phase.rates[p];
  const pick = (next: DietPhase) => {
    setP(next);
    const opts = NUTRITION.phase.rates[next];
    setR(opts.includes(r) ? r : (NUTRITION.phase.defaultRate[next] ?? fallback.rateKgPerWeek));
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.goalTitle}
      footer={
        <Button
          onClick={async () => {
            await saveProfile({ diet: { phase: p, rateKgPerWeek: p === 'maintain' ? 0 : r } });
            onClose();
          }}
        >
          {t.save}
        </Button>
      }
    >
      <Choices
        label={t.goalTitle}
        value={p}
        onChange={pick}
        options={(['lose', 'maintain', 'gain'] as const).map((x) => [x, t.phases[x]])}
      />
      {p !== 'maintain' && (
        <>
          <Label className="mt-6">{t.rate}</Label>
          <div className="mt-2">
            <Choices
              label={t.rate}
              value={String(r)}
              onChange={(v) => setR(Number(v))}
              options={rates.map((x) => [String(x), t.rateOption(x)])}
            />
          </div>
        </>
      )}
    </Sheet>
  );
}

function MacroSheet({
  macro,
  open,
  onClose,
  value,
  overrides,
}: {
  macro: Macro;
  open: boolean;
  onClose: () => void;
  value: number;
  overrides: MacroOverrides;
}) {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (open) setV(value);
  }, [open, value]);
  const name = en.food.macros[macro];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.macroTitle(name)}
      footer={
        <>
          <Button
            onClick={async () => {
              await setRawSetting(FOOD_KEYS.overrides, { ...overrides, [macro]: v });
              onClose();
            }}
          >
            {t.save}
          </Button>
          {overrides[macro] !== undefined && (
            <Button
              variant="secondary"
              onClick={async () => {
                const { [macro]: _drop, ...rest } = overrides;
                await setRawSetting(FOOD_KEYS.overrides, rest);
                onClose();
              }}
            >
              {t.resetMacro}
            </Button>
          )}
        </>
      }
    >
      <RoundStepper
        value={String(v)}
        unit={en.food.units.grams}
        canLess={v > 0}
        onLess={() => setV((x) => Math.max(0, x - 5))}
        onMore={() => setV((x) => x + 5)}
      />
    </Sheet>
  );
}

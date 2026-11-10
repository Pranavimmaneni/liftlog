import { useState, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { ToggleChip } from '@/components/Chip';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import type { OnboardingDraft } from '@/db/repo';
import { EQUIPMENT, MACHINES } from '@/engine/data';
import { presetGym } from '@/engine/suggest';
import type { Units } from '@/engine/types';
import { BottomCta, Pill, StepHeader, SunIntro, Title } from './shared';

/** DECISIONS D8: the 12 most common machines first (the mockup's set), the rest behind "More machines". */
export const COMMON_MACHINES: [string, string][] = [
  ['lat-pulldown', 'Lat pulldown'],
  ['cable-tower', 'Cable tower'],
  ['seated-row', 'Seated row'],
  ['chest-press', 'Chest press'],
  ['shoulder-press', 'Shoulder press'],
  ['pec-deck', 'Pec deck'],
  ['leg-press', 'Leg press'],
  ['leg-extension', 'Leg extension'],
  ['seated-leg-curl', 'Leg curl'],
  ['hack-squat', 'Hack squat'],
  ['smith-machine', 'Smith machine'],
  ['assisted-pullup', 'Assisted pull-up'],
];
/** Listed as machines in machines.json but already toggled as equipment (DECISIONS D39). */
const AS_EQUIPMENT = new Set(['pullup-bar', 'dip-station']);
export const ALL_MACHINES = MACHINES.filter((m) => !AS_EQUIPMENT.has(m.id));
const OTHER_MACHINES = ALL_MACHINES.filter((m) => !COMMON_MACHINES.some(([id]) => id === m.id)).map(
  (m) => [m.id, m.name] as [string, string],
);
export const LIMITATION_AREAS = ['lower back', 'knees', 'shoulders', 'wrists'];
const FREE_WEIGHTS = EQUIPMENT.filter(
  (e) => !['flat-bench', 'squat-rack', 'resistance-bands', 'trap-bar'].includes(e.id),
);
const MORE_EQUIPMENT = EQUIPMENT.filter((e) => !FREE_WEIGHTS.includes(e));

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** The gym editor used by S02 and Settings → My gym (FR-ONB-3, FR-GYM-1, FR-GYM-5). */
export function GymEditor({
  value,
  onChange,
  showUnits = true,
}: {
  value: Pick<OnboardingDraft, 'presetId' | 'equipmentIds' | 'machineIds' | 'limitations' | 'units'>;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  showUnits?: boolean;
}) {
  const [more, setMore] = useState(false);
  const [moreEq, setMoreEq] = useState(false);
  const machineCount = value.machineIds.filter((id) => !AS_EQUIPMENT.has(id)).length;
  const s2 = en.onboarding.s2;
  const sun = useDesign() === 'sun';
  const tog = (key: string, on: boolean, onClick: () => void, name: ReactNode) =>
    sun ? (
      <Pill key={key} check on={on} onClick={onClick}>
        {name}
      </Pill>
    ) : (
      <ToggleChip key={key} large check on={on} onClick={onClick}>
        {name}
      </ToggleChip>
    );
  const link = sun ? 'll-link min-h-11 px-1' : 'll-link';

  const preset = (
    <SegmentedControl
      label={en.settings.myGym}
      height={52}
      value={value.presetId}
      onChange={(presetId) => onChange({ presetId, ...presetGym(presetId) })}
      options={Object.entries(s2.presets).map(([v, label]) => ({ value: v, label }))}
    />
  );
  const freeWeights = (
    <>
      {(moreEq ? [...FREE_WEIGHTS, ...MORE_EQUIPMENT] : FREE_WEIGHTS).map((e) =>
        tog(
          e.id,
          value.equipmentIds.includes(e.id),
          () => onChange({ equipmentIds: toggle(value.equipmentIds, e.id) }),
          e.name,
        ),
      )}
      <button type="button" className={link} aria-expanded={moreEq} onClick={() => setMoreEq(!moreEq)}>
        {moreEq ? s2.fewerEquipment : s2.moreEquipment(MORE_EQUIPMENT.length)}
      </button>
    </>
  );
  const machines = (
    <>
      {(more ? [...COMMON_MACHINES, ...OTHER_MACHINES] : COMMON_MACHINES).map(([id, name]) =>
        tog(
          id,
          value.machineIds.includes(id),
          () => onChange({ machineIds: toggle(value.machineIds, id) }),
          name,
        ),
      )}
      <button type="button" className={link} aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? s2.fewerMachines : s2.moreMachines(OTHER_MACHINES.length)}
      </button>
    </>
  );
  const limitations = LIMITATION_AREAS.map((a) =>
    tog(
      a,
      value.limitations.includes(a),
      () => onChange({ limitations: toggle(value.limitations, a) }),
      s2.limitations[a],
    ),
  );
  const units = (
    <SegmentedControl<Units>
      className="w-[142px]"
      label={s2.units}
      value={value.units}
      onChange={(u) => onChange({ units: u })}
      options={[
        { value: 'kg', label: en.units.kg },
        { value: 'lb', label: en.units.lb },
      ]}
    />
  );

  // Rising Sun (FR-DSN-10, HW1S02): each group of toggles on its own glass card. The mockup's switch
  // list would run to 25 rows with the real equipment, so the groups keep their chips.
  if (sun) {
    const card = 'sun-glass sun-setup-group mx-5 mt-3 rounded-[14px] p-4';
    const head = 'text-[15px] font-bold';
    return (
      <>
        <div className="px-5 pt-3">{preset}</div>
        <section className={card}>
          <h2 className={head} id="fw-label">
            {s2.freeWeights}
          </h2>
          <div role="group" aria-labelledby="fw-label" className="mt-2.5 flex flex-wrap items-center gap-2">
            {freeWeights}
          </div>
        </section>
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={head} id="m-label">
              {s2.machines}
            </h2>
            <span className="text-[14px] tabular-nums text-ink2" aria-live="polite">
              {s2.machinesCount(machineCount, ALL_MACHINES.length)}
            </span>
          </div>
          <div role="group" aria-labelledby="m-label" className="mt-2.5 flex flex-wrap items-center gap-2">
            {machines}
          </div>
        </section>
        <section className={card}>
          <h2 className={head} id="lim-label">
            {s2.goEasy}
          </h2>
          <div role="group" aria-labelledby="lim-label" className="mt-2.5 flex flex-wrap gap-2">
            {limitations}
          </div>
        </section>
        {showUnits && (
          <section className={`${card} flex items-center justify-between gap-4 !py-3`}>
            <h2 className={head}>{s2.units}</h2>
            {units}
          </section>
        )}
      </>
    );
  }
  return (
    <>
      <div className="px-5 pt-4">{preset}</div>

      <h2 className="t-label px-5 pb-2.5 pt-4" id="fw-label">
        {s2.freeWeights}
      </h2>
      <div role="group" aria-labelledby="fw-label" className="flex flex-wrap gap-2 px-5">
        {freeWeights}
      </div>

      <div className="flex items-center justify-between px-5 pb-2.5 pt-4">
        <h2 className="t-label" id="m-label">
          {s2.machines}
        </h2>
        <span className="t-label" aria-live="polite">
          {s2.machinesCount(machineCount, ALL_MACHINES.length)}
        </span>
      </div>
      <div role="group" aria-labelledby="m-label" className="flex flex-wrap gap-2 px-5">
        {machines}
      </div>

      <h2 className="t-label px-5 pb-2.5 pt-4" id="lim-label">
        {s2.goEasy}
      </h2>
      <div role="group" aria-labelledby="lim-label" className="flex flex-wrap gap-2 px-5">
        {limitations}
      </div>

      {showUnits && (
        <div className="flex items-center justify-between gap-4 px-5 pt-5">
          <h2 className="t-label">{s2.units}</h2>
          {units}
        </div>
      )}
    </>
  );
}

/** S02 Onboarding 2: your gym (FR-ONB-3). */
export function S02Gym({
  draft,
  onChange,
  onNext,
  onBack,
}: {
  draft: OnboardingDraft;
  onChange: (d: OnboardingDraft) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const sun = useDesign() === 'sun';
  return (
    <main className="flex min-h-dvh flex-col">
      <StepHeader step={2} name={en.onboarding.s2.name} onBack={onBack} />
      {sun ? (
        <div className="sun-glass mx-5 mt-3 rounded-[14px] p-4">
          <SunIntro title={en.onboarding.s2.title}>{en.onboarding.s2.body}</SunIntro>
        </div>
      ) : (
        <Title sub={en.onboarding.s2.body}>{en.onboarding.s2.title}</Title>
      )}
      <GymEditor value={draft} onChange={(p) => onChange({ ...draft, ...p })} />
      <BottomCta>
        <Button onClick={onNext}>{en.onboarding.s2.cta}</Button>
      </BottomCta>
    </main>
  );
}

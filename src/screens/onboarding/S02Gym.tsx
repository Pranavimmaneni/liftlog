import { useState } from 'react';
import { Button } from '@/components/Button';
import { ToggleChip } from '@/components/Chip';
import { SegmentedControl } from '@/components/SegmentedControl';
import { en } from '@/copy/en';
import type { OnboardingDraft } from '@/db/repo';
import { EQUIPMENT, MACHINES } from '@/engine/data';
import { presetGym } from '@/engine/suggest';
import type { Units } from '@/engine/types';
import { BottomCta, StepHeader, Title } from './shared';

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
  return (
    <>
      <div className="px-5 pt-4">
        <SegmentedControl
          label={en.settings.myGym}
          height={52}
          value={value.presetId}
          onChange={(presetId) => onChange({ presetId, ...presetGym(presetId) })}
          options={Object.entries(s2.presets).map(([v, label]) => ({ value: v, label }))}
        />
      </div>

      <h2 className="t-label px-5 pb-2.5 pt-4" id="fw-label">
        {s2.freeWeights}
      </h2>
      <div role="group" aria-labelledby="fw-label" className="flex flex-wrap gap-2 px-5">
        {(moreEq ? [...FREE_WEIGHTS, ...MORE_EQUIPMENT] : FREE_WEIGHTS).map((e) => (
          <ToggleChip
            key={e.id}
            large
            check
            on={value.equipmentIds.includes(e.id)}
            onClick={() => onChange({ equipmentIds: toggle(value.equipmentIds, e.id) })}
          >
            {e.name}
          </ToggleChip>
        ))}
        <button type="button" className="ll-link" aria-expanded={moreEq} onClick={() => setMoreEq(!moreEq)}>
          {moreEq ? s2.fewerEquipment : s2.moreEquipment(MORE_EQUIPMENT.length)}
        </button>
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
        {(more ? [...COMMON_MACHINES, ...OTHER_MACHINES] : COMMON_MACHINES).map(([id, name]) => (
          <ToggleChip
            key={id}
            large
            check
            on={value.machineIds.includes(id)}
            onClick={() => onChange({ machineIds: toggle(value.machineIds, id) })}
          >
            {name}
          </ToggleChip>
        ))}
        <button type="button" className="ll-link" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? s2.fewerMachines : s2.moreMachines(OTHER_MACHINES.length)}
        </button>
      </div>

      <h2 className="t-label px-5 pb-2.5 pt-4" id="lim-label">
        {s2.goEasy}
      </h2>
      <div role="group" aria-labelledby="lim-label" className="flex flex-wrap gap-2 px-5">
        {LIMITATION_AREAS.map((a) => (
          <ToggleChip
            key={a}
            large
            check
            on={value.limitations.includes(a)}
            onClick={() => onChange({ limitations: toggle(value.limitations, a) })}
          >
            {s2.limitations[a]}
          </ToggleChip>
        ))}
      </div>

      {showUnits && (
        <div className="flex items-center justify-between gap-4 px-5 pt-5">
          <h2 className="t-label">{s2.units}</h2>
          <SegmentedControl<Units>
            className="w-[142px]"
            label={s2.units}
            value={value.units}
            onChange={(units) => onChange({ units })}
            options={[
              { value: 'kg', label: en.units.kg },
              { value: 'lb', label: en.units.lb },
            ]}
          />
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
  return (
    <main className="flex min-h-dvh flex-col">
      <StepHeader step={2} name={en.onboarding.s2.name} onBack={onBack} />
      <Title sub={en.onboarding.s2.body}>{en.onboarding.s2.title}</Title>
      <GymEditor value={draft} onChange={(p) => onChange({ ...draft, ...p })} />
      <BottomCta>
        <Button onClick={onNext}>{en.onboarding.s2.cta}</Button>
      </BottomCta>
    </main>
  );
}

import { useState } from 'react';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { saveGym, saveProfile, useGym, useProfile } from '@/db/repo';
import { addCustomMachine, deleteCustomMachine, useCustomMachines } from '@/db/machines';
import { fromDisplay, toDisplay } from '@/engine/units';
import type { LoadType } from '@/engine/types';
import { GymEditor } from '../onboarding/S02Gym';

/** Settings → My gym (FR-GYM-1, FR-GYM-4, FR-GYM-5): the same editor as S02, saved as you tap. */
export default function GymSettings() {
  const gym = useGym();
  const profile = useProfile();
  const customs = useCustomMachines();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('selectorized');
  const [loadType, setLoadType] = useState<LoadType>('machine_stack');
  const [inc, setInc] = useState<number | null>(5);
  const m = en.machine;
  if (!gym || !profile) return null;
  const units = profile.units;
  return (
    <main className="pb-10">
      <ScreenHeader title={en.settings.myGym} backTo="/settings" />
      <GymEditor
        showUnits={false}
        value={{ ...gym, limitations: profile.limitations, units: profile.units }}
        onChange={(p) => {
          const { limitations, units: _u, ...rest } = p;
          if (limitations) void saveProfile({ limitations });
          if (Object.keys(rest).length)
            void saveGym({
              presetId: gym.presetId,
              equipmentIds: gym.equipmentIds,
              machineIds: gym.machineIds,
              ...rest,
            });
        }}
      />
      <SectionLabel>{m.customList}</SectionLabel>
      <div className="ll-card mx-5">
        {(customs ?? []).map((c) => (
          <div key={c.machineId} className="ll-row">
            <span className="grow">
              <span className="block text-[15px] font-semibold">{c.custom!.name}</span>
              <span className="t-mono block text-[11px] text-ink2">
                {m.categories[c.custom!.category] ?? c.custom!.category} ·{' '}
                {Math.round(toDisplay(c.custom!.incrementKg, units) * 10) / 10} {units}
              </span>
            </span>
            <button
              type="button"
              className="ll-icon-btn !border-0 !bg-transparent text-accent"
              aria-label={`${en.common.delete} ${c.custom!.name}`}
              onClick={() => void deleteCustomMachine(c.machineId)}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ll-row w-full text-left font-semibold"
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" /> {m.customTitle}
        </button>
      </div>
      <p className="mx-5 mt-4 text-[13px] text-ink2">{en.settings.gymNote}</p>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={m.customTitle}
        footer={
          <Button
            disabled={!name.trim() || !inc}
            onClick={async () => {
              await addCustomMachine({
                name: name.trim(),
                category,
                loadType,
                incrementKg: fromDisplay(inc!, units),
              });
              toast(m.customAdded(name.trim()));
              setName('');
              setAdding(false);
            }}
          >
            {m.customAdd}
          </Button>
        }
      >
        <label className="block">
          <span className="t-label">{m.customName}</span>
          <input className="ll-input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mt-3 block">
          <span className="t-label">{m.customCategory}</span>
          <select className="ll-input mt-1.5" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(m.categories).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="t-label">{m.customLoadType}</span>
          <select
            className="ll-input mt-1.5"
            value={loadType}
            onChange={(e) => setLoadType(e.target.value as LoadType)}
          >
            {Object.entries(m.loadTypes).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <p className="t-label mb-1.5 mt-3">{m.customIncrement}</p>
        <Stepper
          id="custom-inc"
          value={inc}
          onChange={setInc}
          step={units === 'kg' ? 0.5 : 1}
          min={0.5}
          unitLabel={units}
          srLabel={m.customIncrement}
          srUnit={units === 'kg' ? 'kilograms' : 'pounds'}
        />
      </Sheet>
    </main>
  );
}

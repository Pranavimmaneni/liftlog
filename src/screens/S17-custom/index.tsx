import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { Switch } from '@/components/Switch';
import { ToggleChip } from '@/components/Chip';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { useExerciseMap } from '@/db/catalog';
import {
  defaultIncrement,
  saveCustomExercise,
  validateCustom,
  type CustomErrors,
  type CustomInput,
} from '@/db/custom';
import { useCustomMachines } from '@/db/machines';
import { addToSession, getActiveSession } from '@/db/workout';
import { useProfile } from '@/db/repo';
import { EQUIPMENT, MACHINES } from '@/engine/data';
import { fromDisplay, toDisplay } from '@/engine/units';
import { MUSCLE_GROUPS, type LoadType, type MuscleGroup, type Role } from '@/engine/types';

const LOAD_TYPES: LoadType[] = [
  'barbell',
  'dumbbell',
  'machine_stack',
  'plate_loaded',
  'cable',
  'bodyweight',
  'bodyweight_plus',
  'assisted',
  'kettlebell',
  'timed',
];

const EMPTY: CustomInput = {
  name: '',
  primary: null,
  secondary: [],
  gear: '',
  machine: false,
  loadType: null,
  role: 'isolation',
  unilateral: false,
  incrementKg: 2.5,
  notes: '',
};

/** S17 create/edit custom exercise (FR-LIB-6): inline validation; uses the muscle map, no illustration. */
export default function CustomExercise() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  // FR-LIB-8: opened from the workout's add sheet, with the search as the name.
  const from = (useLocation().state ?? {}) as { addToWorkout?: boolean; name?: string };
  const map = useExerciseMap();
  const profile = useProfile();
  const customs = useCustomMachines();
  const [v, setV] = useState<CustomInput>(() => ({ ...EMPTY, name: from.name ?? '' }));
  const [errors, setErrors] = useState<CustomErrors>({});
  const [touched, setTouched] = useState(false);
  const units = profile?.units ?? 'kg';
  const c = en.custom;

  useEffect(() => {
    if (!exerciseId || !map) return;
    const ex = map.get(exerciseId);
    if (!ex) return;
    setV({
      name: ex.name,
      primary: ex.primary[0] ?? null,
      secondary: ex.secondary,
      gear: ex.machineId ?? ex.requires[0]?.[0] ?? '',
      machine: !!ex.machineId,
      loadType: ex.loadType,
      role: ex.role,
      unilateral: ex.unilateral,
      incrementKg: ex.incrementKg,
      notes: ex.notes ?? '',
    });
  }, [exerciseId, map]);

  const set = (p: Partial<CustomInput>) => {
    const next = { ...v, ...p };
    setV(next);
    if (touched) setErrors(validateCustom(next, map ? [...map.values()] : [], exerciseId));
  };

  const save = async () => {
    setTouched(true);
    // Required fields are checked even before the catalogue chunk arrives; saving waits for it.
    const e = validateCustom(v, map ? [...map.values()] : [], exerciseId);
    setErrors(e);
    if (Object.keys(e).length || !map) return;
    const id = await saveCustomExercise(v, exerciseId);
    toast(c.saved);
    const open = from.addToWorkout ? await getActiveSession() : undefined;
    if (open) {
      await addToSession(open.id, id);
      navigate(`/workout/${id}`, { replace: true });
      return;
    }
    navigate(`/library/${id}`, { replace: true });
  };

  const gear: [string, string, boolean][] = [
    ...EQUIPMENT.map((e) => [e.id, e.name, false] as [string, string, boolean]),
    // Pull-up bar and dip station are listed as both equipment and machines; show them once.
    ...MACHINES.filter((m) => !EQUIPMENT.some((e) => e.id === m.id)).map(
      (m) => [m.id, m.name, true] as [string, string, boolean],
    ),
    ...(customs ?? []).map((m) => [m.machineId, m.custom!.name, true] as [string, string, boolean]),
  ];
  const err = (k: keyof CustomErrors) => errors[k];

  return (
    <main className="pb-[calc(24px+env(safe-area-inset-bottom))]">
      <ScreenHeader
        title={exerciseId ? c.editTitle : c.newTitle}
        backTo={exerciseId ? `/library/${exerciseId}` : from.addToWorkout ? '/workout' : '/library'}
      />
      <form
        className="flex flex-col gap-4 px-5 pt-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {/* Errors sit outside the <label> so they don't become part of the field's name. */}
        <div>
          <label className="block">
            <span className="t-label">{c.name}</span>
            <input
              className="ll-input mt-1.5"
              value={v.name}
              aria-invalid={!!err('name')}
              aria-describedby={err('name') ? 'name-err' : undefined}
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          {err('name') && (
            <span id="name-err" role="alert" className="mt-1 block text-[14px] text-accent">
              {err('name') === 'taken' ? c.nameTaken : c.nameRequired}
            </span>
          )}
        </div>

        <fieldset>
          <legend className="t-label">{c.primary}</legend>
          <div
            className="mt-1.5 flex flex-wrap gap-2"
            aria-describedby={err('primary') ? 'primary-err' : undefined}
          >
            {MUSCLE_GROUPS.map((m) => (
              <ToggleChip key={m} on={v.primary === m} onClick={() => set({ primary: m as MuscleGroup })}>
                {en.muscles[m]}
              </ToggleChip>
            ))}
          </div>
          {err('primary') && (
            <span id="primary-err" role="alert" className="mt-1 block text-[14px] text-accent">
              {c.primaryRequired}
            </span>
          )}
        </fieldset>

        <fieldset>
          <legend className="t-label">{c.secondary}</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {MUSCLE_GROUPS.filter((m) => m !== v.primary).map((m) => (
              <ToggleChip
                key={m}
                on={v.secondary.includes(m)}
                onClick={() =>
                  set({
                    secondary: v.secondary.includes(m)
                      ? v.secondary.filter((x) => x !== m)
                      : [...v.secondary, m],
                  })
                }
              >
                {en.muscles[m]}
              </ToggleChip>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="t-label">{c.equipment}</span>
          <select
            className="ll-input mt-1.5"
            value={v.gear}
            onChange={(e) => {
              const g = gear.find(([id]) => id === e.target.value);
              set({ gear: e.target.value, machine: !!g?.[2] });
            }}
          >
            <option value="">{c.none}</option>
            {gear.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <label className="block">
            <span className="t-label">{c.loadType}</span>
            <select
              className="ll-input mt-1.5"
              value={v.loadType ?? ''}
              aria-invalid={!!err('loadType')}
              aria-describedby={err('loadType') ? 'load-err' : undefined}
              onChange={(e) => {
                const lt = (e.target.value || null) as LoadType | null;
                set({ loadType: lt, incrementKg: lt ? defaultIncrement(lt) : v.incrementKg });
              }}
            >
              <option value="">–</option>
              {LOAD_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {c.loadTypes[lt]}
                </option>
              ))}
            </select>
          </label>
          {err('loadType') && (
            <span id="load-err" role="alert" className="mt-1 block text-[14px] text-accent">
              {c.loadTypeRequired}
            </span>
          )}
        </div>

        <div>
          <span className="t-label">{c.role}</span>
          <SegmentedControl<Role>
            className="mt-1.5"
            label={c.role}
            value={v.role}
            onChange={(role) => set({ role })}
            options={[
              { value: 'compound', label: c.compound },
              { value: 'isolation', label: c.isolation },
            ]}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">{c.unilateral}</span>
          <Switch
            checked={v.unilateral}
            onChange={(unilateral) => set({ unilateral })}
            label={c.unilateral}
          />
        </div>

        {v.loadType && v.loadType !== 'bodyweight' && v.loadType !== 'timed' && (
          <div>
            <span className="t-label">{c.increment}</span>
            <Stepper
              id="increment"
              value={Math.round(toDisplay(v.incrementKg, units) * 10) / 10}
              onChange={(n) => set({ incrementKg: fromDisplay(n, units) })}
              step={units === 'kg' ? 0.5 : 1}
              min={0.5}
              unitLabel={units}
              srLabel={c.increment}
              srUnit={units === 'kg' ? 'kilograms' : 'pounds'}
            />
          </div>
        )}

        <label className="block">
          <span className="t-label">{c.notes}</span>
          <textarea
            className="ll-input mt-1.5 min-h-24"
            value={v.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>
        <p className="text-[13px] text-ink2">{c.illustrationNote}</p>
        <Button type="submit">{c.save}</Button>
      </form>
    </main>
  );
}

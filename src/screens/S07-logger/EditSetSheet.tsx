import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Button } from '@/components/Button';
import { Switch } from '@/components/Switch';
import { en } from '@/copy/en';
import type { SetRow } from '@/db/types';
import { deleteSet, updateSet } from '@/db/workout';
import { bonusReps, isGoalSet } from '@/engine/goalset';
import { fromDisplay, hasLoad, incrementIn, loadUnitLabel, toDisplay } from '@/engine/units';
import type { Effort, Exercise, Target, Units } from '@/engine/types';

const EFFORTS: Effort[] = ['easy', 'solid', 'hard'];

/** FR-WRK-11: edit or delete a past set (during and after a session). */
export function EditSetSheet({
  set,
  exercise,
  target,
  units,
  bodyweightKg,
  onClose,
}: {
  set: SetRow | null;
  exercise: Exercise;
  target: Target;
  units: Units;
  bodyweightKg: number | null;
  onClose: () => void;
}) {
  const [load, setLoad] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [effort, setEffortState] = useState<Effort | undefined>();
  const [hurts, setHurtsState] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!set) return;
    setLoad(Math.round(toDisplay(set.loadKg, units) * 10) / 10);
    setReps(set.reps);
    setEffortState(set.effort);
    setHurtsState(set.hurts);
    setConfirm(false);
  }, [set, units]);
  if (!set) return null;
  const lt = exercise.loadType;
  const title = set.kind === 'warmup' ? en.logger.warm : en.logger.set(set.idx);
  const save = async () => {
    const loadKg = hasLoad(lt) ? fromDisplay(load ?? 0, units) : 0;
    const row = { kind: set.kind, loadKg, reps: reps ?? 0 };
    await updateSet(set.id, {
      loadKg,
      reps: reps ?? 0,
      effort,
      hurts,
      goalMet: set.kind !== 'warmup' && isGoalSet(row, target, lt),
      bonusReps: set.kind !== 'warmup' ? bonusReps(row, target, lt, bodyweightKg) : 0,
    });
    onClose();
  };
  return (
    <Sheet
      open={!!set}
      onClose={onClose}
      title={`${en.logger.editSet} · ${title}`}
      footer={
        confirm ? (
          <>
            <p className="text-[15px]">{en.logger.deleteSetConfirm(title)}</p>
            <Button
              variant="destructive"
              onClick={async () => {
                await deleteSet(set.id);
                onClose();
              }}
            >
              {en.logger.deleteSet}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {en.common.cancel}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={save}>{en.common.save}</Button>
            <Button variant="destructive" onClick={() => setConfirm(true)}>
              {en.logger.deleteSet}
            </Button>
          </>
        )
      }
    >
      <div className={`grid gap-1.5 ${hasLoad(lt) ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {hasLoad(lt) && (
          <Stepper
            id="edit-load"
            value={load}
            onChange={setLoad}
            step={incrementIn(units, exercise.incrementKg, lt) || 1}
            unitLabel={loadUnitLabel(lt, units)}
            srLabel={en.logger.loadLabel}
            srUnit={units === 'kg' ? 'kilograms' : 'pounds'}
          />
        )}
        <Stepper
          id="edit-reps"
          value={reps}
          onChange={setReps}
          step={1}
          decimals={0}
          unitLabel={lt === 'timed' ? en.logger.seconds : en.logger.reps}
          srLabel={lt === 'timed' ? en.logger.secondsLabel : en.logger.repsLabel}
          srUnit={lt === 'timed' ? 'seconds' : 'reps'}
        />
      </div>
      {set.kind !== 'warmup' && (
        <>
          <div className="mt-4 flex gap-2" role="group" aria-label={en.logger.effortPrompt}>
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={effort === e}
                className="ll-chip min-h-11 grow justify-center"
                data-variant={effort === e ? 'on' : 'soft'}
                onClick={() => setEffortState(effort === e ? undefined : e)}
              >
                {en.logger.effort[e]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[15px] font-semibold">{en.logger.hurts}</span>
            <Switch checked={hurts} onChange={setHurtsState} label={en.logger.hurts} />
          </div>
        </>
      )}
    </Sheet>
  );
}

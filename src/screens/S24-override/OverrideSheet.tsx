import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { formatReason } from '@/copy/format';
import { setOverride } from '@/db/workout';
import type { Goal } from '@/engine/goal';
import { fromDisplay, hasLoad, incrementIn, loadUnitLabel, toDisplay } from '@/engine/units';
import type { Exercise, Units } from '@/engine/types';

/**
 * S24 override sheet (FR-PRG-8): edit the weight / reps / sets target for the next exposure, with the
 * coach's reason shown. "Reset to coach's pick" restores the engine's target.
 */
export function OverrideSheet({
  open,
  onClose,
  exercise,
  goal,
  coachGoal,
  overridden,
  units,
}: {
  open: boolean;
  onClose: () => void;
  exercise: Exercise;
  goal: Goal;
  coachGoal: Goal;
  overridden: boolean;
  units: Units;
}) {
  const lt = exercise.loadType;
  const toD = (kg: number | null) => (kg === null ? null : Math.round(toDisplay(kg, units) * 10) / 10);
  const [sets, setSets] = useState<number | null>(goal.sets);
  const [repMin, setRepMin] = useState<number | null>(goal.repMin);
  const [repMax, setRepMax] = useState<number | null>(goal.repMax);
  const [load, setLoad] = useState<number | null>(toD(goal.loadKg));
  useEffect(() => {
    if (!open) return;
    setSets(goal.sets);
    setRepMin(goal.repMin);
    setRepMax(goal.repMax);
    setLoad(toD(goal.loadKg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const o = en.override;
  const valid = !!sets && !!repMin && !!repMax && repMin <= repMax;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={o.title}
      footer={
        <>
          <Button
            disabled={!valid}
            onClick={async () => {
              await setOverride(exercise.id, {
                sets: sets!,
                repMin: repMin!,
                repMax: repMax!,
                loadKg: hasLoad(lt) ? (load === null ? null : fromDisplay(load, units)) : 0,
              });
              toast(o.saved);
              onClose();
            }}
          >
            {o.save}
          </Button>
          <Button
            variant="secondary"
            disabled={!overridden}
            onClick={async () => {
              await setOverride(exercise.id, null);
              toast(o.resetDone);
              onClose();
            }}
          >
            {o.reset}
          </Button>
        </>
      }
    >
      <p className="rounded-md bg-panel px-3 py-2 text-[14px]" data-testid="override-reason">
        <b>{o.coach}</b> {formatReason(coachGoal.reason, units, lt)}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="col-span-2">
          <span className="t-label">{o.sets}</span>
          <Stepper
            id="ov-sets"
            value={sets}
            onChange={setSets}
            step={1}
            min={1}
            max={10}
            decimals={0}
            unitLabel={o.setsUnit}
            srLabel={o.sets}
            srUnit="sets"
          />
        </label>
        <label>
          <span className="t-label">{o.repMin}</span>
          <Stepper
            id="ov-min"
            value={repMin}
            onChange={setRepMin}
            step={1}
            min={1}
            max={50}
            decimals={0}
            unitLabel={en.logger.reps}
            srLabel={o.repMin}
            srUnit="reps"
          />
        </label>
        <label>
          <span className="t-label">{o.repMax}</span>
          <Stepper
            id="ov-max"
            value={repMax}
            onChange={setRepMax}
            step={1}
            min={1}
            max={60}
            decimals={0}
            unitLabel={en.logger.reps}
            srLabel={o.repMax}
            srUnit="reps"
          />
        </label>
        {hasLoad(lt) && (
          <label className="col-span-2">
            <span className="t-label">{o.load}</span>
            <Stepper
              id="ov-load"
              value={load}
              onChange={setLoad}
              step={incrementIn(units, exercise.incrementKg, lt) || 1}
              unitLabel={loadUnitLabel(lt, units)}
              srLabel={o.load}
              srUnit={units === 'kg' ? 'kilograms' : 'pounds'}
              emptyStart={20}
            />
          </label>
        )}
      </div>
      {repMin && repMax && repMin > repMax && (
        <p role="alert" className="mt-2 text-[14px] text-accent">
          {o.rangeError}
        </p>
      )}
    </Sheet>
  );
}

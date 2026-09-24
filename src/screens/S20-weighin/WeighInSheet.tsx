import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { saveWeighIn } from '@/db/repo';
import { dateKey } from '@/engine/week';
import { fromDisplay, toDisplay } from '@/engine/units';
import type { Units } from '@/engine/types';

/** S20 weigh-in sheet: stepper in 0.1 kg / 0.2 lb steps, pre-filled with the last value; date defaults to today. */
export function WeighInSheet({
  open,
  onClose,
  lastKg,
  units,
}: {
  open: boolean;
  onClose: () => void;
  lastKg: number | null;
  units: Units;
}) {
  const step = units === 'kg' ? 0.1 : 0.2;
  const start =
    lastKg === null ? (units === 'kg' ? 75 : 165) : Math.round(toDisplay(lastKg, units) * 10) / 10;
  const [value, setValue] = useState<number | null>(start);
  const [date, setDate] = useState(dateKey(Date.now()));
  useEffect(() => {
    if (open) {
      setValue(start);
      setDate(dateKey(Date.now()));
    }
  }, [open, start]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={en.weighIn.title}
      footer={
        <Button
          disabled={value === null || value <= 0}
          onClick={async () => {
            await saveWeighIn(date, fromDisplay(value!, units));
            toast(en.weighIn.saved);
            onClose();
          }}
        >
          {en.weighIn.save}
        </Button>
      }
    >
      <Stepper
        id="bodyweight"
        value={value}
        onChange={setValue}
        step={step}
        min={20}
        max={units === 'kg' ? 400 : 880}
        unitLabel={units}
        srLabel={en.weighIn.label}
        srUnit={units === 'kg' ? 'kilograms' : 'pounds'}
      />
      <label className="mt-4 block">
        <span className="t-label">{en.weighIn.date}</span>
        <input
          type="date"
          className="ll-input mt-1.5"
          value={date}
          max={dateKey(Date.now())}
          onChange={(e) => setDate(e.target.value || dateKey(Date.now()))}
        />
      </label>
    </Sheet>
  );
}

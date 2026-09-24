import { en } from '@/copy/en';
import type { Meter } from '@/engine/goalset';

/**
 * FR-WRK-3: segmented goal meter, one segment per goal set, plus a separate gold bonus indicator.
 * NFR-A11Y-2: exposed as a meter with a text value.
 */
export function GoalMeter({ meter }: { meter: Meter }) {
  return (
    <div className="ll-card px-3.5 pb-3 pt-2.5">
      <div className="flex items-end justify-between gap-2">
        <p className="flex items-baseline gap-1.5" aria-hidden="true">
          <span className="t-display text-[64px] leading-[0.85]">{meter.done}</span>
          <span className="t-display text-[40px] leading-none text-ink2">/{meter.total}</span>
          <span className="ml-1 text-[15px] text-ink2">{en.workout.goalSets}</span>
        </p>
        {meter.bonus && (
          <span className="ll-chip mb-2 !px-4 !py-2" data-variant="brass">
            + {en.workout.bonusReps}
          </span>
        )}
      </div>
      <div
        role="meter"
        aria-label={en.workout.goalSets}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, meter.total)}
        aria-valuenow={meter.done}
        aria-valuetext={en.workout.meterLabel(meter.done, meter.total)}
        className="mt-3 flex gap-[3px]"
      >
        {meter.segments.map((on, i) => (
          <span key={i} className={`h-[17px] min-w-0 grow rounded-[2px] ${on ? 'bg-ink' : 'bg-panel'}`} />
        ))}
        <span
          className={`ml-2 h-[17px] w-4 shrink-0 rounded-[2px] ${meter.bonus ? 'bg-brass' : 'bg-panel'}`}
        />
      </div>
      <p className="mt-3 text-[13px] leading-snug text-ink2">{en.workout.meterNote}</p>
    </div>
  );
}

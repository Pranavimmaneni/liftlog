import type { ReactNode } from 'react';

export interface Segment<T extends string> {
  value: T;
  label: ReactNode;
}

/** S10/S12/S14 segmented control: a row of aria-pressed buttons inside one bordered group. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
  height = 40,
}: {
  value: T;
  options: Segment<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  height?: number;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex overflow-hidden rounded-lg border-[1.5px] border-line bg-card ${className}`}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            style={{ minHeight: Math.max(44, height) }}
            className={`grow px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] ${
              i > 0 ? 'border-l-[1.5px] border-line' : ''
            } ${on ? 'bg-ink text-card' : 'bg-card text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

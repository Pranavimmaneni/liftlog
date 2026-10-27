import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Icon } from './Icon';
import { en } from '@/copy/en';

export interface StepperProps {
  /** Current value in display units; null shows an empty value (calibration). */
  value: number | null;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  /** Small caption under the number, e.g. "kg/hand" or "reps". */
  unitLabel: string;
  /** Screen-reader name, e.g. "Load". */
  srLabel: string;
  /** Spoken unit, e.g. "kilograms per hand". */
  srUnit: string;
  decimals?: number;
  placeholder?: string;
  id?: string;
  /** Value used when the first + / − is pressed while empty. */
  emptyStart?: number;
}

function roundTo(v: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** Next value on the step grid; off-grid values (e.g. converted units) snap to the nearest step first. */
export function nextStep(value: number, step: number, dir: 1 | -1): number {
  if (step <= 0) return value;
  const q = value / step;
  const onGrid = Math.abs(q - Math.round(q)) < 1e-6;
  if (onGrid) return (Math.round(q) + dir) * step;
  return (dir > 0 ? Math.ceil(q) : Math.floor(q)) * step;
}

/**
 * FR-WRK-5a: the number shrinks as it gets longer, so "122.5" fits between − and + at 360 px.
 * Big Shoulders Display is about 0.42 em per character.
 */
export function stepFontSize(text: string): number {
  const n = text.length;
  return n <= 3 ? 32 : n === 4 ? 28 : n === 5 ? 24 : 20;
}

export function formatStepValue(v: number | null, decimals = 1): string {
  if (v === null || Number.isNaN(v)) return '–';
  const r = roundTo(v, decimals);
  return Number.isInteger(r) ? String(r) : r.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * FR-WRK-5 stepper: − / + in exercise increments; tap or long-press the number for a numeric keypad.
 * NFR-A11Y-2: spinbutton semantics and labels like "Load, 26 kilograms per hand, increase".
 */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = 9999,
  unitLabel,
  srLabel,
  srUnit,
  decimals = 1,
  placeholder = '–',
  id,
  emptyStart,
}: StepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const clamp = (v: number) => Math.min(max, Math.max(min, roundTo(v, decimals)));
  const text = value === null ? placeholder : formatStepValue(value, decimals);
  const spoken = value === null ? 'empty' : `${formatStepValue(value, decimals)} ${srUnit}`;

  const bump = (dir: 1 | -1) => {
    if (value === null) {
      onChange(clamp(emptyStart ?? min));
      return;
    }
    onChange(clamp(nextStep(value, step, dir)));
  };

  const openKeypad = () => {
    setDraft(value === null ? '' : formatStepValue(value, decimals));
    setEditing(true);
  };

  const commit = () => {
    const n = Number.parseFloat(draft.replace(',', '.'));
    if (!Number.isNaN(n)) onChange(clamp(n));
    setEditing(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      bump(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      bump(-1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openKeypad();
    }
  };

  const startPress = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressTimer.current = window.setTimeout(openKeypad, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div
      role="group"
      aria-label={srLabel}
      className="flex h-14 min-w-0 items-center rounded-lg border-2 border-ink bg-card"
      data-testid={id ? `stepper-${id}` : undefined}
    >
      {/* While typing, the field takes the whole stepper so every digit stays visible (FR-WRK-5a). */}
      {!editing && (
        <button
          type="button"
          className="flex h-12 w-11 shrink-0 items-center justify-center rounded-md text-ink"
          aria-label={`${srLabel}, ${spoken}, ${en.common.decrease}`}
          onClick={() => bump(-1)}
          disabled={value !== null && value <= min}
        >
          <Icon name="minus" size={22} strokeWidth={2.6} />
        </button>
      )}
      {editing ? (
        <input
          ref={inputRef}
          id={id}
          className="t-display h-12 w-full min-w-0 bg-transparent px-2 text-center outline-none"
          style={{ fontSize: Math.min(30, stepFontSize(draft) + 2) }}
          inputMode="decimal"
          enterKeyHint="done"
          aria-label={`${srLabel} (${srUnit})`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <div
          id={id}
          role="spinbutton"
          tabIndex={0}
          aria-label={srLabel}
          aria-valuenow={value ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={spoken}
          className="flex min-w-0 grow cursor-text select-none flex-col items-center justify-center leading-none"
          onClick={openKeypad}
          onKeyDown={onKey}
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
        >
          <span
            className="t-display whitespace-nowrap leading-none"
            style={{ fontSize: stepFontSize(text) }}
            aria-hidden="true"
          >
            {text}
          </span>
          <span
            className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-ink2"
            aria-hidden="true"
          >
            {unitLabel}
          </span>
        </div>
      )}
      {!editing && (
        <button
          type="button"
          className="flex h-12 w-11 shrink-0 items-center justify-center rounded-md text-ink"
          aria-label={`${srLabel}, ${spoken}, ${en.common.increase}`}
          onClick={() => bump(1)}
          disabled={value !== null && value >= max}
        >
          <Icon name="plus" size={22} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

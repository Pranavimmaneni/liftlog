import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';

/**
 * The Food section's minimal kit (mockups F01–F07, design/screens-v2/food/food.css): one big number
 * per screen, hairline rules instead of boxes, thin segmented bars, one primary button.
 * Colours are Paper & Iron tokens only (FR-THM-1).
 */

/** Thin segmented bar (the quiet game motif). `tone` colours the filled segments. */
export function SegBar({
  value,
  max,
  segments = 10,
  tone = 'ink',
  extra = 0,
  thick = false,
  label,
}: {
  value: number;
  max: number;
  segments?: number;
  tone?: 'ink' | 'accent';
  /** Segments added on top in brass (a preview of "after this"). */
  extra?: number;
  thick?: boolean;
  label?: string;
}) {
  const filled = max > 0 ? Math.min(segments, Math.round((value / max) * segments)) : 0;
  const plus = max > 0 ? Math.min(segments - filled, Math.round((extra / max) * segments)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      className={`flex ${thick ? 'h-2.5 gap-[3px]' : 'h-1.5 gap-0.5'}`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <i
          key={i}
          aria-hidden="true"
          className={`flex-1 rounded-[1px] ${
            i < filled
              ? tone === 'accent'
                ? 'bg-accent'
                : 'bg-ink'
              : i < filled + plus
                ? 'bg-brass'
                : 'bg-rule'
          }`}
        />
      ))}
    </div>
  );
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink2 ${className}`}>
      {children}
    </p>
  );
}

export function BigNumber({ value, unit, size = 84 }: { value: string; unit?: string; size?: number }) {
  return (
    <p className="leading-[0.9]">
      <span className="t-display font-extrabold" style={{ fontSize: size }}>
        {value}
      </span>
      {unit && <span className="font-mono text-[15px] text-ink2"> {unit}</span>}
    </p>
  );
}

/** Header for Food's sub-screens: back + display title (F02–F05). */
export function FoodHeader({ title, sub, backTo }: { title: ReactNode; sub?: ReactNode; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center gap-1 px-6 pt-5">
      <button
        type="button"
        aria-label={en.common.back}
        className="-ml-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink"
        onClick={() => {
          const idx = (window.history.state as { idx?: number } | null)?.idx;
          if (idx) navigate(-1);
          else navigate(backTo ?? '/food');
        }}
      >
        <Icon name="back" />
      </button>
      <div className="min-w-0 grow">
        <h1 className="t-display text-[34px] leading-none">{title}</h1>
        {sub && <p className="mt-2 text-[13px] text-ink2">{sub}</p>}
      </div>
    </header>
  );
}

/** Text tabs (F02, F04): underline on the active one. */
export function TextTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: [T, string][];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-5 overflow-x-auto">
      {tabs.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={v === value}
          onClick={() => onChange(v)}
          className={`min-h-11 shrink-0 border-b-2 text-[14px] ${
            v === value ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink2'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Pill choices (F03 units, F05 options). */
export function Choices<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={`min-h-11 rounded-full border px-4 text-[14px] ${
            v === value ? 'border-ink bg-ink text-card' : 'border-rule text-ink2'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** F03: round − / + with a big value between. */
export function RoundStepper({
  value,
  unit,
  onLess,
  onMore,
  canLess = true,
}: {
  value: string;
  unit: string;
  onLess: () => void;
  onMore: () => void;
  canLess?: boolean;
}) {
  const btn = 'flex h-[52px] w-[52px] items-center justify-center rounded-full border border-rule text-ink';
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        className={btn}
        aria-label={`${en.food.portion.less}, ${value} ${unit}`}
        onClick={onLess}
        disabled={!canLess}
      >
        <Icon name="minus" />
      </button>
      <div className="text-center" aria-live="polite">
        <p className="t-display text-[56px] font-extrabold leading-none">{value}</p>
        <Label className="mt-2">{unit}</Label>
      </div>
      <button
        type="button"
        className={btn}
        aria-label={`${en.food.portion.more}, ${value} ${unit}`}
        onClick={onMore}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

/** The one primary button per screen. */
export function Cta({
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={`ll-btn w-full ${className}`} data-variant="primary" {...rest}>
      {children}
    </button>
  );
}

/** Logbook line: label left, value right, hairline under (F04, F05). */
export function FieldRow({
  label,
  value,
  onClick,
  muted = false,
}: {
  label: ReactNode;
  value: ReactNode;
  onClick?: () => void;
  muted?: boolean;
}) {
  const inner = (
    <>
      <span className="text-[15px]">{label}</span>
      <span className={`font-mono text-[15px] ${muted ? 'text-ink2' : ''}`}>{value}</span>
    </>
  );
  const cls = 'flex min-h-14 w-full items-center justify-between gap-3 border-b border-rule py-2 text-left';
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function TextLink({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className="min-h-11 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-accent"
      {...rest}
    >
      {children}
    </button>
  );
}

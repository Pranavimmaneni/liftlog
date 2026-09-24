import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

export type ChipVariant = 'plain' | 'on' | 'brass' | 'red' | 'soft' | 'outline-red' | 'dashed';

export function Chip({
  variant = 'plain',
  className = '',
  children,
  title,
}: {
  variant?: ChipVariant;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`ll-chip ${className}`} data-variant={variant} title={title}>
      {children}
    </span>
  );
}

/** A pressable chip (goal picker, filters). Uses aria-pressed. */
export function ToggleChip({
  on,
  children,
  className = '',
  check = false,
  large = false,
  ...rest
}: {
  on: boolean;
  children: ReactNode;
  className?: string;
  /** Show a leading check when on (S02 equipment chips). */
  check?: boolean;
  /** Body-font chip used on S02 (15px sans, 48px tall). */
  large?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  if (large) {
    return (
      <button
        type="button"
        aria-pressed={on}
        className={`inline-flex min-h-11 items-center gap-2 rounded-md border-[1.5px] px-3 text-[15px] font-medium ${
          on ? 'border-ink bg-ink text-card' : 'border-line bg-card text-ink'
        } ${className}`}
        {...rest}
      >
        {check && on && <Icon name="check" size={16} strokeWidth={2.6} />}
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`ll-chip min-h-11 !px-[11px] !text-[12px] ${className}`}
      data-variant={on ? 'on' : 'plain'}
      {...rest}
    >
      {check && on && <Icon name="check" size={14} strokeWidth={2.6} />}
      {children}
    </button>
  );
}

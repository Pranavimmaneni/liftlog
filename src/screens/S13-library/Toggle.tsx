import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ToggleChip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { useDesign } from '@/app/design';

/**
 * A pressable filter or choice (S13 "In my gym", S17 muscles). Classic: the mono <ToggleChip>.
 * Rising Sun: a 44 px pill, ink fill when on (handoff §4, FR-DSN-10).
 */
export function Toggle({
  on,
  check = false,
  soft = false,
  className = '',
  children,
  ...rest
}: {
  on: boolean;
  check?: boolean;
  /** Rising Sun: the pill sits on a card or sheet, so it takes the soft fill instead of glass. */
  soft?: boolean;
  /** Classic only. */
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const sun = useDesign() === 'sun';
  if (!sun)
    return (
      <ToggleChip on={on} check={check} className={className} {...rest}>
        {children}
      </ToggleChip>
    );
  return (
    <button type="button" aria-pressed={on} className="sun-pill sun-plan-pill" data-soft={soft} {...rest}>
      {check && on && <Icon name="check" size={16} strokeWidth={2.6} />}
      {children}
    </button>
  );
}

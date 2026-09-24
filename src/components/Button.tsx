import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Common = { variant?: ButtonVariant; size?: 'md' | 'sm'; children: ReactNode; className?: string };

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`ll-btn ${className}`} data-variant={variant} data-size={size} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  to,
  ...rest
}: Common & { to: string; onClick?: () => void; 'aria-label'?: string }) {
  return (
    <Link to={to} className={`ll-btn ${className}`} data-variant={variant} data-size={size} {...rest}>
      {children}
    </Link>
  );
}

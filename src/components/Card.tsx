import type { HTMLAttributes, ReactNode } from 'react';

/** Card. `hard` adds the offset shadow: use it on the single most important element per screen (PRD §9). */
export function Card({
  hard = false,
  className = '',
  children,
  as: Tag = 'div',
  ...rest
}: {
  hard?: boolean;
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`ll-card ${hard ? 'll-card-hard' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

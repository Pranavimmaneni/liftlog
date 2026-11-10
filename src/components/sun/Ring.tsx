import type { ReactNode } from 'react';

/**
 * A progress ring (Today's macro rings, the rest countdown). Decorative by default: the caller
 * supplies the text alternative. `value` is clamped to 0…1.
 */
export function Ring({
  value,
  size,
  stroke,
  color,
  children,
  className = '',
}: {
  value: number;
  size: number;
  stroke: number;
  /** A token colour, e.g. 'var(--ll-accent)'. */
  color: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ll-soft)" strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${v * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      )}
    </div>
  );
}

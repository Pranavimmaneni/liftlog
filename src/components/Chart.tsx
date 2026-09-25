import { useId, useState } from 'react';
import { en } from '@/copy/en';

export interface Point {
  label: string;
  value: number;
}

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round((min + step * i) * 10) / 10);
}

/**
 * Single-series line chart (PRD §9, FR-PRO-1). Hand-rolled SVG, token colours, and a table view
 * (CLAUDE.md "Charts get a table view", NFR-A11Y-2).
 */
export function LineChart({
  points,
  unit,
  title,
  height = 180,
  maxLabels = 8,
}: {
  points: Point[];
  unit: string;
  title: string;
  height?: number;
  /** Most x-axis labels to draw (dates need fewer than "W1…W8"). */
  maxLabels?: number;
}) {
  const [table, setTable] = useState(false);
  const id = useId();
  if (!points.length) return <p className="text-[14px] text-ink2">{en.chart.empty}</p>;
  const W = 300;
  const H = height;
  const pad = { l: 30, r: 16, t: 22, b: 26 };
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const x = (i: number) =>
    pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  const last = points[points.length - 1]!;
  const ticks = niceTicks(min, max);
  const every = Math.max(1, Math.ceil(points.length / maxLabels));
  return (
    <figure className="m-0">
      {table ? (
        <table className="w-full text-left text-[14px]" aria-labelledby={`${id}-cap`}>
          <caption id={`${id}-cap`} className="sr-only">
            {title}
          </caption>
          <thead>
            <tr>
              <th className="t-label py-1.5">{en.chart.when}</th>
              <th className="t-label py-1.5 text-right">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-t border-rule">
                <td className="py-1.5">{p.label}</td>
                <td className="t-num py-1.5 text-right">{Math.round(p.value * 10) / 10}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={en.chart.summary(title, points[0]!.value, last.value, unit)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--ll-rule)" strokeWidth="1.2" />
              <text x={4} y={y(t) + 4} fontSize="10" fontFamily="var(--font-mono)" fill="var(--ll-ink2)">
                {t}
              </text>
            </g>
          ))}
          <path
            d={d}
            fill="none"
            stroke="var(--ll-ink)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={x(points.length - 1)} cy={y(last.value)} r="4.5" fill="var(--ll-accent)" />
          <text
            x={x(points.length - 1) - 8}
            y={y(last.value) - 10}
            fontSize="11"
            textAnchor="end"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            fill="var(--ll-ink)"
          >
            {Math.round(last.value * 10) / 10}
          </text>
          {points.map((p, i) =>
            i % every === 0 || i === points.length - 1 ? (
              <text
                key={i}
                x={x(i)}
                y={H - 6}
                fontSize="10"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fill="var(--ll-ink2)"
              >
                {p.label}
              </text>
            ) : null,
          )}
        </svg>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          className="ll-link min-h-11"
          aria-pressed={table}
          onClick={() => setTable(!table)}
        >
          {table ? en.chart.showChart : en.chart.showTable}
        </button>
      </div>
    </figure>
  );
}

/** Single-series sparkline (FR-REV-3: never a dual axis). */
export function Sparkline({
  values,
  label,
  strong = false,
}: {
  values: number[];
  label: string;
  strong?: boolean;
}) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => 2 + (i / (values.length - 1)) * (W - 8);
  const y = (v: number) => 4 + (1 - (v - min) / span) * (H - 10);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-full" role="img" aria-label={label}>
      <line x1="2" x2={W - 2} y1={H - 2} y2={H - 2} stroke="var(--ll-rule)" strokeWidth="1" />
      <path
        d={d}
        fill="none"
        stroke={strong ? 'var(--ll-ink)' : 'var(--ll-ink2)'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(values[values.length - 1]!)}
        r="3"
        fill={strong ? 'var(--ll-ink)' : 'var(--ll-ink2)'}
      />
    </svg>
  );
}

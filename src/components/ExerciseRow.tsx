import type { ReactNode } from 'react';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { en } from '@/copy/en';
import type { Exercise } from '@/engine/types';

export function muscleName(m: string | undefined): string {
  return m ? (en.muscles[m] ?? m) : '';
}

/** "Upper back · Cable" line under an exercise name (S13). */
export function exerciseMeta(e: Exercise): string {
  const parts = [muscleName(e.primary[0]), e.equipment];
  if (e.unilateral) parts.push(en.library.perSide);
  return parts.join(' · ');
}

/**
 * S13 / picker row: thumbnail, name, mono meta line, optional alias line and a right slot.
 * Dimmed with a "Not in gym" tag when unavailable (FR-LIB-5).
 */
export function ExerciseRow({
  exercise,
  meta,
  alias,
  dimmed = false,
  right,
  onClick,
  thumbClass = 'h-[42px] w-[58px]',
}: {
  exercise: Exercise;
  meta?: string;
  alias?: string;
  dimmed?: boolean;
  right?: ReactNode;
  onClick?: () => void;
  thumbClass?: string;
}) {
  const body = (
    <>
      <ExerciseThumb exercise={exercise} className={`${thumbClass} ${dimmed ? 'opacity-45' : ''}`} />
      {/* Dimmed rows keep text at full contrast (NFR-A11Y-1); only the picture fades. */}
      <span className="min-w-0 grow">
        <span
          className={`block text-[15px] font-bold leading-tight tracking-[-0.01em] ${dimmed ? 'text-ink2' : ''}`}
        >
          {exercise.name}
        </span>
        <span className="t-mono mt-0.5 block text-[11px] text-ink2">{meta ?? exerciseMeta(exercise)}</span>
        {alias && <span className="mt-0.5 block text-[13px] italic text-ink2">{en.library.also(alias)}</span>}
      </span>
      {dimmed && (
        <span className="ll-chip shrink-0" data-variant="soft">
          {en.library.notInGym}
        </span>
      )}
      {right}
    </>
  );
  const cls = 'flex w-full items-center gap-3 border-b border-rule px-3 py-2 text-left last:border-b-0';
  return onClick ? (
    <button type="button" className={`${cls} min-h-[72px]`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

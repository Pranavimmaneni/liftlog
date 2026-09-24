import { useState } from 'react';
import { MuscleMap, Pictogram } from '@/illustration/Pictogram';
import { poseDef } from '@/illustration/svg';
import { Sheet } from '@/components/Sheet';
import { en } from '@/copy/en';
import type { Exercise } from '@/engine/types';

function firstSentence(s: string | undefined): string {
  if (!s) return '';
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

/** S07/S08 illustration: pictogram (animated, FR-ILL-4) + muscle map with Main/Helps legend; muscle-map fallback (FR-ILL-3). */
export function IllustrationPanel({ exercise }: { exercise: Exercise }) {
  const [tips, setTips] = useState(false);
  const hasPose = !!poseDef(exercise.poseId);
  return (
    <>
      <div className="mx-5 mt-3 flex items-stretch overflow-hidden rounded-lg border-[1.5px] border-line bg-panel">
        {hasPose ? (
          <div className="min-w-0 basis-[62%] pl-0.5 pt-1">
            <Pictogram poseId={exercise.poseId!} animate label={exercise.name} className="h-auto w-full" />
          </div>
        ) : (
          <div className="flex min-w-0 basis-[62%] flex-col items-center justify-center gap-1 p-3">
            <MuscleMap
              primary={exercise.primary}
              secondary={exercise.secondary}
              className="h-[130px] w-full"
            />
            <span className="t-label text-center">{exercise.equipment}</span>
          </div>
        )}
        <div className="flex grow flex-col items-center justify-center gap-1.5 border-l-[1.5px] border-dashed border-rule px-1 py-1.5">
          {hasPose && (
            <MuscleMap
              primary={exercise.primary}
              secondary={exercise.secondary}
              className="h-[88px] w-full"
            />
          )}
          <div className="flex flex-col gap-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.04em]">
            <span className="flex items-center gap-[5px]">
              <span className="h-[9px] w-[9px] rounded-[2px] bg-accent" />
              {en.logger.main}
            </span>
            <span className="flex items-center gap-[5px]">
              <span className="h-[9px] w-[9px] rounded-[2px] bg-brass" />
              {en.logger.helps}
            </span>
          </div>
        </div>
      </div>
      <div className="mx-5 mt-2 flex items-center justify-between gap-2 text-[13px] text-ink2">
        <span>{firstSentence(exercise.instructions[0])}</span>
        <button type="button" className="ll-link shrink-0" onClick={() => setTips(true)}>
          {en.logger.formTips}
        </button>
      </div>
      <Sheet open={tips} onClose={() => setTips(false)} title={en.logger.formTips}>
        <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-snug">
          {exercise.instructions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Sheet>
    </>
  );
}

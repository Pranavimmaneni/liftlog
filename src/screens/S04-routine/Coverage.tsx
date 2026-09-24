import { useMemo } from 'react';
import { en } from '@/copy/en';
import { muscleName } from '@/components/ExerciseRow';
import { toast } from '@/components/Toast';
import { coverage, fixFor } from '@/engine/coverage';
import type { GymLike } from '@/engine/suggest';
import type { Exercise, ProfileLike } from '@/engine/types';

/**
 * S04 coverage check (FR-RTN-3): weekly hard sets per muscle vs the target band. Groups below the
 * band are flagged, and "+ Fix" adds the best exercise to the lightest session.
 */
export function CoverageCard({
  sessions,
  exercises,
  profile,
  gym,
  onFix,
}: {
  sessions: string[][];
  exercises: Map<string, Exercise>;
  profile: Pick<ProfileLike, 'experience' | 'goal' | 'nudge' | 'daysPerWeek' | 'limitations'>;
  gym: GymLike;
  onFix: (sessionIndex: number, exerciseId: string) => void;
}) {
  const rows = useMemo(() => coverage(sessions, exercises, profile), [sessions, exercises, profile]);
  const gaps = rows.filter((r) => r.gap).length;
  const all = useMemo(() => [...exercises.values()].filter((e) => !e.deleted), [exercises]);
  return (
    <section className="ll-card mx-5 mt-4 px-3.5 py-3" aria-labelledby="coverage-h">
      <div className="flex items-center justify-between">
        <h2 id="coverage-h" className="t-label">
          {en.routine.hardSets}
        </h2>
        {gaps > 0 && <span className="t-label !text-accent">{en.routine.gaps(gaps)}</span>}
      </div>
      <ul className="mt-2">
        {rows.map((r) => {
          const max = Math.max(r.target[1], r.sets, 1);
          return (
            <li key={r.muscle} className="flex min-h-11 items-center gap-3">
              <span className={`w-[92px] shrink-0 text-[15px] ${r.gap ? 'font-semibold text-accent' : ''}`}>
                {muscleName(r.muscle)}
              </span>
              <span className="relative h-[9px] grow rounded-[2px] bg-panel" aria-hidden="true">
                <span
                  className={`absolute inset-y-0 left-0 rounded-[2px] ${r.gap ? 'bg-accent' : 'bg-ink'}`}
                  style={{ width: `${Math.min(100, (r.sets / max) * 100)}%` }}
                />
                <span
                  className="absolute -top-[5px] h-[19px] w-[2px] bg-ink2"
                  style={{ left: `${(r.target[0] / max) * 100}%` }}
                />
              </span>
              {r.gap ? (
                <button
                  type="button"
                  className="ll-chip min-h-11 w-[82px] shrink-0 justify-center"
                  data-variant="outline-red"
                  aria-label={`${en.routine.fix} ${muscleName(r.muscle)}: ${r.sets} of ${r.target[0]} sets`}
                  onClick={() => {
                    const fix = fixFor(r.muscle, sessions, { exercises: all, gym, profile });
                    if (!fix) return toast(en.routine.noFix);
                    onFix(fix.sessionIndex, fix.exerciseId);
                  }}
                >
                  + {en.routine.fix}
                </button>
              ) : (
                <span className="t-num w-[82px] shrink-0 text-right text-[14px]">
                  {r.sets} / {r.target[0]}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[13px] text-ink2">{en.routine.tickNote}</p>
    </section>
  );
}

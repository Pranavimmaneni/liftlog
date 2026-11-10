import { useState } from 'react';
import { Link } from 'react-router';
import { Button, LinkButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { en } from '@/copy/en';
import { formatClock } from '@/engine/timer';
import { displayNumber } from '@/engine/units';
import { hasLoad } from '@/engine/units';
import type { ItemModel } from '@/app/session-model';
import type { Units } from '@/engine/types';
import { platform } from '@/platform';
import { useRemaining } from '../S25-timer/RestTimer';
import { targetLine } from './target';
import { WorkoutSheets, type WorkoutState } from './state';

/** "67.5 × 9": what the next set of an exercise is expected to be. */
function nextSetText(it: ItemModel, units: Units): string {
  const prev = it.work[it.work.length - 1];
  const reps = prev ? Math.max(prev.reps, it.goal.repMin) : it.goal.repMax;
  const lt = it.exercise.loadType;
  if (!hasLoad(lt)) return lt === 'timed' ? `${reps} s` : `${reps}`;
  const kg = prev ? prev.loadKg : it.goal.loadKg;
  return kg === null ? `${reps}` : `${displayNumber(kg, units)} × ${reps}`;
}

function Dots({ dots }: { dots: ItemModel['progress']['dots'] }) {
  return (
    <span className="flex shrink-0 gap-[5px]" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${
            d === 'bonus'
              ? 'bg-sage'
              : d === 'met'
                ? 'bg-accent'
                : d === 'missed'
                  ? 'bg-ink2'
                  : 'border-[1.5px] border-ink2'
          }`}
        />
      ))}
    </span>
  );
}

/**
 * S06 Active workout in the Rising Sun look (FR-DSN-5, handoff §7): title with an add button, one
 * line of time, sets and rest, a segmented bar of the session's sets, the lifts as one glass list
 * with their set dots, and Resume / Finish at the bottom. Same behaviour as the classic screen
 * (FR-WRK-2/3/10/11/16).
 */
export function WorkoutSun({ w }: { w: WorkoutState }) {
  const model = w.model!;
  const [menu, setMenu] = useState(false);
  const remaining = useRemaining();
  const units = model.profile.units;
  const t = en.sun.workout;
  const total = model.items.reduce((n, i) => n + i.goal.sets, 0);
  const done = model.items.reduce((n, i) => n + Math.min(i.progress.logged, i.goal.sets), 0);
  const minutes = Math.max(0, Math.floor((Date.now() - model.session.startedAt) / 60_000));
  const current = model.current;
  const started = !!current && current.sets.length > 0;

  return (
    <main className="flex grow flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <Link
            to="/"
            className="-ml-3 flex h-11 w-9 shrink-0 items-center justify-center !text-ink"
            aria-label={en.common.back}
          >
            <Icon name="back" />
          </Link>
          <h1 className="sun-title break-words">{model.session.name}</h1>
        </div>
        <button type="button" className="ll-icon-btn" aria-label={t.addLift} onClick={() => setMenu(true)}>
          <Icon name="plus" />
        </button>
      </header>
      <p className="mb-3 mt-1.5 text-[15px] text-ink2">
        {t.sub(minutes, done, total)}
        {remaining !== null && ` · ${t.rest(formatClock(remaining))}`}
      </p>

      {/* FR-WRK-3: one segment per goal set, filled when the set met its goal. */}
      <div
        role="meter"
        aria-label={en.workout.goalSets}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, model.meter.total)}
        aria-valuenow={model.meter.done}
        aria-valuetext={en.workout.meterLabel(model.meter.done, model.meter.total)}
        className="flex gap-[3px]"
      >
        {model.meter.segments.map((on, i) => (
          <span key={i} className={`h-2 min-w-0 grow rounded ${on ? 'bg-accent' : 'bg-soft'}`} />
        ))}
        <span
          className={`ml-1.5 h-2 w-3 shrink-0 rounded ${model.meter.bonus ? 'bg-sage' : 'bg-soft'}`}
          title={en.workout.bonusReps}
        />
      </div>

      {w.undoLeft > 0 && (
        <div
          role="status"
          className="sun-glass mt-3 flex items-center justify-between gap-3 rounded-[14px] py-1.5 pl-4 pr-1.5"
        >
          <span className="text-[15px] font-semibold">{en.workout.started}</span>
          <button
            type="button"
            className="sun-pill !min-h-11"
            aria-label={en.workout.undoLabel}
            onClick={() => void w.cancel()}
          >
            {en.workout.undo}
          </button>
        </div>
      )}
      {!platform.capabilities().wakeLock && platform.os === 'ios' && (
        <p className="mt-2 rounded-[14px] bg-soft px-3 py-2 text-[13px] text-ink2">
          {en.workout.keepAwakeHint}
        </p>
      )}
      {model.session.deload && (
        <p className="mt-2 rounded-[14px] bg-brass-wash px-3 py-2 text-[13px]">{en.home.deloadNow}</p>
      )}

      <ul className="sun-glass mt-3.5 overflow-hidden rounded-[14px]">
        {model.items.map((it) => {
          const isCurrent = current?.exercise.id === it.exercise.id;
          const extra = !it.planned ? `${en.workout.unplanned} · ` : '';
          const bonus =
            it.progress.bonusReps > 0
              ? ` · ${en.workout.plusReps(it.progress.bonusReps)}`
              : it.progress.bonusSet
                ? ` · ${en.workout.plusSet}`
                : '';
          return (
            <li key={it.exercise.id} className="border-t border-rule first:border-t-0">
              <Link
                to={`/workout/${it.exercise.id}`}
                aria-current={isCurrent ? 'step' : undefined}
                className="flex min-h-[52px] items-center gap-2 py-1.5 pl-2 pr-4 !text-ink no-underline"
              >
                <ExerciseThumb exercise={it.exercise} className="h-[35px] w-[50px]" />
                <span className="min-w-0 grow">
                  <span className={`block leading-tight ${isCurrent ? 'font-bold' : ''}`}>
                    {it.exercise.name}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink2">
                    {isCurrent
                      ? t.nowNext(it.nextIdx, nextSetText(it, units))
                      : `${extra}${targetLine(it, units)}${bonus}`}
                  </span>
                </span>
                <Dots dots={it.progress.dots} />
              </Link>
            </li>
          );
        })}
        {/* A quiet last row, on the card so it never sits on the sun's rings (handoff §8.7). */}
        <li className="border-t border-rule">
          <button
            type="button"
            className="min-h-11 w-full text-center text-[14px] font-semibold text-accent-text"
            onClick={() => (w.logged ? w.setConfirmCancel(true) : void w.cancel(en.workout.cancelled))}
          >
            {en.workout.cancel}
          </button>
        </li>
      </ul>

      <div className="sticky bottom-[calc(24px+env(safe-area-inset-bottom))] mt-auto flex flex-col gap-2.5 pt-6">
        {current ? (
          <>
            <LinkButton to={`/workout/${current.exercise.id}`}>
              {started ? t.resume(current.exercise.name) : t.start(current.exercise.name)}
            </LinkButton>
            <Button variant="secondary" onClick={w.finish} disabled={w.finishing}>
              {en.workout.finish}
            </Button>
          </>
        ) : (
          <Button onClick={w.finish} disabled={w.finishing}>
            {en.workout.finish}
          </Button>
        )}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={t.addLift}>
        <div className="flex flex-col gap-2.5">
          <Button
            variant="ghost"
            className="h-14"
            onClick={() => {
              setMenu(false);
              w.setAdding(true);
            }}
          >
            <Icon name="list" /> {en.workout.addFromList}
          </Button>
          <Link to="/scan" className="ll-btn h-14 !text-ink" data-variant="ghost">
            <Icon name="scan" /> {en.workout.scan}
          </Link>
        </div>
      </Sheet>
      <WorkoutSheets w={w} />
    </main>
  );
}

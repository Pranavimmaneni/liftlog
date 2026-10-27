import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { GoalMeter } from '@/components/GoalMeter';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SetDots } from '@/components/SetDots';
import { Sheet } from '@/components/Sheet';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { en } from '@/copy/en';
import { useSessionModel, type ItemModel } from '@/app/session-model';
import { useRest } from '@/app/rest-store';
import { addToSession, cancelSession, discardSession, finishSession } from '@/db/workout';
import { formatLoad, hasLoad } from '@/engine/units';
import type { Units } from '@/engine/types';
import { platform } from '@/platform';
import { ExercisePicker } from '../S13-library/ExercisePicker';
import { RestChip } from '../S25-timer/RestTimer';
import { toast } from '@/components/Toast';

/** FR-WRK-16: how long "Undo" stays after Start workout. */
export const UNDO_START_MS = 10_000;

export function targetLine(item: Pick<ItemModel, 'goal' | 'exercise'>, units: Units): string {
  const g = item.goal;
  const reps = g.repMin === g.repMax ? `${g.repMin}` : `${g.repMin}–${g.repMax}`;
  const lt = item.exercise.loadType;
  if (lt === 'timed') return en.workout.target(g.sets, `${reps} s`, '');
  const load = hasLoad(lt) && g.loadKg !== null ? formatLoad(g.loadKg, lt, units) : '';
  return en.workout.target(g.sets, reps, load);
}

/** S06 active workout: exercises with thumbnail, target, set dots, bonus chip; current highlighted (FR-WRK-2/3). */
export default function Workout() {
  const { sessionId } = useOutletContext<{ sessionId: string }>();
  const model = useSessionModel(sessionId);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const skipRest = useRest((s) => s.skip);
  const [finishing, setFinishing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = model?.session.startedAt;
  const logged = model ? model.items.reduce((n, i) => n + i.sets.length, 0) : 0;
  const undoLeft = startedAt === undefined || logged ? 0 : startedAt + UNDO_START_MS - now;
  useEffect(() => {
    if (undoLeft <= 0) return;
    const t = window.setTimeout(() => setNow(Date.now()), undoLeft);
    return () => window.clearTimeout(t);
  }, [undoLeft]);

  if (!model) return null;
  const units = model.profile.units;
  const lock = platform.capabilities();

  const finish = async () => {
    const work = model.items.reduce((n, i) => n + i.work.length, 0);
    if (!work) return setConfirmDiscard(true);
    setFinishing(true);
    const r = await finishSession(sessionId);
    skipRest();
    void platform.keepAwake(false);
    navigate(r.status === 'finished' ? `/summary/${r.sessionId}` : '/', { replace: true });
  };

  // FR-WRK-16: a workout started by mistake goes without a trace; the Up next queue is untouched.
  const cancel = async (message?: string) => {
    await cancelSession(sessionId);
    skipRest();
    void platform.keepAwake(false);
    if (message) toast(message);
    navigate('/', { replace: true });
  };

  return (
    <main className="flex grow flex-col pb-[calc(20px+env(safe-area-inset-bottom))]">
      <ScreenHeader
        title={model.session.name}
        size={34}
        subtitle={en.workout.sessionWeek(model.sessionNumber, model.weekNumber)}
        backTo="/"
      />
      {undoLeft > 0 && (
        <div
          role="status"
          className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-card py-1.5 pl-4 pr-1.5"
        >
          <span className="text-[15px] font-semibold">{en.workout.started}</span>
          <Button
            variant="secondary"
            size="sm"
            className="h-11 !w-auto shrink-0 !px-5"
            aria-label={en.workout.undoLabel}
            onClick={() => void cancel()}
          >
            {en.workout.undo}
          </Button>
        </div>
      )}
      {!lock.wakeLock && platform.os === 'ios' && (
        <p className="mx-5 mt-2 rounded-md bg-panel px-3 py-2 text-[13px] text-ink2">
          {en.workout.keepAwakeHint}
        </p>
      )}
      {model.session.deload && (
        <p className="mx-5 mt-2 rounded-md bg-brass-wash px-3 py-2 text-[13px]">{en.home.deloadNow}</p>
      )}

      <div className="px-5 pt-4">
        <GoalMeter meter={model.meter} />
      </div>

      <ul className="flex flex-col gap-2.5 px-5 pt-3.5">
        {model.items.map((it) => {
          const isCurrent = model.current?.exercise.id === it.exercise.id;
          const chip = isCurrent ? (
            <Chip variant="red" className="!px-4 !py-2 !text-[13px]">
              {en.workout.now}
            </Chip>
          ) : it.progress.bonusReps > 0 ? (
            <Chip variant="brass" className="!px-3 !py-2 !text-[13px]">
              {en.workout.plusReps(it.progress.bonusReps)}
            </Chip>
          ) : it.progress.bonusSet ? (
            <Chip variant="brass">{en.workout.plusSet}</Chip>
          ) : !it.planned ? (
            <Chip variant="soft">{en.workout.unplanned}</Chip>
          ) : null;
          return (
            <li key={it.exercise.id}>
              <Link
                to={`/workout/${it.exercise.id}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-ink no-underline ${
                  isCurrent
                    ? 'border-2 border-ink shadow-hard'
                    : it.complete || isCurrent
                      ? 'border-[1.5px] border-line'
                      : 'border-[1.5px] border-rule'
                }`}
              >
                <ExerciseThumb exercise={it.exercise} className="h-[42px] w-[58px]" />
                <span className="min-w-0 grow">
                  <span className="block text-[15px] font-bold leading-tight tracking-[-0.01em]">
                    {it.exercise.name}
                  </span>
                  <span className="t-mono mt-0.5 block text-[11px] text-ink2">{targetLine(it, units)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  {chip}
                  <SetDots dots={it.progress.dots} currentIdx={isCurrent ? it.nextIdx : undefined} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-3">
        <Button
          variant="ghost"
          onClick={() => setAdding(true)}
          className="h-14 whitespace-nowrap !px-3 !text-[16px]"
        >
          <Icon name="list" /> {en.workout.addFromList}
        </Button>
        <Link to="/scan" className="ll-btn h-14 whitespace-nowrap !px-3 !text-[16px]" data-variant="ghost">
          <Icon name="scan" /> {en.workout.scan}
        </Link>
      </div>

      <div className="px-5 pt-2">
        <button
          type="button"
          className="ll-link min-h-11 w-full text-center"
          onClick={() => (logged ? setConfirmCancel(true) : void cancel(en.workout.cancelled))}
        >
          {en.workout.cancel}
        </button>
      </div>

      <div className="mt-auto flex items-center gap-2.5 px-5 pt-8">
        <RestChip />
        <Button variant="secondary" onClick={finish} disabled={finishing}>
          {en.workout.finish}
        </Button>
      </div>

      <ExercisePicker
        open={adding}
        title={en.workout.addFromList}
        exclude={model.items.map((i) => i.exercise.id)}
        onClose={() => setAdding(false)}
        onPick={async (e) => {
          setAdding(false);
          await addToSession(sessionId, e.id);
          navigate(`/workout/${e.id}`);
        }}
        onCreate={(name) => navigate('/library/new', { state: { addToWorkout: true, name } })}
      />
      <Sheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={en.workout.finishConfirmTitle}
        tone="danger"
        footer={
          <>
            <Button
              variant="destructive"
              onClick={async () => {
                await discardSession(sessionId);
                skipRest();
                void platform.keepAwake(false);
                navigate('/', { replace: true });
              }}
            >
              {en.workout.discard}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
              {en.workout.keepGoing}
            </Button>
          </>
        }
      >
        <p className="text-[15px]">{en.workout.finishConfirmBody}</p>
      </Sheet>
      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={en.workout.cancelTitle}
        tone="danger"
        footer={
          <>
            <Button variant="destructive" onClick={() => void cancel(en.workout.cancelled)}>
              {en.workout.cancel}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              {en.workout.keepGoing}
            </Button>
          </>
        }
      >
        <p className="text-[15px]">{en.workout.cancelBody(logged, model.session.name)}</p>
      </Sheet>
    </main>
  );
}

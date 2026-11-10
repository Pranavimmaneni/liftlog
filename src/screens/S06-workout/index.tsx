import { Link } from 'react-router';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { GoalMeter } from '@/components/GoalMeter';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SetDots } from '@/components/SetDots';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { en } from '@/copy/en';
import { useDesign } from '@/app/design';
import { platform } from '@/platform';
import { RestChip } from '../S25-timer/RestTimer';
import { targetLine } from './target';
import { useWorkoutState, WorkoutSheets, type WorkoutState } from './state';
import { WorkoutSun } from './WorkoutSun';

/** S06 active workout. The Rising Sun look has its own layout over the same state (FR-DSN-5). */
export default function Workout() {
  const w = useWorkoutState();
  const sun = useDesign() === 'sun';
  if (!w.model) return null;
  return sun ? <WorkoutSun w={w} /> : <WorkoutClassic w={w} />;
}

/** S06 active workout: exercises with thumbnail, target, set dots, bonus chip; current highlighted (FR-WRK-2/3). */
function WorkoutClassic({ w }: { w: WorkoutState }) {
  const model = w.model!;
  const { logged, undoLeft, finish, cancel, finishing, setAdding, setConfirmCancel } = w;
  const units = model.profile.units;
  const lock = platform.capabilities();

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

      <WorkoutSheets w={w} />
    </main>
  );
}

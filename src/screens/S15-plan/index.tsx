import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/Toast';
import { en } from '@/copy/en';
import { db } from '@/db/schema';
import { useExerciseMap } from '@/db/catalog';
import { useSettings } from '@/db/settings';
import { skipQueueTo, upNextOf, useActiveRoutine, useProfile, useQueue } from '@/db/repo';
import { splitById } from '@/engine/split';
import { rotationOrder } from '@/engine/rotation';
import { weekRange } from '@/engine/week';

/** S15 Plan tab: "Up next" queue, skip to any session, edit a session (FR-RTN-2, FR-RTN-4). */
export default function Plan() {
  const routine = useActiveRoutine();
  const queue = useQueue();
  const profile = useProfile();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const [wStart, wEnd] = weekRange(Date.now(), settings.weekStart);
  const doneThisWeek = useLiveQuery(
    () =>
      db.sessions
        .filter((s) => s.endedAt !== undefined && s.startedAt >= wStart && s.startedAt < wEnd)
        .count(),
    [wStart],
  );
  if (routine === undefined) return null;
  if (!routine) {
    return (
      <main className="px-5 pt-4">
        <h1 className="t-display text-[40px]">{en.plan.title}</h1>
        <div className="mt-4">
          <EmptyState
            action={
              <Link to="/onboarding/split" className="ll-link">
                {en.home.buildRoutine}
              </Link>
            }
          >
            {en.home.noRoutine}
          </EmptyState>
        </div>
      </main>
    );
  }
  const order = queue ? rotationOrder(routine, queue) : routine.sessions.map((_, i) => i);
  const next = upNextOf(routine, queue);
  return (
    <main className="px-5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="t-display text-[40px]">{en.plan.title}</h1>
        <Chip variant="soft" className="!px-4 !py-2.5 !text-[13px]">
          {splitById(routine.splitId)?.name ?? ''}
        </Chip>
      </div>
      <div className="ll-card mt-4 flex items-center justify-between px-3.5 py-3">
        <span className="t-label">{en.home.thisWeek}</span>
        <span className="t-label !text-ink">
          {en.home.weekDone(
            Math.min(doneThisWeek ?? 0, profile?.daysPerWeek ?? 0),
            profile?.daysPerWeek ?? 0,
          )}
        </span>
      </div>
      <h2 className="t-label mt-5">{en.plan.upNext}</h2>
      <ol className="mt-2 flex flex-col gap-2.5">
        {order.map((idx, pos) => {
          const s = routine.sessions[idx]!;
          const isNext = next?.sessionIndex === idx;
          const names = [...s.items]
            .sort((a, b) => a.order - b.order)
            .map((i) => exMap?.get(i.exerciseId)?.name ?? '');
          return (
            <li
              key={s.id}
              className={`rounded-lg bg-card px-3.5 py-3 ${isNext ? 'border-2 border-ink shadow-hard' : 'border-[1.5px] border-line'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="t-display text-[28px]">{s.name}</h3>
                {isNext ? (
                  <Chip variant="red">{en.home.next}</Chip>
                ) : (
                  <button
                    type="button"
                    className="ll-chip min-h-11"
                    onClick={() => void skipQueueTo(routine, pos)}
                  >
                    {en.plan.skipTo}
                  </button>
                )}
              </div>
              <p className="mt-1 text-[14px] leading-snug text-ink2">
                {names.join(' · ') || en.routine.empty}
              </p>
              <Link to={`/plan/edit/${idx}`} className="ll-link mt-1 inline-block">
                {en.plan.edit}
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

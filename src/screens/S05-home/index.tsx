import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, LinkButton } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { muscleName } from '@/components/ExerciseRow';
import { en } from '@/copy/en';
import { lastWeekday, list, monthName, shortDate, weekdayDate } from '@/copy/format';
import { db } from '@/db/schema';
import { useExerciseMap } from '@/db/catalog';
import { useSettings } from '@/db/settings';
import { upNextOf, useActiveRoutine, useProfile, useQueue } from '@/db/repo';
import { goalFromHistory, historyFor, startSession } from '@/db/workout';
import { useActiveSessionId } from '@/app/session-model';
import { useDeload } from '@/db/deload';
import { DeloadBanner } from '@/components/DeloadBanner';
import { INTENSITY } from '@/engine/data';
import { estimateMinutes } from '@/engine/summary';
import { rotationOrder } from '@/engine/rotation';
import { dateKey, monthGrid, weekRange } from '@/engine/week';
import { displayNumber } from '@/engine/units';
import { platform } from '@/platform';
import { WeighInSheet } from '../S20-weighin/WeighInSheet';

const GOING_UP = new Set(['up', 'less_assist', 'more_reps']);

/** S05 Home / Today tab: up next, this week, the month, weigh-in (FR-RTN-4, FR-RTN-5, FR-WRK-1). */
export default function Home() {
  const navigate = useNavigate();
  const profile = useProfile();
  const routine = useActiveRoutine();
  const queue = useQueue();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const activeId = useActiveSessionId();
  const deload = useDeload();
  const [weighIn, setWeighIn] = useState(false);
  const [starting, setStarting] = useState(false);
  const now = Date.now();

  const next = upNextOf(routine, queue);
  const nextIds = useMemo(
    () =>
      next && routine
        ? [...routine.sessions[next.sessionIndex]!.items]
            .sort((a, b) => a.order - b.order)
            .map((i) => i.exerciseId)
        : [],
    [next, routine],
  );

  const data = useLiveQuery(async () => {
    const finished = (await db.sessions.filter((s) => s.endedAt !== undefined).toArray()).sort(
      (a, b) => a.startedAt - b.startedAt,
    );
    const bws = await db.bodyweights.orderBy('date').toArray();
    const history = await historyFor(nextIds);
    return { finished, lastBw: bws[bws.length - 1] ?? null, history };
  }, [nextIds.join(',')]);

  const preview = useMemo(() => {
    if (!exMap || !profile || !data) return null;
    const exs = nextIds.map((id) => exMap.get(id)).filter((e) => !!e);
    const goals = exs.map((e) => goalFromHistory(e!, data.history, profile));
    const sets = goals.reduce((n, g) => n + g.sets, 0);
    const minutes = estimateMinutes(
      exs.map((e, i) => ({ role: e!.role, sets: goals[i]!.sets })),
      INTENSITY.secondsPerSetIncludingRest,
    );
    const muscles = [...new Set(exs.map((e) => muscleName(e!.primary[0]).toLowerCase()))].slice(0, 4);
    const up = goals.filter((g) => GOING_UP.has(g.reason.code)).length;
    const lastSame = next
      ? [...data.finished].reverse().find((s) => s.routineSessionId === next.session.id)
      : undefined;
    return { exs: exs as NonNullable<(typeof exs)[number]>[], sets, minutes, muscles, up, lastSame };
  }, [exMap, profile, data, nextIds, next]);

  const lastSameMeter = useLiveQuery(async () => {
    const s = preview?.lastSame;
    if (!s) return null;
    const sets = await db.sets.where('sessionId').equals(s.id).toArray();
    const work = sets.filter((x) => x.kind === 'work');
    return { done: work.filter((x) => x.goalMet).length, total: work.length, at: s.startedAt };
  }, [preview?.lastSame?.id]);

  if (profile === undefined || routine === undefined) return null;
  const units = profile?.units ?? 'kg';

  // This week (FR-RTN-5): planned = days per week; tiles follow the rotation order.
  const [wStart, wEnd] = weekRange(now, settings.weekStart);
  const doneThisWeek = (data?.finished ?? []).filter((s) => s.startedAt >= wStart && s.startedAt < wEnd);
  const doneIds = new Set(doneThisWeek.map((s) => s.routineSessionId));
  const order = routine && queue ? rotationOrder(routine, queue) : [];
  const planned = profile?.daysPerWeek ?? order.length;

  const sessionDays = new Set((data?.finished ?? []).map((s) => dateKey(s.startedAt)));
  const grid = monthGrid(now, settings.weekStart);
  const today = new Date(now);

  const start = async () => {
    if (activeId) return navigate('/workout');
    if (!routine || !next) return;
    setStarting(true);
    // FR-WRK-1: the tap unlocks audio (FR-PLT-3) and requests wake lock (FR-PLT-2).
    platform.unlockAudio();
    void platform.keepAwake(true);
    await startSession({
      routineId: routine.id,
      routineSessionId: next.session.id,
      name: next.session.name,
      exerciseIds: nextIds,
      deload: deload?.thisWeek,
    });
    navigate('/workout');
  };

  return (
    <main className="px-5 pt-[18px]">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="t-display text-[30px] leading-none tracking-[0.08em]">{en.app.name}</h1>
          <p className="t-label mt-1">{weekdayDate(now)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link to="/settings" className="ll-icon-btn" aria-label={en.common.settings}>
            <Icon name="gear" />
          </Link>
        </div>
      </header>

      <DeloadBanner deload={deload} />

      {!routine || !next ? (
        <div className="ll-card ll-card-hard mt-4 p-4">
          <p className="text-[15px]">{en.home.noRoutine}</p>
          <LinkButton to="/plan" className="mt-3">
            {en.home.buildRoutine}
          </LinkButton>
        </div>
      ) : (
        <section className="ll-card ll-card-hard mt-4 p-4" aria-labelledby="up-next">
          <div className="flex items-center justify-between gap-2">
            <p className="t-label !text-accent">{en.home.upNext(next.position + 1, next.total)}</p>
            {preview && (
              <Chip variant="soft" className="!px-3 !py-2 !text-[12px]">
                {en.home.minutes(preview.minutes)}
              </Chip>
            )}
          </div>
          <h2 id="up-next" className="t-display mt-2.5 break-words text-[64px]">
            {next.session.name}
          </h2>
          {preview && (
            <>
              <p className="mt-1.5 text-[14px] text-ink2">
                {en.home.summary(
                  preview.exs.length,
                  preview.sets,
                  list(preview.muscles).replace(/^./, (c) => c.toUpperCase()),
                )}
              </p>
              <div className="mt-3 flex gap-[5px] overflow-hidden" aria-hidden="true">
                {preview.exs.slice(0, preview.exs.length > 5 ? 4 : 5).map((e) => (
                  <ExerciseThumb key={e.id} exercise={e} className="h-10 w-14" />
                ))}
                {preview.exs.length > 5 && (
                  <span className="t-num flex h-10 w-14 items-center justify-center rounded bg-panel text-[13px] text-ink2">
                    +{preview.exs.length - 4}
                  </span>
                )}
              </div>
              <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug">
                <Icon name="check" size={18} strokeWidth={2.6} className="mt-px shrink-0" />
                <span>
                  {lastSameMeter
                    ? en.home.lastTime(
                        shortDate(lastSameMeter.at),
                        (lastSameMeter.done >= lastSameMeter.total
                          ? en.home.lastAllGoals
                          : en.home.lastSome(lastSameMeter.done, lastSameMeter.total)) +
                          (preview.up ? en.home.liftsUp(preview.up) : ''),
                      )
                    : en.home.firstTime}
                </span>
              </p>
            </>
          )}
          <div className="mt-3.5">
            <Button onClick={start} disabled={starting || nextIds.length === 0}>
              {activeId ? en.home.resume : en.home.start}
            </Button>
          </div>
        </section>
      )}

      {routine && order.length > 0 && (
        <section className="ll-card mt-3.5 px-3.5 py-3" aria-labelledby="this-week">
          <div className="flex justify-between">
            <h2 id="this-week" className="t-label">
              {en.home.thisWeek}
            </h2>
            <p className="t-label">{en.home.weekDone(Math.min(doneThisWeek.length, planned), planned)}</p>
          </div>
          <ol className="mt-2.5 flex gap-1.5">
            {order.map((idx) => {
              const s = routine.sessions[idx]!;
              const done = doneIds.has(s.id);
              const isNext = next?.session.id === s.id;
              return (
                <li
                  key={s.id}
                  className={`flex h-[52px] min-w-0 grow basis-0 flex-col items-center justify-center gap-[3px] rounded-md border-[1.5px] px-1 ${
                    done
                      ? 'border-ink bg-ink text-card'
                      : isNext
                        ? 'border-ink bg-accent text-on-accent shadow-hard-sm'
                        : 'border-dashed border-ink2 text-ink2'
                  }`}
                >
                  <span className="t-display-800 max-w-full truncate text-[16px]">{s.name}</span>
                  {done && (
                    <>
                      <Icon name="check" size={16} strokeWidth={3} />
                      <span className="sr-only">{en.home.doneSr}</span>
                    </>
                  )}
                  {isNext && !done && (
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em]">
                      {en.home.next}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="mt-3 flex gap-3">
        <section className="ll-card grow px-3.5 py-3" aria-labelledby="month">
          <h2 id="month" className="t-label">
            {monthName(now)}
          </h2>
          <div
            className="mt-2.5 grid grid-cols-7 gap-[5px]"
            role="img"
            aria-label={`${sessionDays.size} sessions logged`}
          >
            {grid.map((d, i) => {
              if (d === null) return <span key={i} className="h-3.5 w-3.5" />;
              const key = dateKey(new Date(today.getFullYear(), today.getMonth(), d));
              const isToday = d === today.getDate();
              const past = d < today.getDate();
              const had = sessionDays.has(key);
              return (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 justify-self-center rounded-[3px] ${
                    isToday
                      ? 'bg-accent shadow-[0_0_0_2px_var(--ll-card),0_0_0_3.5px_var(--ll-accent)]'
                      : had
                        ? 'bg-ink'
                        : past
                          ? 'bg-panel'
                          : 'border-[1.5px] border-ink2'
                  }`}
                />
              );
            })}
          </div>
        </section>
        <section className="ll-card flex w-[112px] shrink-0 flex-col px-3 py-3" aria-labelledby="weigh">
          <h2 id="weigh" className="t-label">
            {en.home.weighIn}
          </h2>
          {data?.lastBw ? (
            <>
              <p className="mt-2 flex items-baseline gap-0.5">
                <span className="t-display text-[36px]">{displayNumber(data.lastBw.kg, units)}</span>
                <span className="t-display-800 text-[18px] normal-case">{units}</span>
              </p>
              <p className="text-[13px] text-ink2">
                {lastWeekday(new Date(data.lastBw.date + 'T12:00').getTime(), now)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-ink2">{en.home.noWeighIn}</p>
          )}
          <button
            type="button"
            className="ll-chip mt-auto min-h-11 justify-center !text-[13px]"
            onClick={() => setWeighIn(true)}
          >
            {en.home.log}
          </button>
        </section>
      </div>
      <WeighInSheet
        open={weighIn}
        onClose={() => setWeighIn(false)}
        lastKg={data?.lastBw?.kg ?? null}
        units={units}
      />
    </main>
  );
}

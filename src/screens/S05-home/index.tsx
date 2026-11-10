import { useState } from 'react';
import { Link } from 'react-router';
import { Button, LinkButton } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { en } from '@/copy/en';
import { SectionSwitch } from '@/components/SectionSwitch';
import { lastWeekday, list, monthName, shortDate, weekdayDate } from '@/copy/format';
import { DeloadBanner } from '@/components/DeloadBanner';
import { dateKey } from '@/engine/week';
import { displayNumber } from '@/engine/units';
import { useDesign } from '@/app/design';
import { WeighInSheet } from '../S20-weighin/WeighInSheet';
import { BackupNudgeBanner, HeaderChips, InstallBanner, QuestCard } from './Motivation';
import { useHomeData } from './data';
import { ReviewReady } from './ReviewReady';
import { HomeSun } from './HomeSun';

/** S05 Today tab. The Rising Sun look has its own layout over the same data (FR-DSN-4). */
export default function Home() {
  return useDesign() === 'sun' ? <HomeSun /> : <HomeClassic />;
}

/** S05 Home / Today tab: up next, this week, the month, weigh-in (FR-RTN-4, FR-RTN-5, FR-WRK-1). */
function HomeClassic() {
  const h = useHomeData();
  const [weighIn, setWeighIn] = useState(false);
  if (!h) return null;
  const {
    routine,
    settings,
    activeId,
    deload,
    motivation,
    nudge,
    starting,
    now,
    next,
    nextIds,
    data,
    preview,
    lastSameMeter,
    units,
    doneThisWeek,
    doneIds,
    order,
    planned,
    sessionDays,
    grid,
    today,
    start,
  } = h;

  return (
    <main className="px-5 pt-[14px]">
      {/* PRD-1.2 FR-NAV-2: the section switch is the only Food addition to LiftLog (mockup X01). */}
      <SectionSwitch current="liftlog" />
      <header className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="t-display text-[30px] leading-none tracking-[0.08em]">{en.app.name}</h1>
          <p className="t-label mt-1">{weekdayDate(now)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <HeaderChips m={motivation} />
          <Link to="/settings" className="ll-icon-btn" aria-label={en.common.settings}>
            <Icon name="gear" />
          </Link>
        </div>
      </header>

      <DeloadBanner deload={deload} />
      <ReviewReady finished={data?.finished} weekStart={settings.weekStart} now={now} />
      <BackupNudgeBanner nudge={nudge} />
      <InstallBanner />

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

      {routine && next && <QuestCard m={motivation} />}

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

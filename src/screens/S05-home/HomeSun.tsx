import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { Button, LinkButton } from '@/components/Button';
import { DeloadBanner } from '@/components/DeloadBanner';
import { muscleName } from '@/components/ExerciseRow';
import { Icon } from '@/components/Icon';
import { SectionSwitch } from '@/components/SectionSwitch';
import { MuscleMap } from '@/illustration/Pictogram';
import { en } from '@/copy/en';
import { lastWeekday, list, monthName, shortDate, weekdayDate } from '@/copy/format';
import { useSessionModel } from '@/app/session-model';
import { dateKey } from '@/engine/week';
import { displayNumber } from '@/engine/units';
import type { Exercise } from '@/engine/types';
import { WeighInSheet } from '../S20-weighin/WeighInSheet';
import { BackupNudgeBanner, InstallBanner, questText } from './Motivation';
import { ReviewReady } from './ReviewReady';
import { useHomeData } from './data';

const FoodCard = lazy(() => import('./FoodCard'));

/** Muscles a list of exercises trains: main ones, and helpers that are nobody's main muscle. */
export function sessionMuscles(exs: Pick<Exercise, 'primary' | 'secondary'>[]) {
  const primary = [...new Set(exs.flatMap((e) => e.primary))];
  const secondary = [...new Set(exs.flatMap((e) => e.secondary))].filter((m) => !primary.includes(m));
  return { primary, secondary };
}

/**
 * S05 Today in the Rising Sun look (FR-DSN-4, handoff §7): two cards. The workout card has the
 * session, its sets and time, the day's muscle map, Start / Resume and the month as dots with the
 * streak. The Food card has calories left, "Log food" and four rings. Everything else the classic
 * Today shows (FR-RTN-4/5, FR-XP-2/4/6, weigh-in) sits in a quiet list below (handoff §8.1).
 */
export function HomeSun() {
  const h = useHomeData();
  const active = useSessionModel(h?.activeId ?? undefined);
  const [weighIn, setWeighIn] = useState(false);
  const [showDates, setShowDates] = useState(false);
  if (!h) return null;
  const { routine, next, preview, motivation, data, units, now, today, grid, sessionDays } = h;
  const t = en.sun.today;

  // While a workout is open the card describes that workout; otherwise the one that is up next.
  const exs = active ? active.items.map((i) => i.exercise) : (preview?.exs ?? []);
  const { primary, secondary } = sessionMuscles(exs);
  const name = active ? active.session.name : next?.session.name;
  const sub = active
    ? t.active(
        active.items.reduce((n, i) => n + Math.min(i.progress.logged, i.goal.sets), 0),
        active.items.reduce((n, i) => n + i.goal.sets, 0),
        Math.max(0, Math.floor((now - active.session.startedAt) / 60_000)),
      )
    : preview
      ? t.planned(preview.sets, preview.minutes)
      : '';
  const monthDays = grid.filter(
    (d) => d !== null && sessionDays.has(dateKey(new Date(today.getFullYear(), today.getMonth(), d))),
  ).length;
  const weekdays = Array.from({ length: 7 }, (_, i) => en.settings.days[(h.settings.weekStart + i) % 7]!);
  const lastLine = h.lastSameMeter
    ? en.home.lastTime(
        shortDate(h.lastSameMeter.at),
        (h.lastSameMeter.done >= h.lastSameMeter.total
          ? en.home.lastAllGoals
          : en.home.lastSome(h.lastSameMeter.done, h.lastSameMeter.total)) +
          (preview?.up ? en.home.liftsUp(preview.up) : ''),
      )
    : en.home.firstTime;

  return (
    <main className="px-5 pt-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="sun-title">{t.title}</h1>
        <div className="flex items-center gap-2">
          <span className="text-[15px] text-ink2">{weekdayDate(now)}</span>
          <Link to="/settings" className="ll-icon-btn !text-ink" aria-label={en.common.settings}>
            <Icon name="gear" />
          </Link>
        </div>
      </header>
      <div className="mt-3">
        <SectionSwitch current="liftlog" />
      </div>

      <DeloadBanner deload={h.deload} />
      <ReviewReady finished={data?.finished} weekStart={h.settings.weekStart} now={now} />
      <BackupNudgeBanner nudge={h.nudge} />
      <InstallBanner />

      <section className="sun-glass mt-4 rounded-[18px] p-[18px]" aria-labelledby="up-next">
        {!routine || !name ? (
          <>
            <p id="up-next" className="text-[15px]">
              {en.home.noRoutine}
            </p>
            <LinkButton to="/plan" className="mt-3">
              {en.home.buildRoutine}
            </LinkButton>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="up-next" className="sun-display break-words text-[22px] uppercase">
                  {name}
                </h2>
                <p className="mt-1.5 text-[15px] text-ink2">{sub}</p>
              </div>
              {primary.length > 0 && (
                <MuscleMap
                  primary={primary}
                  secondary={secondary}
                  label={t.muscles(list(primary.map((m) => muscleName(m).toLowerCase())))}
                  className="h-[100px] w-[124px] shrink-0"
                />
              )}
            </div>
            <div className="mt-3.5">
              <Button onClick={h.start} disabled={h.starting || (!h.activeId && h.nextIds.length === 0)}>
                {h.activeId ? en.home.resume : en.home.start}
              </Button>
            </div>
          </>
        )}

        <div className="mt-5 flex items-center justify-between text-[15px]">
          <h2 className="font-bold">{monthName(now)}</h2>
          {motivation && motivation.streak.weeks > 0 && (
            <Link to="/progress/review" className="py-2 !text-ink2 no-underline">
              {t.streak(motivation.streak.weeks)}
            </Link>
          )}
        </div>
        {/* Dates are hidden for calm and shown on tap (handoff §8.1). */}
        <button
          type="button"
          className="mt-1 grid w-full grid-cols-7 items-center justify-items-center gap-y-2 py-1"
          aria-pressed={showDates}
          aria-label={t.calendar(monthName(now), monthDays)}
          onClick={() => setShowDates(!showDates)}
        >
          {weekdays.map((d, i) => (
            <span key={`h${i}`} className="h-[18px] text-[13px] font-semibold text-ink2" aria-hidden="true">
              {d[0]}
            </span>
          ))}
          {grid.map((d, i) => {
            if (d === null) return <span key={i} />;
            const had = sessionDays.has(dateKey(new Date(today.getFullYear(), today.getMonth(), d)));
            const isToday = d === today.getDate();
            const tone = had
              ? 'bg-btn text-btn-ink'
              : isToday
                ? 'shadow-[inset_0_0_0_2px_var(--ll-ink)]'
                : showDates
                  ? ''
                  : 'bg-soft';
            return showDates ? (
              <span
                key={i}
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${tone}`}
                aria-hidden="true"
              >
                {d}
              </span>
            ) : (
              <span key={i} className={`h-3 w-3 rounded-full ${tone}`} aria-hidden="true" />
            );
          })}
        </button>
      </section>

      <Suspense fallback={<div className="sun-glass mt-3 h-[170px] rounded-[18px]" aria-hidden="true" />}>
        <FoodCard />
      </Suspense>

      {routine && next && (
        <section className="sun-glass mt-3 overflow-hidden rounded-[14px]" aria-label={t.more}>
          <div className="sun-list-row">
            <span className="min-w-0">
              <span className="block font-medium">{en.home.thisWeek}</span>
              <span className="block text-[13px] text-ink2">
                {t.session(next.position + 1, next.total)}. {lastLine}
              </span>
            </span>
            <b className="shrink-0 tabular-nums">
              {en.home.weekDone(Math.min(h.doneThisWeek.length, h.planned), h.planned)}
            </b>
          </div>
          {motivation && (
            <div className="sun-list-row">
              <span className="min-w-0">
                <span className="block font-medium">{t.quest}</span>
                <span className="block text-[13px] text-ink2">
                  {motivation.quest.complete
                    ? `${en.xp.questDone}: ${questText(motivation.quest.quest)}`
                    : questText(motivation.quest.quest)}
                </span>
              </span>
              <b className="shrink-0 tabular-nums">
                {motivation.quest.done} / {motivation.quest.target}
              </b>
            </div>
          )}
          <button type="button" className="sun-list-row" onClick={() => setWeighIn(true)}>
            <span className="font-medium">{t.weighIn}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {data?.lastBw ? (
                <>
                  <b className="tabular-nums">
                    {displayNumber(data.lastBw.kg, units)} {units}
                  </b>
                  <span className="text-ink2">
                    {lastWeekday(new Date(data.lastBw.date + 'T12:00').getTime(), now)}
                  </span>
                </>
              ) : (
                <b>{t.weighInAdd}</b>
              )}
              <Icon name="chevronRight" size={16} className="text-ink2" />
            </span>
          </button>
          {motivation && (
            <Link to="/progress" className="sun-list-row !text-ink">
              <span className="font-medium">{t.level(motivation.level.level)}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <b>{motivation.level.title}</b>
                <Icon name="chevronRight" size={16} className="text-ink2" />
              </span>
            </Link>
          )}
        </section>
      )}

      <WeighInSheet
        open={weighIn}
        onClose={() => setWeighIn(false)}
        lastKg={data?.lastBw?.kg ?? null}
        units={units}
      />
    </main>
  );
}

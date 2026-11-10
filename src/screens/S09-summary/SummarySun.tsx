import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { en } from '@/copy/en';
import { formatInt, longDate } from '@/copy/format';
import { celebrateOnce } from '@/app/echo';
import { formatLoad, fromDisplay, toDisplay } from '@/engine/units';
import type { Ticket } from './useTicket';
import { setsLine, type SummaryView } from './view';

/** How long after finishing the summary still counts as "just finished" for the celebration. */
const JUST_FINISHED_MS = 60_000;
const LIFTS_SHOWN = 3;

/**
 * S09 Workout summary in the Rising Sun look (FR-DSN-10, mockup HW1S09): a hero card with the goal
 * sets hit and three tiles, then the lifts with their sets. Everything else the classic ticket shows
 * (sets, reps, bonus reps, the comparison with last time, records, next time, level and XP,
 * milestones) follows in quiet glass cards. Share makes the same ticket image as before.
 */
export function SummarySun({ t, v, onDone }: { t: Ticket; v: SummaryView; onDone: () => void }) {
  const { model, totals } = t;
  const { units, meter, pct, bonusPct, tonnage, diff, xp, lvl, nextItems } = v;
  const c = en.sun.progress.summary;
  const [all, setAll] = useState(false);
  const { id, name, endedAt } = model.session;
  const workSets = totals.workSets;

  // FR-DSN-8: finishing a workout celebrates once, on arrival; reopening the summary later doesn't.
  useEffect(() => {
    if (endedAt === undefined || Date.now() - endedAt > JUST_FINISHED_MS) return;
    celebrateOnce(en.sun.echo.workout, { ['done-' + id]: c.celebrate(name, workSets) });
  }, [id, name, endedAt, workSets, c]);

  const lifts = model.items
    .map((i) => ({
      exercise: i.exercise,
      sets: i.sets.filter((s) => s.kind !== 'warmup'),
      prs: t.prs.filter((p) => p.exerciseId === i.exercise.id),
    }))
    .filter((l) => l.sets.length > 0);
  const shown = all ? lifts : lifts.slice(0, LIFTS_SHOWN);

  return (
    <main className="flex min-h-dvh flex-col pb-[calc(20px+env(safe-area-inset-bottom))]">
      <ScreenHeader
        title={c.title}
        onBack={onDone}
        right={
          <button
            type="button"
            className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[15px] font-semibold text-ink"
            onClick={() => void v.share()}
          >
            <Icon name="share" size={18} />
            {en.summary.share}
          </button>
        }
      />
      <div className="flex grow flex-col px-5 pt-4">
        <article className="sun-glass rounded-[18px] p-[18px]" aria-label={`${name} ticket`}>
          <h2 className="text-[15px] font-normal text-ink2">
            <b className="font-semibold text-ink">{name}</b> · {longDate(model.session.startedAt)} ·{' '}
            {en.summary.week(model.weekNumber)}
          </h2>
          <p className="sun-display mt-2 break-words text-[48px]">
            {meter.done} / {meter.total}
          </p>
          <p className="mt-1.5 text-[15px]">
            {c.goalSetsHit} · <b>{c.pct(pct)}</b>
            {bonusPct > 0 && <span className="text-ink2"> · {en.summary.bonusPct(bonusPct)}</span>}
          </p>
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            <p className="sun-progress-tile">
              <b>{en.summary.min(totals.durationMin)}</b>
              {c.time}
            </p>
            <p className="sun-progress-tile">
              <b>
                {formatInt(tonnage)} {units}
              </b>
              {c.lifted}
            </p>
            <p className="sun-progress-tile">
              {xp ? (
                <>
                  <b>+{formatInt(xp.total)}</b>
                  {c.xp}
                </>
              ) : (
                <>
                  <b>{totals.workSets}</b>
                  {c.sets}
                </>
              )}
            </p>
          </div>
          {totals.tonnageExcluded && (
            <p className="mt-3 text-[13px] text-ink2">{en.summary.tonnageExcluded}</p>
          )}
          {model.session.calibration && (
            <p className="mt-3 text-[13px] text-ink2">{en.summary.calibration}</p>
          )}
          <p className="mt-3 text-[13px] text-ink2">{en.summary.ticket(String(t.number).padStart(3, '0'))}</p>
        </article>

        {lifts.length > 0 && (
          <section className="sun-glass mt-3 overflow-hidden rounded-[14px]" aria-label={c.lifts}>
            <ul id="sun-summary-lifts">
              {shown.map((l) => (
                <li key={l.exercise.id} className="sun-list-row !items-start !py-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{l.exercise.name}</span>
                    {l.prs.map((p) => (
                      <span key={p.id} className="block text-[13px] text-ink2">
                        <b className="text-accent-text">{c.record}</b> ·{' '}
                        {/* e1RMs are estimates: whole numbers, as on the classic ticket. */}
                        {en.summary.prLine(
                          formatLoad(
                            fromDisplay(Math.round(toDisplay(p.e1rm, units)), units),
                            l.exercise.loadType,
                            units,
                          ),
                          String(Math.round(toDisplay(p.prevE1rm, units))),
                        )}
                      </span>
                    ))}
                  </span>
                  <span className="max-w-[55%] shrink-0 text-right tabular-nums">
                    {setsLine(l.sets, l.exercise.loadType, units)}
                  </span>
                </li>
              ))}
            </ul>
            {lifts.length > LIFTS_SHOWN && !all && (
              <button
                type="button"
                className="sun-list-row border-t border-rule"
                aria-expanded={false}
                aria-controls="sun-summary-lifts"
                onClick={() => setAll(true)}
              >
                <span className="font-medium">{c.moreLifts(lifts.length - LIFTS_SHOWN)}</span>
                <Icon name="chevronDown" size={16} className="text-ink2" />
              </button>
            )}
          </section>
        )}

        <dl className="sun-glass mt-3 overflow-hidden rounded-[14px]" aria-label={c.details}>
          <Row label={en.summary.sets} value={String(totals.workSets)} />
          <Row label={en.summary.reps} value={formatInt(totals.reps)} />
          <Row label={en.summary.bonusReps} value={`+${meter.bonusReps}`} />
          {diff !== null && (
            <Row
              label={en.summary.vsLast(name)}
              value={`${diff >= 0 ? '+' : '−'}${formatInt(Math.abs(diff))} ${units}`}
            />
          )}
        </dl>

        {nextItems.length > 0 && (
          <p className="sun-glass mt-3 rounded-[14px] px-4 py-3 text-[15px] leading-snug">
            <b>{en.summary.nextTitle(name)}</b> {nextItems.join(' · ')}
          </p>
        )}

        {xp && lvl && (
          <section className="sun-glass mt-3 rounded-[14px] px-4 py-3.5" aria-labelledby="level-h">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="level-h" className="sun-display text-[19px] uppercase">
                {en.xp.levelTitle(lvl.level)}
              </h2>
              <b className="tabular-nums">{en.summary.xp(xp.total)}</b>
            </div>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-soft"
              role="progressbar"
              aria-label={en.xp.toNext(lvl.next - xp.cumulative)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(lvl.progress * 100)}
            >
              <div className="h-full rounded-full bg-sage" style={{ width: `${lvl.progress * 100}%` }} />
            </div>
            <p className="mt-2 text-[14px] text-ink2">{en.summary.xpNote}</p>
          </section>
        )}

        {xp?.milestones.map((m, i) => (
          <div key={i} className="sun-glass mt-3 rounded-[14px] px-4 py-3">
            <p className="text-[13px] font-semibold text-accent-text">{en.xp.milestone}</p>
            <p className="mt-0.5 text-[15px] font-medium">
              {m.id === 'tonnage'
                ? en.xp.tonnage(
                    `${formatInt(toDisplay(m.thresholdKg, units))} ${units}`,
                    m.equivalent.count,
                    m.equivalent.name,
                  )
                : m.id === 'sessions'
                  ? en.xp.sessions(m.count)
                  : en.xp.firstPullup}
            </p>
          </div>
        ))}

        <div className="mt-auto pt-6">
          <Button onClick={onDone}>{en.summary.done}</Button>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="sun-list-row">
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 font-bold tabular-nums">{value}</dd>
    </div>
  );
}

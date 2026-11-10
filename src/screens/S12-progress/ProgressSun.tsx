import { useState } from 'react';
import { Link } from 'react-router';
import { LineChart } from '@/components/Chart';
import { Icon } from '@/components/Icon';
import { SunTop } from '@/components/sun/SunTop';
import { EmptyState, toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { formatInt, longDate, shortDate, weekdayDate } from '@/copy/format';
import { useMotivation } from '@/db/motivation';
import { deleteWeighIn, useBodyweights } from '@/db/repo';
import { displayNumber, hasLoad, toDisplay } from '@/engine/units';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { RecompCard } from '../S10-review/RecompCard';
import { WeighInSheet } from '../S20-weighin/WeighInSheet';
import { useBody, useHistory, useLifts } from './data';
import type { Tab } from './index';

type LiftsData = NonNullable<ReturnType<typeof useLifts>>;

const day = (date: string) => new Date(date + 'T12:00:00').getTime();
const signed = (n: number, text: string) => `${n < 0 ? '−' : '+'}${text}`;

/**
 * S12 Progress in the Rising Sun look (FR-DSN-10, mockup HW1S12): a hero card with the picked
 * lift's estimated 1-rep max and its chart, then one glass list (body weight, level and XP, streak,
 * strength, records). The Lifts / Body / History views of the classic screen stay, as pills.
 */
export function ProgressSun({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const p = en.progress;
  const h = en.sun.progress.hub;
  const lifts = useLifts();
  return (
    <main className="px-5 pb-6 pt-5">
      <SunTop title={p.title} right={lifts?.week ? h.week(lifts.week.number) : undefined} section="liftlog" />
      <div role="group" aria-label={p.tabs} className="mt-3 flex gap-2">
        {(['lifts', 'body', 'history'] as const).map((v) => (
          <button
            key={v}
            type="button"
            className="sun-pill sun-progress-pill"
            aria-pressed={tab === v}
            onClick={() => onTab(v)}
          >
            {p[v]}
          </button>
        ))}
      </div>
      {tab === 'lifts' && lifts && <LiftsSun d={lifts} onTab={onTab} />}
      {tab === 'body' && <BodySun />}
      {tab === 'history' && <HistorySun />}
    </main>
  );
}

function LiftsSun({ d, onTab }: { d: LiftsData; onTab: (t: Tab) => void }) {
  const p = en.progress;
  const h = en.sun.progress.hub;
  const s = en.strength;
  const { map, profile, units, lifts, prs, strength, week, current, ex } = d;
  const motivation = useMotivation();
  const weights = useBodyweights();
  const [showPrs, setShowPrs] = useState(false);
  const sorted = [...(weights ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const lastBw = sorted[sorted.length - 1];
  const prevBw = sorted[sorted.length - 2];
  const bwDiff = lastBw && prevBw ? toDisplay(lastBw.kg - prevBw.kg, units) : null;
  const prText = (pr: NonNullable<typeof prs>[number]) => {
    const e = map.get(pr.exerciseId);
    return `${e && hasLoad(e.loadType) && pr.loadKg > 0 ? `${displayNumber(pr.loadKg, units)} ${units} ` : ''}× ${pr.reps}`;
  };
  const newest = prs?.[0];

  return (
    <>
      {!current || !ex ? (
        <div className="mt-4">
          <EmptyState
            action={
              <Link to="/" className="ll-link">
                {p.startFirst}
              </Link>
            }
          >
            {p.noLifts}
          </EmptyState>
        </div>
      ) : (
        <section className="sun-glass mt-4 rounded-[18px] px-[18px] pb-2 pt-3" aria-label={p.e1rm}>
          <div className="flex items-center justify-between gap-3">
            <label className="relative inline-flex min-w-0 items-center">
              <span className="sr-only">{p.pickLift}</span>
              <select
                className="sun-progress-select h-11 min-w-0 max-w-full appearance-none truncate bg-transparent pr-6 text-[15px] font-semibold text-ink"
                value={current.exerciseId}
                onChange={(e) => d.setPick(e.target.value)}
              >
                {lifts.map((l) => (
                  <option key={l.exerciseId} value={l.exerciseId}>
                    {map.get(l.exerciseId)?.name ?? l.exerciseId}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-1 text-ink2" />
            </label>
            <ExerciseThumb exercise={ex} className="sun-picto h-[44px] w-[62px]" />
          </div>
          <p className="sun-display mt-1 break-words text-[48px]">
            {d.value}
            <span className="sun-progress-unit"> {d.unit}</span>
          </p>
          <p className="mt-1.5 text-[14px]">
            <span className="text-ink2">{p.e1rm}</span>
            {d.changeKg !== null && d.spanWeeks > 0 && (
              <>
                <span className="text-ink2"> · </span>
                <b>
                  {signed(d.changeKg, displayNumber(Math.abs(d.changeKg), units))} {units}
                </b>{' '}
                <span className="text-ink2">{h.inWeeks(d.spanWeeks)}</span>
              </>
            )}
          </p>
          <div className="mt-2">
            <LineChart points={d.points} unit={d.unit} title={d.chartTitle} />
          </div>
        </section>
      )}

      <section className="sun-glass mt-3 overflow-hidden rounded-[14px]" aria-label={h.more}>
        <button type="button" className="sun-list-row" onClick={() => onTab('body')}>
          <span className="font-medium">{h.bodyWeight}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {lastBw ? (
              <>
                <b className="tabular-nums">
                  {displayNumber(lastBw.kg, units)} {units}
                </b>
                {bwDiff !== null && Math.abs(bwDiff) >= 0.05 && (
                  <span className="tabular-nums text-ink2">
                    {signed(bwDiff, (Math.round(Math.abs(bwDiff) * 10) / 10).toFixed(1))}
                  </span>
                )}
              </>
            ) : (
              <b>{h.add}</b>
            )}
            <Icon name="chevronRight" size={16} className="text-ink2" />
          </span>
        </button>
        {motivation && (
          <div className="sun-list-row">
            <span className="min-w-0">
              <span className="block font-medium">{h.level(motivation.level.level)}</span>
              <span className="block text-[13px] text-ink2">
                {motivation.level.title} ·{' '}
                {en.xp.toNext(Math.max(0, motivation.level.next - motivation.totalXp))}
              </span>
            </span>
            <b className="shrink-0 tabular-nums">{h.xp(formatInt(motivation.totalXp))}</b>
          </div>
        )}
        <Link to="/progress/review" className="sun-list-row !text-ink">
          <span className="min-w-0">
            <span className="block font-medium">{h.streak}</span>
            <span className="block text-[13px] text-ink2">
              {h.thisWeek(Math.min(week?.done ?? 0, profile.daysPerWeek), profile.daysPerWeek)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <b className="tabular-nums">{h.weeks(motivation?.streak.weeks ?? 0)}</b>
            <Icon name="chevronRight" size={16} className="text-ink2" />
          </span>
        </Link>
        <Link to="/progress/strength" className="sun-list-row !text-ink">
          <span className="min-w-0">
            <span className="block font-medium">{h.strength}</span>
            {strength?.overall && (
              <span className="block text-[13px] text-ink2">
                {strength.overall.next === null
                  ? p.strengthTop
                  : p.strengthNext(s.bands[strength.overall.next]!)}
              </span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <b className="min-w-0 text-right">
              {strength?.overall
                ? `${strength.overall.band < 0 ? s.below : s.bands[strength.overall.band]}${strength.overall.plus ? '+' : ''}`
                : p.strengthSetup}
            </b>
            <Icon name="chevronRight" size={16} className="shrink-0 text-ink2" />
          </span>
        </Link>
        {!newest ? (
          <div className="sun-list-row">
            <span className="min-w-0">
              <span className="block font-medium">{h.records}</span>
              <span className="block text-[13px] text-ink2">{p.noPrs}</span>
            </span>
            <b className="shrink-0">{h.noRecords}</b>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="sun-list-row"
              aria-expanded={showPrs}
              aria-controls="sun-prs"
              onClick={() => setShowPrs(!showPrs)}
            >
              <span className="font-medium">{h.records}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <b className="min-w-0 truncate">
                  {map.get(newest.exerciseId)?.name ?? newest.exerciseId} {prText(newest)}
                </b>
                <Icon name={showPrs ? 'chevronUp' : 'chevronDown'} size={16} className="shrink-0 text-ink2" />
              </span>
            </button>
            {showPrs && (
              <ul id="sun-prs" aria-label={p.prs} className="border-t border-rule bg-soft">
                {prs!.map((pr) => (
                  <li key={pr.id} className="sun-list-row">
                    <span className="min-w-0 font-medium">
                      {map.get(pr.exerciseId)?.name ?? pr.exerciseId}
                    </span>
                    <span className="shrink-0 text-right text-[15px] tabular-nums">
                      <b>{prText(pr)}</b> <span className="text-ink2">· {shortDate(pr.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}

function BodySun() {
  const p = en.progress;
  const h = en.sun.progress.hub;
  const d = useBody();
  const [open, setOpen] = useState(false);
  if (!d) return null;
  const { units, sorted, last, review } = d;
  const shown = sorted.slice(-16);
  const first = shown[0];
  const diff = last && first && first !== last ? last.kg - first.kg : null;
  return (
    <>
      <section className="sun-glass mt-4 rounded-[18px] px-[18px] pb-2 pt-3" aria-labelledby="bw-h">
        <div className="flex items-center justify-between gap-3">
          <h2 id="bw-h" className="text-[15px] font-semibold">
            {p.weighIns}
          </h2>
          <button type="button" className="sun-pill !min-h-11" onClick={() => setOpen(true)}>
            {p.addWeighIn}
          </button>
        </div>
        {!last ? (
          <p className="pb-3 pt-2 text-[15px] text-ink2">{p.noWeighIns}</p>
        ) : (
          <>
            <p className="sun-display mt-1 break-words text-[48px]">
              {displayNumber(last.kg, units)}
              <span className="sun-progress-unit"> {units}</span>
            </p>
            <p className="mt-1.5 text-[14px]">
              <span className="text-ink2">
                {h.latest} · {weekdayDate(day(last.date))}
              </span>
            </p>
            {diff !== null && (
              <p className="text-[14px]">
                <b>
                  {signed(diff, displayNumber(Math.abs(diff), units))} {units}
                </b>{' '}
                <span className="text-ink2">{h.since(shortDate(day(first!.date)))}</span>
              </p>
            )}
            <div className="mt-2">
              <LineChart
                points={shown.map((w) => ({
                  label: shortDate(day(w.date)),
                  value: Math.round(toDisplay(w.kg, units) * 10) / 10,
                }))}
                unit={units}
                title={p.weighIns}
                maxLabels={4}
              />
            </div>
          </>
        )}
      </section>
      {review && (
        <div className="mt-3">
          <RecompCard
            recomp={review.recomp}
            bodyweight={review.bodyweight}
            strength={review.strength}
            units={units}
          />
        </div>
      )}
      {sorted.length > 0 && (
        <ul className="sun-glass mt-3 overflow-hidden rounded-[14px]">
          {[...sorted]
            .reverse()
            .slice(0, 12)
            .map((w) => {
              const label = weekdayDate(day(w.date));
              return (
                <li key={w.id} className="sun-list-row !py-1 !pr-2">
                  <span className="min-w-0 grow">{label}</span>
                  <b className="shrink-0 tabular-nums">
                    {displayNumber(w.kg, units)} {units}
                  </b>
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink2"
                    aria-label={p.deleteWeighIn(label)}
                    onClick={async () => {
                      await deleteWeighIn(w.id!);
                      toast(p.weighInDeleted);
                    }}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              );
            })}
        </ul>
      )}
      <div className="sun-glass mt-3 overflow-hidden rounded-[14px]">
        <Link to="/progress/body-stats" className="sun-list-row !text-ink">
          <span className="font-medium">{p.bodyStats}</span>
          <Icon name="chevronRight" size={16} className="text-ink2" />
        </Link>
      </div>
      <WeighInSheet open={open} onClose={() => setOpen(false)} lastKg={last?.kg ?? null} units={units} />
    </>
  );
}

function HistorySun() {
  const p = en.progress;
  const sessions = useHistory();
  if (!sessions) return null;
  if (!sessions.length)
    return (
      <div className="mt-4">
        <EmptyState
          action={
            <Link to="/" className="ll-link">
              {p.startFirst}
            </Link>
          }
        >
          {p.noSessions}
        </EmptyState>
      </div>
    );
  return (
    <ul className="sun-glass mt-4 overflow-hidden rounded-[14px]">
      {sessions.map((s) => (
        <li key={s.id} className="border-t border-rule first:border-t-0">
          <Link to={`/progress/session/${s.id}`} className="sun-list-row !text-ink">
            <span className="min-w-0">
              <span className="block font-semibold">{s.name}</span>
              <span className="block text-[13px] text-ink2">{longDate(s.startedAt)}</span>
            </span>
            <Icon name="chevronRight" size={16} className="shrink-0 text-ink2" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

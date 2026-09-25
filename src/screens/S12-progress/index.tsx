import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { LineChart } from '@/components/Chart';
import { Icon } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { longDate, shortDate, weekdayDate } from '@/copy/format';
import { db } from '@/db/schema';
import { useExerciseMap } from '@/db/catalog';
import {
  defaultReviewTime,
  getLiftSeries,
  getRecentPrs,
  getReview,
  getStrength,
  weeklyBest,
} from '@/db/insight';
import { deleteWeighIn, useBodyweights, useProfile } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { relativeChange } from '@/engine/review';
import { displayNumber, hasLoad, loadUnitLabel, toDisplay } from '@/engine/units';
import { weekRange, weekNumber } from '@/engine/week';
import { RecompCard } from '../S10-review/RecompCard';
import { WeighInSheet } from '../S20-weighin/WeighInSheet';

type Tab = 'lifts' | 'body' | 'history';

/** S12 Progress hub (FR-PRO-1): Lifts, Body and History, plus the PR list. */
export default function Progress() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = (['lifts', 'body', 'history'] as const).find((t) => t === params.get('tab')) ?? 'lifts';
  const p = en.progress;
  return (
    <main className="px-5 pb-6 pt-4">
      <h1 className="t-display text-[40px]">{p.title}</h1>
      <SegmentedControl<Tab>
        className="mt-3"
        label={p.tabs}
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        options={[
          { value: 'lifts', label: p.lifts },
          { value: 'body', label: p.body },
          { value: 'history', label: p.history },
        ]}
      />
      {tab === 'lifts' && <Lifts />}
      {tab === 'body' && <Body />}
      {tab === 'history' && <History />}
    </main>
  );
}

function Lifts() {
  const p = en.progress;
  const map = useExerciseMap();
  const profile = useProfile();
  const settings = useSettings();
  const lifts = useLiveQuery(() => getLiftSeries(), []);
  const prs = useLiveQuery(() => getRecentPrs(10), []);
  const strength = useLiveQuery(() => getStrength(), []);
  const [pick, setPick] = useState<string | null>(null);
  const now = Date.now();
  const [wStart, wEnd] = weekRange(now, settings.weekStart);
  const week = useLiveQuery(async () => {
    const done = await db.sessions
      .filter((s) => s.endedAt !== undefined && s.startedAt >= wStart && s.startedAt < wEnd)
      .count();
    const first = (await db.sessions.filter((s) => s.endedAt !== undefined).toArray()).sort(
      (a, b) => a.startedAt - b.startedAt,
    )[0];
    return {
      done,
      number: first
        ? weekNumber(defaultReviewTime(now, settings.weekStart), first.startedAt, settings.weekStart)
        : 1,
    };
  }, [wStart]);
  const current = lifts?.find((l) => l.exerciseId === pick) ?? lifts?.[0];
  const ex = current ? map?.get(current.exerciseId) : undefined;
  const units = profile?.units ?? 'kg';
  const chart = useMemo(
    () => (current ? weeklyBest(current.points, now, settings.weekStart) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, settings.weekStart],
  );
  if (!lifts || !map || !profile) return null;
  const s = en.strength;
  const change = relativeChange(chart.map((c) => ({ at: c.at, value: c.value })));
  const spanWeeks =
    chart.length >= 2 ? Math.round((chart[chart.length - 1]!.at - chart[0]!.at) / (7 * 86_400_000)) : 0;
  const latest = current?.points[current.points.length - 1];

  return (
    <>
      {!current || !ex ? (
        <div className="mt-3">
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
        <section className="ll-card mt-3 px-3.5 py-3" aria-label={p.e1rm}>
          <label className="relative inline-flex max-w-full items-center">
            <span className="sr-only">{p.pickLift}</span>
            <select
              className="h-11 max-w-full appearance-none truncate rounded-md border-[1.5px] border-line bg-panel pl-2.5 pr-8 text-[14px] font-bold text-ink"
              value={current.exerciseId}
              onChange={(e) => setPick(e.target.value)}
            >
              {lifts.map((l) => (
                <option key={l.exerciseId} value={l.exerciseId}>
                  {map.get(l.exerciseId)?.name ?? l.exerciseId}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-2.5" />
          </label>
          <p className="t-display mt-2.5 text-[40px] leading-none">
            {latest ? displayNumber(chart[chart.length - 1]?.value ?? latest.value, units) : '–'}
            <span className="text-[16px] normal-case"> {loadUnitLabel(ex.loadType, units)}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-ink2">
            {p.e1rm}
            {change !== null && spanWeeks > 0 && (
              <>
                {' · '}
                <b className="text-ink">{p.change(Math.round(change * 100), spanWeeks)}</b>
              </>
            )}
          </p>
          <div className="mt-2">
            <LineChart
              points={chart.map((c) => ({
                label: c.label,
                value: Math.round(toDisplay(c.value, units) * 10) / 10,
              }))}
              unit={loadUnitLabel(ex.loadType, units)}
              title={`${p.e1rm}, ${ex.name}`}
            />
          </div>
        </section>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Link to="/progress/review" className="ll-card block px-3 py-2.5 text-ink no-underline">
          <span className="t-label block">{p.thisWeek}</span>
          <span className="t-display mt-1.5 block text-[24px] uppercase leading-none">
            {p.weekDone(Math.min(week?.done ?? 0, profile.daysPerWeek), profile.daysPerWeek)}
          </span>
          <span className="mt-0.5 block text-[12px] text-ink2">{p.weekReview(week?.number ?? 1)}</span>
        </Link>
        <Link to="/progress/strength" className="ll-card block px-3 py-2.5 text-ink no-underline">
          <span className="t-label block">{p.strength}</span>
          {strength?.overall ? (
            <>
              <span className="t-display mt-1.5 block text-[24px] uppercase leading-none">
                {strength.overall.band < 0 ? s.below : s.bands[strength.overall.band]}
                {strength.overall.plus ? '+' : ''}
              </span>
              <span className="mt-0.5 block text-[12px] text-ink2">
                {strength.overall.next === null
                  ? p.strengthTop
                  : p.strengthNext(s.bands[strength.overall.next]!)}
              </span>
            </>
          ) : (
            <span className="mt-1.5 block text-[15px] font-semibold">{p.strengthSetup}</span>
          )}
        </Link>
      </div>

      <h2 className="t-label mt-4">{p.prs}</h2>
      {prs && prs.length === 0 ? (
        <div className="mt-2">
          <EmptyState>{p.noPrs}</EmptyState>
        </div>
      ) : (
        <ul className="ll-card mt-2 overflow-hidden">
          {prs?.map((pr) => {
            const e = map.get(pr.exerciseId);
            return (
              <li
                key={pr.id}
                className="flex min-h-11 items-center gap-2.5 border-b border-rule px-3 py-1.5 last:border-b-0"
              >
                <span className="t-display rounded-[3px] border-[1.5px] border-brass bg-brass-wash px-1.5 text-[15px] text-brass-text">
                  PR
                </span>
                <span className="min-w-0 grow truncate text-[14px] font-semibold">
                  {e?.name ?? pr.exerciseId}
                </span>
                <span className="t-mono shrink-0 text-[12px] font-semibold">
                  {e && hasLoad(e.loadType) && pr.loadKg > 0
                    ? `${displayNumber(pr.loadKg, units)} ${units} × `
                    : '× '}
                  {pr.reps}
                </span>
                <span className="t-mono w-12 shrink-0 text-right text-[11px] text-ink2">
                  {shortDate(pr.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Body() {
  const p = en.progress;
  const profile = useProfile();
  const weights = useBodyweights();
  const [open, setOpen] = useState(false);
  const review = useLiveQuery(() => getReview('week', Date.now()), []);
  if (!profile || !weights) return null;
  const units = profile.units;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  return (
    <>
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
      <section className="ll-card mt-3 px-3.5 py-3" aria-labelledby="bw-h">
        <div className="flex items-center justify-between gap-2">
          <h2 id="bw-h" className="t-label">
            {p.weighIns}
          </h2>
          <button type="button" className="ll-chip min-h-11" onClick={() => setOpen(true)}>
            {p.addWeighIn}
          </button>
        </div>
        {sorted.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink2">{p.noWeighIns}</p>
        ) : (
          <div className="mt-2">
            <LineChart
              points={sorted.slice(-16).map((w) => ({
                label: shortDate(new Date(w.date + 'T12:00:00').getTime()),
                value: Math.round(toDisplay(w.kg, units) * 10) / 10,
              }))}
              unit={units}
              title={p.weighIns}
              maxLabels={4}
            />
          </div>
        )}
      </section>
      {sorted.length > 0 && (
        <ul className="ll-card mt-3 overflow-hidden">
          {[...sorted]
            .reverse()
            .slice(0, 12)
            .map((w) => {
              const label = weekdayDate(new Date(w.date + 'T12:00:00').getTime());
              return (
                <li
                  key={w.id}
                  className="flex min-h-12 items-center gap-2 border-b border-rule pl-3.5 last:border-b-0"
                >
                  <span className="grow text-[15px]">{label}</span>
                  <span className="t-mono text-[14px] font-semibold">
                    {displayNumber(w.kg, units)} {units}
                  </span>
                  <button
                    type="button"
                    className="ll-icon-btn !border-0"
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
      <Link to="/progress/body-stats" className="ll-link mt-3 inline-block">
        {p.bodyStats}
      </Link>
      <WeighInSheet open={open} onClose={() => setOpen(false)} lastKg={last?.kg ?? null} units={units} />
    </>
  );
}

function History() {
  const p = en.progress;
  const sessions = useLiveQuery(
    async () =>
      (await db.sessions.filter((s) => s.endedAt !== undefined).toArray()).sort(
        (a, b) => b.startedAt - a.startedAt,
      ),
    [],
  );
  if (!sessions) return null;
  if (!sessions.length)
    return (
      <div className="mt-3">
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
    <ul className="ll-card mt-3 overflow-hidden">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link to={`/progress/session/${s.id}`} className="ll-row min-h-14 text-ink no-underline">
            <span className="grow">
              <span className="block text-[16px] font-bold">{s.name}</span>
              <span className="t-mono block text-[12px] text-ink2">{longDate(s.startedAt)}</span>
            </span>
            <Icon name="chevronRight" size={18} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

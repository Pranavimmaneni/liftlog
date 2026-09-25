import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '@/components/Icon';
import { EmptyState, toast } from '@/components/Toast';
import { muscleName } from '@/components/ExerciseRow';
import { en } from '@/copy/en';
import { monthName, shortDate } from '@/copy/format';
import { useExerciseMap } from '@/db/catalog';
import { defaultReviewTime, getReview, type Review, type ReviewKind } from '@/db/insight';
import { updateRoutineSessions, useActiveRoutine, useGym, useProfile } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { fixFor } from '@/engine/coverage';
import { presetGym } from '@/engine/suggest';
import { addDays } from '@/engine/week';
import { formatLoad, hasLoad } from '@/engine/units';
import type { Exercise, Units } from '@/engine/types';
import { SwapSheet } from '../S23-swap/SwapSheet';
import { RecompCard } from './RecompCard';

/** S10 weekly / monthly review (FR-REV-1/2/3). */
export default function ReviewScreen() {
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const profile = useProfile();
  const map = useExerciseMap();
  const kind: ReviewKind = params.get('kind') === 'month' ? 'month' : 'week';
  const t = Number(params.get('t')) || defaultReviewTime(Date.now(), settings.weekStart);
  const review = useLiveQuery(() => getReview(kind, t), [kind, t]);
  const [showAll, setShowAll] = useState(false);
  const r = en.review;
  const go = (k: ReviewKind, time: number) => setParams({ kind: k, t: String(time) }, { replace: true });
  const step = (dir: 1 | -1) => {
    if (kind === 'week') go('week', addDays(t, 7 * dir));
    else {
      const d = new Date(t);
      go('month', new Date(d.getFullYear(), d.getMonth() + dir, 1).getTime());
    }
  };

  if (!review || !profile || !map) return <main className="px-5 pt-4" />;
  const units = profile.units;
  const title = kind === 'week' ? r.title(review.weekNumber) : r.monthTitle(monthName(review.start));
  const a = shortDate(review.start);
  const b = shortDate(review.end - 1);
  const range =
    a.split(' ')[0] === b.split(' ')[0] ? `${a} – ${b.split(' ').slice(1).join(' ')}` : `${a} – ${b}`;
  const pct = review.goalSetsTotal ? Math.round((review.goalSetsMet / review.goalSetsTotal) * 100) : 0;
  const future = review.end > Date.now();
  // Weight changes first, then rep/set changes, then holds (the mockup shows the few that matter).
  const changes = [...review.changes].sort((x, y) => rank(x.change) - rank(y.change));
  const visible = showAll ? changes : changes.slice(0, 5);

  return (
    <main className="px-5 pb-6 pt-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="t-display min-w-0 text-[40px] leading-[0.95]">{title}</h1>
        <div
          role="group"
          aria-label={r.kind}
          className="mt-1 flex shrink-0 overflow-hidden rounded-lg border-[1.5px] border-line"
        >
          {(['week', 'month'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              className={`t-mono h-11 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${kind === k ? 'bg-ink text-card' : 'bg-card text-ink'}`}
              onClick={() => go(k, t)}
            >
              {k === 'week' ? r.weekly : r.monthly}
            </button>
          ))}
        </div>
      </div>
      <div className="-ml-2.5 mt-1 flex items-center">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center text-ink"
          aria-label={r.prev}
          onClick={() => step(-1)}
        >
          <Icon name="back" />
        </button>
        <p className="t-label">{range}</p>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center text-ink disabled:opacity-30"
          aria-label={r.next}
          disabled={future}
          onClick={() => step(1)}
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <Stat
          label={r.sessions}
          value={`${review.sessionsDone}/${review.sessionsPlanned}`}
          sub={
            review.sessionsDone >= review.sessionsPlanned
              ? r.onPlan
              : r.offPlan(review.sessionsPlanned - review.sessionsDone)
          }
        />
        <Stat label={r.goalSets} value={`${review.goalSetsMet}/${review.goalSetsTotal}`} sub={`${pct}%`} />
        <Stat
          label={r.newPrs}
          value={String(review.prs.length)}
          sub={review.bestPr ? r.best(shortName(map.get(review.bestPr.exerciseId))) : ''}
        />
      </div>

      {review.sessionsDone === 0 ? (
        <div className="mt-3">
          <EmptyState>{r.empty}</EmptyState>
        </div>
      ) : null}

      <div className="mt-3">
        <RecompCard
          recomp={review.recomp}
          bodyweight={review.bodyweight}
          strength={review.strength}
          units={units}
        />
      </div>

      <Insights review={review} map={map} />

      {kind === 'month' && review.muscleTrend.length > 0 && <MuscleTrend review={review} />}

      <section className="ll-card mt-3 px-3.5 py-3" aria-labelledby="next-h">
        <h2 id="next-h" className="t-label">
          {r.nextWeek}
        </h2>
        {review.changes.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink2">{r.noChanges}</p>
        ) : (
          <ul className="mt-1">
            {visible.map(({ exerciseId, change }) => {
              const ex = map.get(exerciseId);
              return (
                <li
                  key={exerciseId}
                  className="flex items-center gap-3 border-b border-rule py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 grow">
                    <span className="block text-[16px] font-bold leading-tight">
                      {ex?.name ?? exerciseId}
                    </span>
                    <span className="block text-[14px] text-ink2">{change.reason}</span>
                  </span>
                  <span
                    className={`t-mono shrink-0 text-[15px] font-semibold ${changed(change) ? 'text-accent' : 'text-ink2'}`}
                  >
                    {changeText(change, ex, units)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {changes.length > visible.length && (
          <button type="button" className="ll-link mt-1 min-h-11" onClick={() => setShowAll(true)}>
            {r.showAll(changes.length)}
          </button>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="ll-card min-w-0 px-3 py-2.5">
      <p className="t-label truncate">{label}</p>
      <p className="t-display mt-1 text-[28px] leading-none">{value}</p>
      <p className="t-mono mt-0.5 truncate text-[11px] text-ink2">{sub}</p>
    </div>
  );
}

const MODIFIERS = new Set([
  'seated',
  'standing',
  'lying',
  'machine',
  'cable',
  'single',
  'one',
  'arm',
  'leg',
  'barbell',
  'dumbbell',
  'smith',
  'ez',
  'bar',
  'close',
  'wide',
  'grip',
  'bent',
  'over',
  'chest',
  'supported',
]);

/** "best: incline" (S10 mockup): the first word of the name that isn't a modifier. */
function shortName(ex: Exercise | undefined): string {
  if (!ex) return '';
  const words = ex.name.toLowerCase().split(/[\s-]+/);
  return words.find((w) => !MODIFIERS.has(w)) ?? words[0]!;
}

type Change = Review['changes'][number]['change'];
function rank(c: Change): number {
  if (c.from.loadKg !== c.to.loadKg) return 0;
  if (c.from.repMax !== c.to.repMax || c.from.sets !== c.to.sets) return 1;
  return 2;
}
function changed(c: Change): boolean {
  return c.from.loadKg !== c.to.loadKg || c.from.repMax !== c.to.repMax || c.from.sets !== c.to.sets;
}
function changeText(c: Change, ex: Exercise | undefined, units: Units): string {
  const lt = ex?.loadType ?? 'barbell';
  if (hasLoad(lt) && c.from.loadKg !== c.to.loadKg && c.to.loadKg !== null) {
    return c.from.loadKg === null
      ? formatLoad(c.to.loadKg, lt, units)
      : `${formatLoad(c.from.loadKg, lt, units).replace(/ .*/, '')} → ${formatLoad(c.to.loadKg, lt, units)}`;
  }
  if (c.to.repMax !== c.from.repMax) return en.review.rep(c.to.repMax - c.from.repMax);
  if (c.to.sets !== c.from.sets) return en.review.sets(c.to.sets - c.from.sets);
  return hasLoad(lt) && c.to.loadKg !== null ? formatLoad(c.to.loadKg, lt, units) : `× ${c.to.repMax}`;
}

/** §6.7 "Going well" and "Needs work" with the one-tap fix. */
function Insights({ review, map }: { review: Review; map: Map<string, Exercise> }) {
  const r = en.review;
  const routine = useActiveRoutine();
  const gym = useGym();
  const profile = useProfile();
  const [swapOpen, setSwapOpen] = useState(false);
  const w = review.goingWell;
  const n = review.needsWork;
  const name = (id: string) => map.get(id)?.name ?? id;
  const well = !w
    ? r.wellNone
    : w.code === 'e1rm_up'
      ? r.wellE1rm(name(w.exerciseId), w.pct, w.weeks)
      : w.code === 'all_sessions'
        ? r.wellAll(w.done)
        : w.code === 'goal_rate'
          ? r.wellRate(w.pct)
          : r.wellPrs(w.count);
  const fix = useMemo(() => {
    if (n?.code !== 'muscle_low' || !routine || !profile) return null;
    const sessions = routine.sessions.map((s) =>
      [...s.items].sort((a, b) => a.order - b.order).map((i) => i.exerciseId),
    );
    return fixFor(n.muscle, sessions, {
      exercises: [...map.values()].filter((e) => !e.deleted),
      gym: gym ?? presetGym('full-gym'),
      profile,
    });
  }, [n, routine, profile, gym, map]);
  const work = !n
    ? r.workNone
    : n.code === 'muscle_low'
      ? r.workMuscle(muscleName(n.muscle), Math.round(n.sets * 2) / 2, n.target)
      : n.code === 'stalled'
        ? r.workStalled(name(n.exerciseId))
        : n.code === 'missed'
          ? r.workMissed(n.missed)
          : r.workHurts(name(n.exerciseId));
  const swapId = n && (n.code === 'stalled' || n.code === 'hurts') ? n.exerciseId : null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="ll-card flex items-center gap-2.5 px-3 py-2.5">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-ink text-card">
          <Icon name="chevronUp" size={16} strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="t-label">{r.goingWell}</p>
          <p className="text-[15px] leading-snug">{well}</p>
        </div>
      </div>
      <div
        className={`flex items-center gap-2.5 rounded-lg border-[1.5px] bg-card px-3 py-2.5 ${n ? 'border-accent' : 'border-line'}`}
      >
        <span
          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-bold ${n ? 'bg-accent text-on-accent' : 'bg-ink text-card'}`}
          aria-hidden="true"
        >
          !
        </span>
        <div className="min-w-0 grow">
          <p className={`t-label ${n ? '!text-accent' : ''}`}>{r.needsWork}</p>
          <p className="text-[15px] leading-snug">{work}</p>
        </div>
        {n?.code === 'muscle_low' && fix && routine && (
          <button
            type="button"
            className="ll-chip min-h-11 shrink-0"
            data-variant="outline-red"
            onClick={async () => {
              const target = routine.sessions[fix.sessionIndex]!;
              await updateRoutineSessions(
                routine.id,
                routine.sessions.map((s, i) =>
                  i === fix.sessionIndex
                    ? { ...s, items: [...s.items, { exerciseId: fix.exerciseId, order: s.items.length }] }
                    : s,
                ),
              );
              toast(en.routine.fixed(name(fix.exerciseId), target.name));
            }}
          >
            {r.fixAdd(name(fix.exerciseId))}
          </button>
        )}
        {swapId && routine && (
          <button
            type="button"
            className="ll-chip min-h-11 shrink-0"
            data-variant="outline-red"
            onClick={() => setSwapOpen(true)}
          >
            {r.fixSwap}
          </button>
        )}
        {n?.code === 'missed' && (
          <Link to="/settings/profile" className="ll-chip min-h-11 shrink-0" data-variant="outline-red">
            {r.fixDays}
          </Link>
        )}
      </div>
      {swapId && routine && (
        <SwapSheet
          open={swapOpen}
          current={map.get(swapId) ?? null}
          onClose={() => setSwapOpen(false)}
          onChoose={async (e) => {
            await updateRoutineSessions(
              routine.id,
              routine.sessions.map((s) => ({
                ...s,
                items: s.items.map((i) => (i.exerciseId === swapId ? { ...i, exerciseId: e.id } : i)),
              })),
            );
            setSwapOpen(false);
            toast(en.detail.swapped(name(swapId), e.name));
          }}
        />
      )}
    </div>
  );
}

/** FR-REV-2: per-muscle hard-sets trend for the month (a table, which is also its accessible form). */
function MuscleTrend({ review }: { review: Review }) {
  const r = en.review;
  const weeks = review.muscleTrend[0]!.weeks.length;
  return (
    <section className="ll-card mt-3 overflow-x-auto px-3.5 py-3" aria-labelledby="trend-h">
      <h2 id="trend-h" className="t-label">
        {r.muscles}
      </h2>
      <table className="mt-2 w-full text-[14px]">
        <thead>
          <tr>
            <th className="t-label py-1 text-left font-semibold" scope="col">
              <span className="sr-only">{r.muscles}</span>
            </th>
            {Array.from({ length: weeks }, (_, i) => (
              <th key={i} scope="col" className="t-label py-1 text-right">
                {r.weekCol(i + 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {review.muscleTrend.map((m) => (
            <tr key={m.muscle} className="border-t border-rule">
              <th scope="row" className="py-1.5 text-left font-semibold">
                {muscleName(m.muscle)}
              </th>
              {m.weeks.map((v, i) => (
                <td key={i} className={`t-mono py-1.5 text-right ${v < m.target * 0.6 ? 'text-accent' : ''}`}>
                  {Math.round(v * 2) / 2}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

import { useNavigate, useParams, Navigate } from 'react-router';
import { Button } from '@/components/Button';
import { en } from '@/copy/en';
import { formatInt, longDate } from '@/copy/format';
import { bonusPercent } from '@/engine/summary';
import { displayNumber, formatLoad, fromDisplay, hasLoad, toDisplay } from '@/engine/units';
import { useTicket } from './useTicket';

/** S09 session ticket (FR-SUM-1). XP, share and milestones join in M5. */
export default function Summary() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const t = useTicket(sessionId);
  if (t === null) return <Navigate to="/" replace />;
  if (!t) return null;
  const { model, totals } = t;
  const units = model.profile.units;
  const meter = model.meter;
  const pct = meter.total ? Math.round((meter.done / meter.total) * 100) : 0;
  const repMaxAvg = model.items.length
    ? model.items.reduce((n, i) => n + i.goal.repMax, 0) / model.items.length
    : 10;
  const bonusPct = bonusPercent(meter.bonusReps, meter.total, repMaxAvg);
  const tonnage = Math.round(toDisplay(totals.tonnageKg, units));
  const diff = t.prev ? Math.round(toDisplay(totals.tonnageKg - t.prev.totals.tonnageKg, units)) : null;
  const changed = t.next
    .filter((n) => ['up', 'less_assist', 'more_reps', 'widen', 'calibrated'].includes(n.goal.reason.code))
    .slice(0, 3);
  const nextItems = (changed.length ? changed : t.next.slice(0, 3)).map((n) => {
    const reps =
      n.goal.reason.code === 'widen' || n.goal.reason.code === 'more_reps' ? ` × ${n.goal.repMax}` : '';
    const load =
      hasLoad(n.exercise.loadType) && n.goal.loadKg !== null
        ? ` ${formatLoad(n.goal.loadKg, n.exercise.loadType, units)}`
        : '';
    return `${n.exercise.name}${load}${reps}`;
  });

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4">
      <div className="flex items-center justify-between">
        <p className="t-label !text-accent">{en.summary.complete}</p>
        <p className="t-label">{en.summary.min(totals.durationMin)}</p>
      </div>

      <article className="ll-card ll-card-hard relative mt-4" aria-label={`${model.session.name} ticket`}>
        <div className="relative px-5 pb-5 pt-5">
          <p className="t-label">{en.summary.ticket(String(t.number).padStart(3, '0'))}</p>
          <h1
            className="t-display mt-1 break-words pr-[104px]"
            style={{
              fontSize: model.session.name.length <= 7 ? 58 : model.session.name.length <= 10 ? 46 : 36,
            }}
          >
            {model.session.name}
          </h1>
          <p className="t-mono mt-2 text-[14px] font-semibold uppercase text-ink2">
            {longDate(model.session.startedAt)} · {en.summary.week(model.weekNumber)}
          </p>
          {/* Completion stamp (PRD §9 motifs). */}
          <div
            className="ll-stamp-anim absolute right-4 top-12 flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full border-2 border-accent text-accent shadow-[inset_0_0_0_3px_var(--ll-card),inset_0_0_0_4.5px_var(--ll-accent)]"
            style={{ transform: 'rotate(-12deg)' }}
            aria-label={`${en.summary.goalsMet} ${pct}%`}
          >
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.1em]">
              {en.summary.goalsMet}
            </span>
            <span className="t-display text-[30px] leading-none">{pct}%</span>
            {bonusPct > 0 && (
              <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.06em]">
                {en.summary.bonusPct(bonusPct)}
              </span>
            )}
          </div>
          <dl className="mt-5 flex gap-7">
            <div>
              <dt className="t-label">{en.summary.lifted}</dt>
              <dd className="mt-1 flex items-baseline">
                <span className="t-display text-[36px]">{formatInt(tonnage)}</span>
                <span className="t-display-800 ml-0.5 text-[16px] normal-case">{units}</span>
              </dd>
            </div>
            <div>
              <dt className="t-label">{en.summary.sets}</dt>
              <dd className="t-display mt-1 text-[36px]">{totals.workSets}</dd>
            </div>
            <div>
              <dt className="t-label">{en.summary.reps}</dt>
              <dd className="t-display mt-1 text-[36px]">{totals.reps}</dd>
            </div>
          </dl>
          {totals.tonnageExcluded && (
            <p className="mt-2 text-[12px] text-ink2">{en.summary.tonnageExcluded}</p>
          )}
        </div>
        {/* Ticket perforation */}
        <div className="relative" aria-hidden="true">
          <span className="absolute -left-[11px] -top-[11px] h-[22px] w-[22px] rounded-full border-[1.5px] border-line bg-paper" />
          <span className="absolute -right-[11px] -top-[11px] h-[22px] w-[22px] rounded-full border-[1.5px] border-line bg-paper" />
          <div className="mx-3 border-t-2 border-dashed border-ink" />
        </div>
        <dl className="px-5 pb-4 pt-1">
          <Row label={en.summary.goalSets} value={`${meter.done} / ${meter.total}`} />
          <Row label={en.summary.bonusReps} value={`+${meter.bonusReps}`} brass />
          {diff !== null && (
            <Row
              label={en.summary.vsLast(model.session.name)}
              value={`${diff >= 0 ? '+' : '−'}${formatInt(Math.abs(diff))} ${units}`}
            />
          )}
        </dl>
        {t.prs.map((p) => (
          <div
            key={p.id}
            className="mx-5 mb-4 flex items-center gap-4 rounded-md border-[1.5px] border-brass bg-brass-wash px-4 py-3"
          >
            <span
              className="t-display ll-stamp-anim text-[40px] text-brass-text"
              style={{ transform: 'rotate(-12deg)' }}
            >
              {en.summary.pr}
            </span>
            <div>
              <p className="text-[16px] font-bold">
                {p.exercise?.name} · {displayNumber(p.loadKg, units)} {units} × {p.reps}
              </p>
              <p className="t-mono text-[12px] text-ink2">
                {/* e1RMs are estimates: whole numbers, like the mockup ("35 kg / hand (was 32)"). */}
                {en.summary.prLine(
                  formatLoad(
                    fromDisplay(Math.round(toDisplay(p.e1rm, units)), units),
                    p.exercise?.loadType ?? 'barbell',
                    units,
                  ),
                  String(Math.round(toDisplay(p.prevE1rm, units))),
                )}
              </p>
            </div>
          </div>
        ))}
        {model.session.calibration && (
          <p className="mx-5 mb-4 text-[13px] text-ink2">{en.summary.calibration}</p>
        )}
      </article>

      {nextItems.length > 0 && (
        <p className="mt-4 rounded-md bg-panel px-4 py-3 text-[15px] leading-snug">
          <b>{en.summary.nextTitle(model.session.name)}</b> {nextItems.join(' · ')}
        </p>
      )}

      <div className="mt-auto flex gap-2.5 pt-6">
        <Button onClick={() => navigate('/', { replace: true })}>{en.summary.done}</Button>
      </div>
    </main>
  );
}

function Row({ label, value, brass = false }: { label: string; value: string; brass?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-rule py-3.5 last:border-b-0">
      <dt className="t-label !text-[13px]">{label}</dt>
      <dd className={`t-num text-[20px] ${brass ? 'text-brass-text' : ''}`}>{value}</dd>
    </div>
  );
}

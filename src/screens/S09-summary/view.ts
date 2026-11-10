import { en } from '@/copy/en';
import { formatInt, longDate } from '@/copy/format';
import { toast } from '@/components/Toast';
import type { Motivation } from '@/db/motivation';
import { bonusPercent } from '@/engine/summary';
import { displayNumber, formatLoad, hasLoad, toDisplay } from '@/engine/units';
import { levelInfo } from '@/engine/xp';
import { dateKey } from '@/engine/week';
import { platform } from '@/platform';
import { renderTicketPng } from '@/app/ticket-image';
import type { SetRow } from '@/db/types';
import type { LoadType, Units } from '@/engine/types';
import type { Ticket } from './useTicket';

/**
 * The numbers S09 shows on top of the ticket (FR-SUM-1/2, FR-XP-2/5) and the share action, shared
 * by the classic and Rising Sun layouts.
 */
export function summaryView(t: Ticket, motivation: Motivation | null | undefined) {
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
  const xp = motivation?.perSession.get(model.session.id) ?? null;
  const lvl = xp ? levelInfo(xp.cumulative) : null;
  const share = async () => {
    const blob = await renderTicketPng({
      number: en.summary.ticket(String(t.number).padStart(3, '0')).replace(/^LiftLog · /, ''),
      name: model.session.name,
      dateLine: `${longDate(model.session.startedAt)} · ${en.summary.week(model.weekNumber)}`,
      lifted: `${formatInt(tonnage)} ${units}`,
      sets: String(totals.workSets),
      reps: String(totals.reps),
      goalPct: pct,
      rows: [
        [en.summary.goalSets, `${meter.done} / ${meter.total}`],
        [en.summary.bonusReps, `+${meter.bonusReps}`],
      ],
      prs: t.prs.map(
        (p) => `${p.exercise?.name ?? ''} · ${displayNumber(p.loadKg, units)} ${units} × ${p.reps}`,
      ),
      xpLine: xp && lvl ? `${en.xp.levelTitle(lvl.level)} · ${en.summary.xp(xp.total)}` : null,
      labels: {
        lifted: en.summary.lifted,
        sets: en.summary.sets,
        reps: en.summary.reps,
        goalsMet: en.summary.goalsMet,
        brand: en.app.name,
      },
    });
    const r = await platform.share({
      name: `liftlog-${model.session.name.toLowerCase().replace(/\W+/g, '-')}-${dateKey(model.session.startedAt)}.png`,
      mime: 'image/png',
      data: blob,
      title: model.session.name,
    });
    if (r === 'downloaded') toast(en.summary.shareSaved);
  };
  const nextItems = (changed.length ? changed : t.next.slice(0, 3)).map((n) => {
    const reps =
      n.goal.reason.code === 'widen' || n.goal.reason.code === 'more_reps' ? ` × ${n.goal.repMax}` : '';
    const load =
      hasLoad(n.exercise.loadType) && n.goal.loadKg !== null
        ? ` ${formatLoad(n.goal.loadKg, n.exercise.loadType, units)}`
        : '';
    return `${n.exercise.name}${load}${reps}`;
  });

  return { units, meter, pct, bonusPct, tonnage, diff, xp, lvl, share, nextItems };
}

export type SummaryView = ReturnType<typeof summaryView>;

/**
 * One lift's sets on a line: "67.5 kg × 10, 9, 9", with a new group each time the load changes
 * ("60 kg × 10 · 62.5 kg × 8"). Bodyweight lifts read "BW × 8, 7, 6"; timed ones list the seconds.
 */
export function setsLine(sets: Pick<SetRow, 'loadKg' | 'reps'>[], loadType: LoadType, units: Units): string {
  const groups: { load: string; reps: number[] }[] = [];
  for (const s of sets) {
    const load = formatLoad(s.loadKg, loadType, units);
    const last = groups[groups.length - 1];
    if (last && last.load === load) last.reps.push(s.reps);
    else groups.push({ load, reps: [s.reps] });
  }
  return groups.map((g) => `${g.load ? `${g.load} × ` : ''}${g.reps.join(', ')}`).join(' · ');
}

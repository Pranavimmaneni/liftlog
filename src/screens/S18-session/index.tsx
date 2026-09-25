import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { formatInt, longDate } from '@/copy/format';
import type { SetRow } from '@/db/types';
import { deleteSession } from '@/db/workout';
import { formatLoad, hasLoad, toDisplay } from '@/engine/units';
import { EditSetSheet } from '../S07-logger/EditSetSheet';
import { useTicket } from '../S09-summary/useTicket';

/** S18 session detail: the ticket numbers plus every set, with edit / delete (FR-WRK-11, §4.1). */
export default function SessionDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const t = useTicket(sessionId);
  const [editing, setEditing] = useState<{ set: SetRow; itemIndex: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (t === null) return <Navigate to="/progress?tab=history" replace />;
  if (!t) return null;
  const { model, totals } = t;
  const units = model.profile.units;
  const d = en.sessionDetail;
  const setCount = model.items.reduce((n, i) => n + i.sets.length, 0);
  const item = editing ? model.items[editing.itemIndex] : undefined;

  return (
    <main className="pb-[calc(24px+env(safe-area-inset-bottom))]">
      <ScreenHeader
        title={model.session.name}
        subtitle={`${longDate(model.session.startedAt)} · ${en.summary.week(model.weekNumber)}`}
        backTo="/progress?tab=history"
      />
      <dl className="ll-card mx-5 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 px-3.5 py-3">
        <Stat label={en.summary.goalSets} value={`${model.meter.done} / ${model.meter.total}`} />
        <Stat label={en.summary.lifted} value={`${formatInt(toDisplay(totals.tonnageKg, units))} ${units}`} />
        <Stat label={en.summary.sets} value={String(totals.workSets)} />
        <Stat label={en.summary.reps} value={formatInt(totals.reps)} />
        <Stat label={d.duration} value={en.summary.min(totals.durationMin)} />
        <Stat label={en.summary.bonusReps} value={`+${model.meter.bonusReps}`} />
      </dl>

      {model.items
        .filter((i) => i.sets.length > 0)
        .map((i) => {
          const itemIndex = model.items.indexOf(i);
          const lt = i.exercise.loadType;
          return (
            <section
              key={i.exercise.id}
              className="ll-card mx-5 mt-3 overflow-hidden"
              aria-label={i.exercise.name}
            >
              <h2 className="border-b border-rule px-3.5 py-2.5 text-[16px] font-bold">{i.exercise.name}</h2>
              <ul>
                {i.sets.map((s) => {
                  const label = s.kind === 'warmup' ? d.warm : en.logger.set(s.idx);
                  const text = `${hasLoad(lt) ? `${formatLoad(s.loadKg, lt, units)} × ` : ''}${s.reps}`;
                  return (
                    <li key={s.id} className="border-b border-rule last:border-b-0">
                      <button
                        type="button"
                        className="flex min-h-12 w-full items-center gap-3 px-3.5 text-left"
                        aria-label={`${d.editSet(s.idx)}: ${text}`}
                        onClick={() => setEditing({ set: s, itemIndex })}
                      >
                        <span
                          className={`t-mono w-16 shrink-0 text-[12px] ${s.kind === 'warmup' ? 'text-ink2' : ''}`}
                        >
                          {label}
                        </span>
                        <span className="t-mono grow text-[15px] font-semibold">{text}</span>
                        {s.goalMet && (
                          <span className="t-mono text-[11px] font-semibold uppercase text-ink2">
                            {s.bonusReps > 0 ? `+${s.bonusReps}` : '✓'}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

      <div className="px-5 pt-5">
        <Button variant="ghost" className="!text-accent" onClick={() => setConfirm(true)}>
          {d.deleteSession}
        </Button>
      </div>

      {item && editing && (
        <EditSetSheet
          set={editing.set}
          exercise={item.exercise}
          target={item.goal}
          units={units}
          bodyweightKg={model.bodyweightKg}
          onClose={() => setEditing(null)}
        />
      )}

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={d.deleteSessionConfirm(model.session.name)}
        tone="danger"
        footer={
          <>
            <Button
              variant="destructive"
              onClick={async () => {
                await deleteSession(model.session.id);
                toast(d.deleted);
                navigate('/progress?tab=history', { replace: true });
              }}
            >
              {d.deleteSession}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {en.common.cancel}
            </Button>
          </>
        }
      >
        <p className="text-[15px]">{d.deleteSessionBody(setCount)}</p>
      </Sheet>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-rule pb-1.5">
      <dt className="t-label">{label}</dt>
      <dd className="t-mono text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

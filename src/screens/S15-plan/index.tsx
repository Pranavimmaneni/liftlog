import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/Toast';
import { DeloadBanner } from '@/components/DeloadBanner';
import { en } from '@/copy/en';
import { db } from '@/db/schema';
import { useExerciseMap } from '@/db/catalog';
import { useDeload } from '@/db/deload';
import { useSettings } from '@/db/settings';
import { setQueueOrder, skipQueueTo, upNextOf, useActiveRoutine, useProfile, useQueue } from '@/db/repo';
import { splitById } from '@/engine/split';
import { reorder, rotationOrder } from '@/engine/rotation';
import { weekRange } from '@/engine/week';

/**
 * S15 Plan tab: "Up next" queue with every session, drag/keyboard reorder, "Skip to", tap a name to
 * edit (S04), week strip, "Change split" and the deload banner (FR-RTN-2/4/5/6, FR-PRG-7).
 */
export default function Plan() {
  const routine = useActiveRoutine();
  const queue = useQueue();
  const profile = useProfile();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const deload = useDeload();
  const [drag, setDrag] = useState<{ from: number; dy: number } | null>(null);
  const startY = useRef(0);
  const rowH = useRef(110);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const [wStart, wEnd] = weekRange(Date.now(), settings.weekStart);
  const doneIds = useLiveQuery(
    async () =>
      (
        await db.sessions
          .filter((s) => s.endedAt !== undefined && s.startedAt >= wStart && s.startedAt < wEnd)
          .toArray()
      ).map((s) => s.routineSessionId),
    [wStart],
  );

  if (routine === undefined) return null;
  if (!routine) {
    return (
      <main className="px-5 pt-4">
        <h1 className="t-display text-[40px]">{en.plan.title}</h1>
        <div className="mt-4">
          <EmptyState
            action={
              <Link to="/plan/split" className="ll-link">
                {en.home.buildRoutine}
              </Link>
            }
          >
            {en.home.noRoutine}
          </EmptyState>
        </div>
      </main>
    );
  }
  const q = queue ?? { nextSessionIndex: 0 };
  const order = rotationOrder(routine, q);
  const next = upNextOf(routine, queue);
  const planned = profile?.daysPerWeek ?? order.length;
  const done = Math.min(doneIds?.length ?? 0, planned);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const r = reorder(routine, q, from, to);
    void setQueueOrder(r.order ?? order, r.nextSessionIndex);
  };
  const onKey = (i: number) => (e: KeyboardEvent) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
    if (to < 0 || to >= order.length) return;
    e.preventDefault();
    move(i, to);
    requestAnimationFrame(() => handles.current[to]?.focus());
  };
  const onDown = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    const row = e.currentTarget.closest('li');
    if (row) rowH.current = row.getBoundingClientRect().height + 10;
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ from: i, dy: 0 });
  };
  const onUp = () => {
    if (!drag) return;
    const to = Math.max(0, Math.min(order.length - 1, drag.from + Math.round(drag.dy / rowH.current)));
    move(drag.from, to);
    setDrag(null);
  };

  return (
    <main className="px-5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="t-display text-[40px]">{en.plan.title}</h1>
        <Chip variant="soft" className="!px-4 !py-2.5 !text-[13px]">
          {splitById(routine.splitId)?.name ?? ''}
        </Chip>
      </div>

      <section className="ll-card mt-4 px-3.5 py-3" aria-labelledby="plan-week">
        <div className="flex justify-between">
          <h2 id="plan-week" className="t-label">
            {en.home.thisWeek}
          </h2>
          <p className="t-label !text-ink">{en.home.weekDone(done, planned)}</p>
        </div>
        <div className="mt-2.5 flex gap-1.5" role="img" aria-label={en.plan.weekStrip(done, planned)}>
          {Array.from({ length: planned }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 grow rounded-[3px] ${i < done ? 'bg-ink' : 'border-[1.5px] border-dashed border-ink2'}`}
            />
          ))}
        </div>
      </section>

      <DeloadBanner deload={deload} />

      <h2 className="t-label mt-5">{en.plan.upNext}</h2>
      <p className="mt-1 text-[13px] text-ink2">{en.plan.reorderHint}</p>
      <ol className="mt-2 flex flex-col gap-2.5">
        {order.map((idx, pos) => {
          const s = routine.sessions[idx]!;
          const isNext = next?.sessionIndex === idx;
          const names = [...s.items]
            .sort((a, b) => a.order - b.order)
            .map((i) => exMap?.get(i.exerciseId)?.name ?? '');
          const dragging = drag?.from === pos;
          return (
            <li
              key={s.id}
              data-testid="plan-session"
              className={`relative flex gap-1 rounded-lg bg-card py-3 pl-1 pr-3.5 ${isNext ? 'border-2 border-ink shadow-hard' : 'border-[1.5px] border-line'} ${dragging ? 'z-10' : ''}`}
              style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
            >
              <button
                ref={(el) => {
                  handles.current[pos] = el;
                }}
                type="button"
                aria-label={en.routine.drag(s.name)}
                aria-describedby="plan-reorder-help"
                className="flex h-12 w-10 shrink-0 cursor-grab touch-none items-center justify-center text-ink2"
                onKeyDown={onKey(pos)}
                onPointerDown={onDown(pos)}
                onPointerMove={(e) => drag && setDrag({ ...drag, dy: e.clientY - startY.current })}
                onPointerUp={onUp}
                onPointerCancel={() => setDrag(null)}
              >
                <Icon name="drag" />
              </button>
              <div className="min-w-0 grow">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/plan/edit/${idx}`}
                    className="t-display min-h-11 text-[28px] text-ink no-underline"
                    aria-label={`${en.plan.edit} ${s.name}`}
                  >
                    {s.name}
                  </Link>
                  {isNext ? (
                    <Chip variant="red">{en.home.next}</Chip>
                  ) : (
                    <button
                      type="button"
                      className="ll-chip min-h-11"
                      onClick={() => void skipQueueTo(routine, pos)}
                    >
                      {en.plan.skipTo}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[14px] leading-snug text-ink2">
                  {names.join(' · ') || en.routine.empty}
                </p>
                {doneIds?.includes(s.id) && <p className="t-label mt-1">{en.plan.doneThisWeek}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <p id="plan-reorder-help" className="sr-only">
        {en.plan.reorderKeys}
      </p>
      <Link to="/plan/split" className="ll-btn mt-4 w-full" data-variant="secondary">
        {en.plan.changeSplit}
      </Link>
    </main>
  );
}

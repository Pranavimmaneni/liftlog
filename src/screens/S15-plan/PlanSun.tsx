import type { KeyboardEvent, PointerEvent } from 'react';
import { Link } from 'react-router';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { DeloadBanner } from '@/components/DeloadBanner';
import { SunTop } from '@/components/sun/SunTop';
import { en } from '@/copy/en';
import type { DeloadInfo } from '@/db/deload';
import type { RoutineSession } from '@/db/types';

export interface PlanRow {
  /** Index into the routine's sessions (the edit route). */
  idx: number;
  session: RoutineSession;
  isNext: boolean;
  doneThisWeek: boolean;
  lifts: number;
  sets: number;
}

/**
 * S15 Plan in the Rising Sun look (FR-DSN-10, HW1S15): the week as a glass card, the queue as one
 * glass list (drag handle, name and size, "Next" or "Skip to"), Library and Change split as pills.
 * State and reordering live in ./index.tsx; behaviour is the classic screen's (FR-RTN-2/4/5/6).
 */
export function PlanSun({
  splitName,
  done,
  planned,
  deload,
  rows,
  drag,
  handleRef,
  onKey,
  onDown,
  onMove,
  onUp,
  onCancel,
  onSkip,
}: {
  splitName: string;
  done: number;
  planned: number;
  deload: DeloadInfo | undefined;
  rows: PlanRow[];
  drag: { from: number; dy: number } | null;
  handleRef: (pos: number, el: HTMLButtonElement | null) => void;
  onKey: (pos: number) => (e: KeyboardEvent) => void;
  onDown: (pos: number) => (e: PointerEvent<HTMLButtonElement>) => void;
  onMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onUp: () => void;
  onCancel: () => void;
  onSkip: (pos: number) => void;
}) {
  const t = en.sun.plan;
  return (
    <main className="px-5 pt-5">
      <SunTop title={en.plan.title} right={<span className="text-right">{splitName}</span>} />

      <section className="sun-glass mt-3 rounded-[18px] px-[18px] py-4" aria-labelledby="plan-week">
        <div className="flex items-center justify-between gap-3">
          <h2 id="plan-week" className="text-[16px] font-bold">
            {en.home.thisWeek}
          </h2>
          <p className="text-[15px] text-ink2">{t.sessions(done, planned)}</p>
        </div>
        <div className="mt-2.5 flex gap-1.5" role="img" aria-label={en.plan.weekStrip(done, planned)}>
          {Array.from({ length: planned }, (_, i) => (
            <span key={i} className={`h-2 grow rounded-full ${i < done ? 'bg-accent' : 'bg-track'}`} />
          ))}
        </div>
      </section>

      <DeloadBanner deload={deload} />

      <section className="sun-glass mt-3 rounded-[14px]" aria-labelledby="plan-next">
        <div className="px-4 pb-2 pt-3">
          <h2 id="plan-next" className="text-[15px] font-bold">
            {en.plan.upNext}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink2">{en.plan.reorderHint}</p>
        </div>
        <ol>
          {rows.map((r, pos) => {
            const s = r.session;
            const dragging = drag?.from === pos;
            return (
              <li
                key={s.id}
                data-testid="plan-session"
                className={`relative flex min-h-[60px] items-center gap-1 border-t border-rule py-1.5 pl-1 pr-3 ${dragging ? 'sun-plan-dragging' : ''}`}
                style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
              >
                <button
                  ref={(el) => handleRef(pos, el)}
                  type="button"
                  aria-label={en.routine.drag(s.name)}
                  aria-describedby="plan-reorder-help"
                  className="flex h-12 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-ink2"
                  onKeyDown={onKey(pos)}
                  onPointerDown={onDown(pos)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onCancel}
                >
                  <Icon name="drag" />
                </button>
                <Link
                  to={`/plan/edit/${r.idx}`}
                  className="flex min-h-11 min-w-0 grow flex-col justify-center text-ink no-underline"
                  aria-label={`${en.plan.edit} ${s.name}`}
                >
                  <span className="break-words text-[16px] font-bold leading-tight">{s.name}</span>
                  <span className="mt-0.5 text-[13px] leading-snug text-ink2">
                    {r.lifts ? t.liftsSets(r.lifts, r.sets) : en.routine.empty}
                    {r.doneThisWeek ? ` · ${en.plan.doneThisWeek}` : ''}
                  </span>
                </Link>
                {r.isNext ? (
                  <Chip variant="red" className="shrink-0">
                    {en.home.next}
                  </Chip>
                ) : (
                  <button type="button" className="ll-chip min-h-11 shrink-0" onClick={() => onSkip(pos)}>
                    {en.plan.skipTo}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <p id="plan-reorder-help" className="sr-only">
        {en.plan.reorderKeys}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {/* FR-NAV-1: the Library lives here and in Settings instead of a tab. */}
        <Link to="/library" className="ll-btn" data-variant="secondary" aria-label={en.library.open}>
          {t.library}
        </Link>
        <Link to="/plan/split" className="ll-btn" data-variant="secondary">
          {en.plan.changeSplit}
        </Link>
      </div>
    </main>
  );
}

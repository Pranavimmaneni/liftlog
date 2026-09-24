import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { muscleName } from '@/components/ExerciseRow';
import { EmptyState, toast } from '@/components/Toast';
import type { GymLike } from '@/engine/suggest';
import { CoverageCard } from './Coverage';
import { en } from '@/copy/en';
import { uid } from '@/db/ids';
import type { RoutineSession } from '@/db/types';
import { prescribe } from '@/engine/prescription';
import type { Exercise, ProfileLike } from '@/engine/types';
import { ExercisePicker } from '../S13-library/ExercisePicker';
import { SwapSheet } from '../S23-swap/SwapSheet';

function move<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x!);
  return out;
}

/**
 * S04 routine builder (FR-RTN-2): add, remove, reorder (drag and keyboard) and swap exercises per
 * session, with the live coverage check (FR-RTN-3). Used at the end of onboarding and from the Plan tab.
 */
export function RoutineBuilder({
  splitName,
  sessions,
  onChange,
  exercises,
  profile,
  initialTab = 0,
  coverageCtx,
}: {
  splitName: string;
  sessions: RoutineSession[];
  onChange: (s: RoutineSession[]) => void;
  exercises: Map<string, Exercise>;
  profile: Pick<ProfileLike, 'experience' | 'goal' | 'nudge'>;
  initialTab?: number;
  /** FR-RTN-3: shows the coverage card when the gym and training days are known. */
  coverageCtx?: { gym: GymLike; daysPerWeek: number; limitations: string[] };
}) {
  const [tab, setTab] = useState(Math.min(initialTab, Math.max(0, sessions.length - 1)));
  const [adding, setAdding] = useState(false);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; dy: number } | null>(null);
  const startY = useRef(0);
  const rowH = useRef(102);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);

  const cur = sessions[tab];
  const allIds = useMemo(
    () => sessions.map((s) => [...s.items].sort((a, b) => a.order - b.order).map((i) => i.exerciseId)),
    [sessions],
  );
  const ids = cur ? [...cur.items].sort((a, b) => a.order - b.order).map((i) => i.exerciseId) : [];

  const setIds = (next: string[]) => {
    onChange(
      sessions.map((s, i) =>
        i === tab ? { ...s, items: next.map((exerciseId, order) => ({ exerciseId, order })) } : s,
      ),
    );
  };

  const onKey = (i: number) => (e: KeyboardEvent) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
    if (to < 0 || to >= ids.length) return;
    e.preventDefault();
    setIds(move(ids, i, to));
    requestAnimationFrame(() => handles.current[to]?.focus());
  };

  const onDown = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    const row = e.currentTarget.closest('li');
    if (row) rowH.current = row.getBoundingClientRect().height;
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, dy: 0 });
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag) setDrag({ ...drag, dy: e.clientY - startY.current });
  };
  const onUp = () => {
    if (!drag) return;
    const to = Math.max(0, Math.min(ids.length - 1, drag.from + Math.round(drag.dy / rowH.current)));
    if (to !== drag.from) setIds(move(ids, drag.from, to));
    setDrag(null);
  };
  const dropAt = drag
    ? Math.max(0, Math.min(ids.length - 1, drag.from + Math.round(drag.dy / rowH.current)))
    : -1;

  const swapEx = swapping !== null ? (exercises.get(ids[swapping]!) ?? null) : null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <h1 className="t-display whitespace-nowrap text-[38px]">{en.routine.title}</h1>
        <Chip variant="soft" className="!px-4 !py-2.5 !text-[13px]">
          {splitName}
        </Chip>
      </div>

      <div
        role="tablist"
        aria-label={en.routine.sessionTabs}
        className="flex gap-2 overflow-x-auto px-5 pt-4"
      >
        {sessions.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`min-h-12 min-w-[76px] grow whitespace-nowrap rounded-lg border-[1.5px] px-3 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] ${
              i === tab ? 'border-ink bg-ink text-card' : 'border-line bg-card text-ink'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div
        className="mx-5 mt-3 overflow-hidden rounded-lg border-[1.5px] border-line bg-card"
        role="tabpanel"
        aria-label={cur?.name}
      >
        {ids.length === 0 && (
          <div className="p-3">
            <EmptyState>{en.routine.empty}</EmptyState>
          </div>
        )}
        <ul>
          {ids.map((id, i) => {
            const ex = exercises.get(id);
            if (!ex) return null;
            const p = prescribe(profile, ex.role);
            const dragging = drag?.from === i;
            return (
              <li
                key={id}
                className={`relative flex items-center gap-3 border-b border-rule bg-card py-2 pl-2 pr-3 ${
                  dragging ? 'z-10 shadow-hard' : ''
                } ${dropAt === i && !dragging ? 'border-t-2 border-t-accent' : ''}`}
                style={dragging ? { transform: `translateY(${drag!.dy}px)` } : undefined}
              >
                <button
                  ref={(el) => {
                    handles.current[i] = el;
                  }}
                  type="button"
                  aria-label={`${en.routine.drag(ex.name)}. ${en.common.moveUp} / ${en.common.moveDown}`}
                  className="flex h-12 w-10 shrink-0 cursor-grab touch-none items-center justify-center text-ink2"
                  onKeyDown={onKey(i)}
                  onPointerDown={onDown(i)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={() => setDrag(null)}
                >
                  <Icon name="drag" />
                </button>
                <ExerciseThumb exercise={ex} className="h-10 w-[54px]" />
                <span className="min-w-0 grow">
                  <span className="block text-[15px] font-bold leading-tight">{ex.name}</span>
                  <span className="t-mono mt-0.5 block text-[11px] text-ink2">
                    {muscleName(ex.primary[0])} · {p.sets} × {p.repMin}–{p.repMax}
                  </span>
                </span>
                <button
                  type="button"
                  className="ll-icon-btn !border-0 !bg-transparent"
                  aria-label={en.routine.swap(ex.name)}
                  onClick={() => setSwapping(i)}
                >
                  <Icon name="swap" size={26} />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-16 w-full items-center justify-center gap-2 font-mono text-[14px] font-semibold uppercase tracking-[0.14em] text-accent"
        >
          + {en.routine.addExercise}
        </button>
      </div>

      {coverageCtx && (
        <CoverageCard
          sessions={allIds}
          exercises={exercises}
          profile={{ ...profile, ...coverageCtx }}
          gym={coverageCtx.gym}
          onFix={(si, exerciseId) => {
            onChange(
              sessions.map((s, i) =>
                i === si ? { ...s, items: [...s.items, { exerciseId, order: s.items.length }] } : s,
              ),
            );
            toast(en.routine.fixed(exercises.get(exerciseId)?.name ?? '', sessions[si]?.name ?? ''));
          }}
        />
      )}

      <ExercisePicker
        open={adding}
        title={cur ? en.library.pickFor(cur.name) : en.routine.addExercise}
        exclude={ids}
        onClose={() => setAdding(false)}
        onPick={(e) => {
          setAdding(false);
          setIds([...ids, e.id]);
        }}
      />
      <SwapSheet
        open={swapping !== null}
        current={swapEx}
        exclude={ids}
        onClose={() => setSwapping(null)}
        onChoose={(e) => {
          if (swapping !== null) setIds(ids.map((x, i) => (i === swapping ? e.id : x)));
          setSwapping(null);
        }}
        onRemove={() => {
          if (swapping !== null) setIds(ids.filter((_, i) => i !== swapping));
          setSwapping(null);
        }}
      />
    </>
  );
}

export function sessionsFromSuggestion(s: { name: string; exerciseIds: string[] }[]): RoutineSession[] {
  return s.map((x) => ({
    id: uid(),
    name: x.name,
    items: x.exerciseIds.map((exerciseId, order) => ({ exerciseId, order })),
  }));
}

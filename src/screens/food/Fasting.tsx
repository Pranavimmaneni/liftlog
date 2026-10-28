import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { SectionSwitch } from '@/components/SectionSwitch';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { db } from '@/db/schema';
import { editFast, endFast, startFast } from '@/db/fasting';
import { upNextOf, useActiveRoutine, useQueue } from '@/db/repo';
import { useSettings } from '@/db/settings';
import type { FastRow } from '@/db/types';
import { fastState, fastStreak, trainingInFast, weekStrip } from '@/engine/fasting';
import { NUTRITION } from '@/engine/food-data';
import { parseDateKey, startOfWeek } from '@/engine/week';
import { useUsualTrainingTime } from './hooks';
import { Choices, Cta, Label, TextLink } from './ui';

const f = en.food.fasting;
const R = 120;
const C = 2 * Math.PI * R;

export function clock(t: number): string {
  return new Date(t).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

/** "14:20" (hours:minutes elapsed). */
export function elapsedText(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** "1 h 40 m" / "35 m". */
export function leftText(ms: number): string {
  const m = Math.ceil(ms / 60_000);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} m` : `${m} m`;
}

/** 'YYYY-MM-DDTHH:mm' in local time, for datetime-local inputs. */
function localInput(t: number): string {
  const d = new Date(t);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * F07 Fasting (PRD-1.2 FR-FAST-1): start a fast from a preset, watch the ring, end it. Everything is
 * computed from timestamps (like the rest timer), so it stays right after the phone sleeps.
 */
export default function Fasting() {
  const fasts = useLiveQuery(() => db.fasts.orderBy('startedAt').toArray(), []);
  const settings = useSettings();
  const routine = useActiveRoutine();
  const queue = useQueue();
  const usual = useUsualTrainingTime();
  const [now, setNow] = useState(() => Date.now());
  const [plan, setPlan] = useState(String(NUTRITION.fasting.defaultHours));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const strip = useMemo(
    () => (fasts ? weekStrip(fasts, startOfWeek(now, settings.weekStart)) : []),
    [fasts, now, settings.weekStart],
  );
  if (!fasts) return null;

  const open = [...fasts].reverse().find((x) => x.endedAt === undefined);
  const last = open ?? fasts[fasts.length - 1];
  const streak = fastStreak(fasts, now);
  const state = open ? fastState(open, now) : null;
  const next = upNextOf(routine, queue)?.session.name ?? f.usual;
  const usualAt = usual === null ? null : new Date(new Date(now).setHours(0, usual, 0, 0)).getTime();
  const subParts = [
    f.plan(open?.planHours ?? Number(plan)),
    ...(open ? [f.since(clock(open.startedAt))] : []),
    ...(streak ? [f.inARow(streak)] : []),
  ];
  const today = new Date(now).toDateString();

  return (
    <main className="pb-[calc(96px+env(safe-area-inset-bottom))]">
      <header className="px-6 pt-5">
        <SectionSwitch current="food" />
        <h1 className="t-display mt-5 text-[34px] leading-none">{f.title}</h1>
        <p className="mt-2 text-[13px] text-ink2">{subParts.join(' · ')}</p>
      </header>

      <div className="px-6">
        {open && state ? (
          <>
            <div className="relative mx-auto mt-6 h-[240px] w-[240px]">
              <svg viewBox="0 0 272 272" width="240" height="240" aria-hidden="true">
                <circle cx="136" cy="136" r={R} fill="none" className="stroke-rule" strokeWidth="10" />
                <circle
                  cx="136"
                  cy="136"
                  r={R}
                  fill="none"
                  className="stroke-ink"
                  strokeWidth="10"
                  strokeDasharray={`${Math.min(1, state.progress) * C} ${C}`}
                  transform="rotate(-90 136 136)"
                />
              </svg>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center"
                role="meter"
                aria-label={f.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(state.progress * 100))}
              >
                <p className="t-display text-[72px] font-extrabold leading-none" data-testid="fast-elapsed">
                  {elapsedText(state.elapsedMs)}
                </p>
                <p className="mt-2 text-[13px] text-ink2">
                  {state.done ? f.done : f.left(leftText(state.remainingMs))}
                </p>
              </div>
            </div>
            <p className="mt-6 text-center text-[15px]">
              {f.eatFrom} <span className="font-mono">{clock(state.eatFrom)}</span>
            </p>
          </>
        ) : (
          <div className="mt-8">
            <p className="text-[15px] text-ink2">{f.none}</p>
            <Label className="mt-6">{f.pick}</Label>
            <div className="mt-3">
              <Choices
                label={f.pick}
                value={plan}
                onChange={setPlan}
                options={NUTRITION.fasting.presets.map((h) => [String(h), f.plan(h)])}
              />
            </div>
          </div>
        )}

        <Label className="mt-6">{f.thisWeek}</Label>
        <ul className="mt-4 grid grid-cols-7 gap-1.5 text-center" data-testid="fast-week">
          {strip.map((d) => {
            const date = parseDateKey(d.date);
            const isToday = date.toDateString() === today;
            return (
              <li
                key={d.date}
                aria-label={f.dayLabel(date.toLocaleDateString('en', { weekday: 'long' }), d.hours)}
              >
                <div
                  className={`h-2.5 rounded-[1px] ${d.hours !== null ? 'bg-ink' : isToday ? 'bg-accent' : 'bg-rule'}`}
                  aria-hidden="true"
                />
                <p
                  aria-hidden="true"
                  className={`mt-2 font-mono text-[11px] font-semibold uppercase ${isToday ? 'text-accent' : 'text-ink2'}`}
                >
                  {date.toLocaleDateString('en', { weekday: 'narrow' })}
                </p>
              </li>
            );
          })}
        </ul>

        {(open || last) && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink2">
              {open && usualAt !== null
                ? trainingInFast(open, usual, now)
                  ? f.inFast(next, clock(usualAt))
                  : f.inWindow(next, clock(usualAt))
                : ''}
            </span>
            <TextLink onClick={() => setEditing(true)}>{f.change}</TextLink>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(86px+env(safe-area-inset-bottom))] mx-auto max-w-[480px] px-6">
        {open ? (
          <Cta
            onClick={async () => {
              await endFast(open.id);
              toast(f.ended);
            }}
          >
            {f.end}
          </Cta>
        ) : (
          <Cta
            onClick={async () => {
              await startFast(Number(plan));
              setNow(Date.now());
              toast(f.started);
            }}
          >
            {f.start}
          </Cta>
        )}
      </div>

      {last && <EditSheet open={editing} onClose={() => setEditing(false)} fast={last} />}
    </main>
  );
}

function EditSheet({ open, onClose, fast }: { open: boolean; onClose: () => void; fast: FastRow }) {
  const [start, setStart] = useState(localInput(fast.startedAt));
  const [end, setEnd] = useState(fast.endedAt ? localInput(fast.endedAt) : '');
  const [plan, setPlan] = useState(String(fast.planHours));
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    setStart(localInput(fast.startedAt));
    setEnd(fast.endedAt ? localInput(fast.endedAt) : '');
    setPlan(String(fast.planHours));
    setError(false);
  }, [open, fast]);
  const presets = NUTRITION.fasting.presets.includes(fast.planHours)
    ? NUTRITION.fasting.presets
    : [...NUTRITION.fasting.presets, fast.planHours].sort((a, b) => a - b);
  const input = 'll-input mt-1 w-full';
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={f.editTitle}
      footer={
        <Button
          onClick={async () => {
            const ok = await editFast(fast.id, {
              startedAt: new Date(start).getTime(),
              ...(fast.endedAt !== undefined && end ? { endedAt: new Date(end).getTime() } : {}),
              planHours: Number(plan),
            });
            if (!ok) return setError(true);
            toast(f.saved);
            onClose();
          }}
        >
          {f.save}
        </Button>
      }
    >
      <label className="block text-[13px] text-ink2">
        {f.startedAt}
        <input
          type="datetime-local"
          className={input}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      {fast.endedAt !== undefined && (
        <label className="mt-4 block text-[13px] text-ink2">
          {f.endedAt}
          <input
            type="datetime-local"
            className={input}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      )}
      <Label className="mt-5">{f.planHours}</Label>
      <div className="mt-2">
        <Choices
          label={f.planHours}
          value={plan}
          onChange={setPlan}
          options={presets.map((h) => [String(h), f.plan(h)])}
        />
      </div>
      {error && (
        <p role="alert" className="mt-4 text-[14px] text-accent">
          {f.badTimes}
        </p>
      )}
    </Sheet>
  );
}

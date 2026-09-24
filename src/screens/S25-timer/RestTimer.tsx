import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';
import { useRest } from '@/app/rest-store';
import { useSettings } from '@/db/settings';
import { ADJUST_MS, formatClock, remainingMs } from '@/engine/timer';
import { platform } from '@/platform';

/** Re-renders every 250 ms while a timer runs; the value is always computed from timestamps (FR-TMR-2). */
export function useRemaining(): number | null {
  const timer = useRest((s) => s.timer);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer]);
  return timer ? remainingMs(timer, now) : null;
}

/** FR-TMR-4 / FR-PLT-3: at zero, alert once (sound + vibration where available); the chip stays red. */
export function RestWatcher() {
  const remaining = useRemaining();
  const alerted = useRest((s) => s.alerted);
  const markAlerted = useRest((s) => s.markAlerted);
  const { restAlert } = useSettings();
  useEffect(() => {
    if (remaining === 0 && !alerted) {
      markAlerted();
      if (restAlert) void platform.alert({ sound: true });
    }
  }, [remaining, alerted, markAlerted, restAlert]);
  return null;
}

/** S25 inline chip (S07/S08): tap to expand. Oxblood/brick at zero until dismissed or the next set. */
export function RestChip({ className = '' }: { className?: string }) {
  const remaining = useRemaining();
  const setExpanded = useRest((s) => s.setExpanded);
  if (remaining === null) return null;
  const done = remaining === 0;
  const clock = formatClock(remaining);
  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      aria-label={done ? en.timer.done : en.timer.restLabel(clock)}
      className={`flex h-14 shrink-0 items-center gap-2 rounded-lg border-[1.5px] px-3.5 ${
        done ? 'll-flash border-accent bg-accent text-on-accent' : 'border-line bg-card text-ink'
      } ${className}`}
    >
      <Icon name="timer" size={24} />
      <span className="t-display text-[28px] tabular-nums" aria-hidden="true">
        {clock}
      </span>
    </button>
  );
}

/** S25 expanded: large countdown, ±15 s and Skip (FR-TMR-3). */
export function RestSheet() {
  const remaining = useRemaining();
  const expanded = useRest((s) => s.expanded);
  const setExpanded = useRest((s) => s.setExpanded);
  const adjust = useRest((s) => s.adjust);
  const skip = useRest((s) => s.skip);
  const lockScreen = platform.capabilities().lockScreenAlerts;
  if (remaining === null) return null;
  const done = remaining === 0;
  return (
    <Sheet open={expanded} onClose={() => setExpanded(false)} title={en.timer.title}>
      <p
        className={`t-display text-center text-[112px] leading-none tabular-nums ${done ? 'll-flash text-accent' : ''}`}
        role="timer"
        aria-live="off"
      >
        {formatClock(remaining)}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <button
          type="button"
          className="ll-btn"
          data-variant="secondary"
          onClick={() => adjust(-ADJUST_MS)}
          aria-label={en.timer.minus}
        >
          −15 s
        </button>
        <button
          type="button"
          className="ll-btn"
          data-variant="secondary"
          onClick={() => adjust(ADJUST_MS)}
          aria-label={en.timer.plus}
        >
          +15 s
        </button>
        <button type="button" className="ll-btn" data-variant="primary" onClick={skip}>
          {en.common.skip}
        </button>
      </div>
      {!lockScreen && <p className="mt-4 text-[13px] text-ink2">{en.timer.lockNote}</p>}
    </Sheet>
  );
}

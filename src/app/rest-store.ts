import { create } from 'zustand';
import { adjust as adjustTimer, startTimer, type RestTimer } from '@/engine/timer';
import { platform } from '@/platform';
import { en } from '@/copy/en';

/**
 * Ephemeral rest-timer UI state (Zustand, PRD §11). FR-TMR-2: stored as timestamps and mirrored to
 * localStorage, so a reload or a killed app resumes the countdown correctly.
 */
interface Persisted {
  timer: RestTimer | null;
  sessionId: string | null;
  alerted: boolean;
}

interface RestState extends Persisted {
  expanded: boolean;
  start: (sessionId: string, seconds: number, now?: number) => void;
  adjust: (deltaMs: number, now?: number) => void;
  skip: () => void;
  markAlerted: () => void;
  setExpanded: (v: boolean) => void;
}

const KEY = 'll-rest';

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    /* ignore */
  }
  return { timer: null, sessionId: null, alerted: false };
}

function save(s: Persisted) {
  try {
    if (s.timer) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function schedule(t: RestTimer | null) {
  // FR-PLT-4: lock-screen alert in the APK only; the web adapter is a no-op.
  void platform.cancelRestEnd();
  if (t) void platform.scheduleRestEnd(t.startedAt + t.durationMs, en.timer.done);
}

export const useRest = create<RestState>((set, get) => ({
  ...load(),
  expanded: false,
  start(sessionId, seconds, now = Date.now()) {
    const timer = startTimer(now, seconds);
    set({ timer, sessionId, alerted: false });
    save({ timer, sessionId, alerted: false });
    schedule(timer);
  },
  adjust(deltaMs, now = Date.now()) {
    const t = get().timer;
    if (!t) return;
    const timer = adjustTimer(t, deltaMs, now);
    set({ timer, alerted: false });
    save({ timer, sessionId: get().sessionId, alerted: false });
    schedule(timer);
  },
  skip() {
    set({ timer: null, sessionId: null, alerted: false, expanded: false });
    save({ timer: null, sessionId: null, alerted: false });
    schedule(null);
  },
  markAlerted() {
    set({ alerted: true });
    save({ timer: get().timer, sessionId: get().sessionId, alerted: true });
  },
  setExpanded(v) {
    set({ expanded: v });
  },
}));

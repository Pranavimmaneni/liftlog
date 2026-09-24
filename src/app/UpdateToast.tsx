import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { isNative } from '@/platform';
import { en } from '@/copy/en';

type WB = import('workbox-window').Workbox;

/**
 * NFR-OFF-2: "New version: reload" toast. Never shown (and never reloads) while a session is open;
 * it appears once the workout is finished.
 */
export function UpdateToast() {
  const [wb, setWb] = useState<WB | null>(null);
  const [waiting, setWaiting] = useState(false);
  const activeSession = useLiveQuery(() => db.sessions.filter((s) => s.endedAt === undefined).count(), [], 0);

  useEffect(() => {
    if (!import.meta.env.PROD || isNative || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    void import('workbox-window').then(({ Workbox }) => {
      if (cancelled) return;
      const w = new Workbox('/sw.js');
      w.addEventListener('waiting', () => setWaiting(true));
      w.addEventListener('controlling', () => window.location.reload());
      void w.register();
      setWb(w);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!waiting || activeSession > 0) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[440px] items-center gap-3 px-4"
    >
      <div className="ll-card ll-card-hard flex w-full items-center gap-3 px-4 py-2">
        <span className="grow text-[15px] font-semibold">{en.update.ready}</span>
        <button
          type="button"
          className="ll-chip min-h-11"
          data-variant="red"
          onClick={() => wb?.messageSkipWaiting()}
        >
          {en.update.reload}
        </button>
      </div>
    </div>
  );
}

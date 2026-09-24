import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useActiveSessionId } from '@/app/session-model';
import { platform } from '@/platform';
import { RestSheet, RestWatcher } from '../S25-timer/RestTimer';

/**
 * Wraps /workout and /workout/:exerciseId: keeps the screen on while a session is open (FR-PLT-2),
 * runs the rest alert watcher (FR-TMR-4) and hosts the expanded timer (S25).
 */
export default function WorkoutLayout() {
  const activeId = useActiveSessionId();
  const [held, setHeld] = useState<boolean | null>(null);
  useEffect(() => {
    if (!activeId) return;
    void platform.keepAwake(true).then(setHeld);
    return () => {
      void platform.keepAwake(false);
    };
  }, [activeId]);
  if (activeId === undefined) return null;
  if (activeId === null) return <Navigate to="/" replace />;
  return (
    <div
      className="mx-auto flex min-h-dvh max-w-[480px] flex-col pt-safe"
      data-wakelock={held ? 'on' : 'off'}
    >
      <Outlet context={{ sessionId: activeId, wakeLock: held }} />
      <RestWatcher />
      <RestSheet />
    </div>
  );
}

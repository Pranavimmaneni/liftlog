import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { autoFinishStale } from '@/db/workout';
import { Toaster } from '@/components/Toast';
import { useThemeSync } from './theme';
import { UpdateToast } from './UpdateToast';

/** Routes that work before onboarding is finished. */
const OPEN_PATHS = ['/onboarding', '/dev', '/install', '/settings'];

/** FR-ONB-5: until onboarding is done, every screen resumes it where the user stopped. */
function OnboardingGate() {
  const { pathname } = useLocation();
  const step = useLiveQuery(
    async () => ((await db.meta.get('onboardingStep'))?.value as string | undefined) ?? 'about',
    [],
  );
  if (step === undefined) return null;
  if (step !== 'done' && !OPEN_PATHS.some((p) => pathname.startsWith(p))) {
    return <Navigate to={`/onboarding/${step}`} replace />;
  }
  if (step === 'done' && pathname.startsWith('/onboarding')) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Root: theme sync, onboarding gate, service-worker updates, toasts, idle auto-finish. */
export function App() {
  useThemeSync();
  useEffect(() => {
    // FR-WRK-12: a session idle for 3 h is finished when the app comes back.
    void autoFinishStale();
    const onVis = () => document.visibilityState === 'visible' && void autoFinishStale();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  return (
    <>
      <OnboardingGate />
      <UpdateToast />
      <Toaster />
    </>
  );
}

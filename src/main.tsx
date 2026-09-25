import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './styles/app.css';
import { createAppRouter } from './app/router';
import { OPEN_PATHS } from './app/App';
import { logError } from './db/errors';
import { db } from './db/schema';
import { isNative } from './platform';

window.addEventListener('error', (e) => void logError(e.error ?? e.message, location.pathname));
window.addEventListener('unhandledrejection', (e) => void logError(e.reason, location.pathname));

/**
 * First visit: go straight to onboarding instead of loading Home and then redirecting (one lazy
 * chunk instead of two before the first real paint; NFR-PERF-1). The in-app gate still guards later
 * navigations.
 */
async function start() {
  if (!isNative && !OPEN_PATHS.some((p) => location.pathname.startsWith(p))) {
    try {
      const step = (await db.meta.get('onboardingStep'))?.value as string | undefined;
      if (step !== 'done') history.replaceState(null, '', `/onboarding/${step ?? 'about'}`);
    } catch {
      // Storage unavailable: the gate and the storage banner take it from here.
    }
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={createAppRouter()} />
    </StrictMode>,
  );
}
void start();

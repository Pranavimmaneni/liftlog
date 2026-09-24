import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router';
import { isNative } from '@/platform';
import { App } from './App';
import { FullLayout, TabLayout } from './layouts';
import { RouteError } from './RouteError';

type Loader = () => Promise<{ default: React.ComponentType }>;
/** Lazy route with its own error boundary (NFR-REL-4, NFR-PERF-3). */
const page = (load: Loader): Pick<RouteObject, 'lazy' | 'errorElement'> => ({
  lazy: async () => ({ Component: (await load()).default }),
  errorElement: <RouteError />,
});

export const routes: RouteObject[] = [
  {
    element: <App />,
    errorElement: <RouteError />,
    children: [
      {
        element: <TabLayout />,
        errorElement: <RouteError />,
        children: [
          { index: true, ...page(() => import('@/screens/S05-home')) },
          { path: 'plan', ...page(() => import('@/screens/S15-plan')) },
          { path: 'library', ...page(() => import('@/screens/S13-library')) },
          { path: 'progress', ...page(() => import('@/screens/S12-progress')) },
        ],
      },
      {
        path: 'workout',
        ...page(() => import('@/screens/S06-workout/WorkoutLayout')),
        children: [
          { index: true, ...page(() => import('@/screens/S06-workout')) },
          { path: ':exerciseId', ...page(() => import('@/screens/S07-logger')) },
        ],
      },
      {
        element: <FullLayout />,
        errorElement: <RouteError />,
        children: [
          { path: 'onboarding', ...page(() => import('@/screens/onboarding')) },
          { path: 'onboarding/:step', ...page(() => import('@/screens/onboarding')) },
          { path: 'summary/:sessionId', ...page(() => import('@/screens/S09-summary')) },
          { path: 'plan/edit/:index', ...page(() => import('@/screens/S15-plan/EditRoutine')) },
          { path: 'plan/split', ...page(() => import('@/screens/S15-plan/ChangeSplit')) },
          { path: 'library/new', ...page(() => import('@/screens/S17-custom')) },
          { path: 'library/:exerciseId', ...page(() => import('@/screens/S16-exercise')) },
          { path: 'library/:exerciseId/edit', ...page(() => import('@/screens/S17-custom')) },
          { path: 'settings', ...page(() => import('@/screens/S14-settings')) },
          { path: 'settings/profile', ...page(() => import('@/screens/S14-settings/Profile')) },
          { path: 'settings/gym', ...page(() => import('@/screens/S14-settings/Gym')) },
          // /dev pages ship as lazy chunks so the phone checks can reach them (DECISIONS D33).
          { path: 'dev/components', ...page(() => import('@/screens/dev/DevComponents')) },
          { path: 'dev/fixture', ...page(() => import('@/screens/dev/DevFixture')) },
          { path: 'dev/poses', ...page(() => import('@/screens/dev/DevPoses')) },
          { path: '*', ...page(() => import('@/screens/NotFound')) },
        ],
      },
    ],
  },
];

/** The APK serves files from the bundle, so it uses hash routing; the PWA uses clean URLs. */
export const router = isNative ? createHashRouter(routes) : createBrowserRouter(routes);

import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router';
import { isNative } from '@/platform';
import { App } from './App';
import { FullLayout, TabLayout } from './layouts';
import { FoodTabLayout } from '@/screens/food/FoodLayout';
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
          { path: 'progress', ...page(() => import('@/screens/S12-progress')) },
          { path: 'progress/review', ...page(() => import('@/screens/S10-review')) },
          { path: 'progress/strength', ...page(() => import('@/screens/S11-strength')) },
        ],
      },
      {
        // PRD-1.2 FR-NAV-2: the Food section, with its own tab bar (Diary · Review · Fasting).
        element: <FoodTabLayout />,
        errorElement: <RouteError />,
        children: [
          { path: 'food', ...page(() => import('@/screens/food/Diary')) },
          { path: 'food/review', ...page(() => import('@/screens/food/Review')) },
          { path: 'food/fasting', ...page(() => import('@/screens/food/Fasting')) },
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
      { path: 'scan', ...page(() => import('@/screens/S22-scan')) },
      {
        element: <FullLayout />,
        errorElement: <RouteError />,
        children: [
          { path: 'onboarding', ...page(() => import('@/screens/onboarding')) },
          { path: 'onboarding/:step', ...page(() => import('@/screens/onboarding')) },
          { path: 'summary/:sessionId', ...page(() => import('@/screens/S09-summary')) },
          { path: 'plan/edit/:index', ...page(() => import('@/screens/S15-plan/EditRoutine')) },
          { path: 'plan/split', ...page(() => import('@/screens/S15-plan/ChangeSplit')) },
          { path: 'progress/session/:sessionId', ...page(() => import('@/screens/S18-session')) },
          { path: 'progress/body-stats', ...page(() => import('@/screens/S19-body-stats')) },
          { path: 'install', ...page(() => import('@/screens/S21-install')) },
          { path: 'scan/stickers', ...page(() => import('@/screens/S22-scan/Stickers')) },
          { path: 'm/:machineId', ...page(() => import('@/screens/S22-scan/MachineLink')) },
          // FR-NAV-1: the Library is a full screen reached from Plan and Settings, not a tab.
          { path: 'library', ...page(() => import('@/screens/S13-library')) },
          { path: 'library/new', ...page(() => import('@/screens/S17-custom')) },
          { path: 'library/:exerciseId', ...page(() => import('@/screens/S16-exercise')) },
          { path: 'library/:exerciseId/edit', ...page(() => import('@/screens/S17-custom')) },
          { path: 'food/add', ...page(() => import('@/screens/food/AddFood')) },
          { path: 'food/new', ...page(() => import('@/screens/food/NewFood')) },
          { path: 'food/scan', ...page(() => import('@/screens/food/Scan')) },
          { path: 'food/targets', ...page(() => import('@/screens/food/Targets')) },
          { path: 'food/meal/:date/:meal', ...page(() => import('@/screens/food/Meal')) },
          { path: 'settings', ...page(() => import('@/screens/S14-settings')) },
          { path: 'settings/profile', ...page(() => import('@/screens/S14-settings/Profile')) },
          { path: 'settings/gym', ...page(() => import('@/screens/S14-settings/Gym')) },
          // /dev pages ship as lazy chunks so the phone checks can reach them (DECISIONS D33).
          { path: 'dev/components', ...page(() => import('@/screens/dev/DevComponents')) },
          { path: 'dev/fixture', ...page(() => import('@/screens/dev/DevFixture')) },
          { path: 'dev/poses', ...page(() => import('@/screens/dev/DevPoses')) },
          { path: 'dev/food', ...page(() => import('@/screens/dev/DevFood')) },
          { path: '*', ...page(() => import('@/screens/NotFound')) },
        ],
      },
    ],
  },
];

/**
 * The APK serves files from the bundle, so it uses hash routing; the PWA uses clean URLs. Created on
 * demand so main.tsx can settle the first URL (onboarding redirect) before the first lazy route loads.
 */
export function createAppRouter() {
  return isNative ? createHashRouter(routes) : createBrowserRouter(routes);
}

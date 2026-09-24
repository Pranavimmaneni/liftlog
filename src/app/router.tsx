import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router';
import { isNative } from '@/platform';
import { App } from './App';
import { FullLayout, TabLayout } from './layouts';
import { RouteError } from './RouteError';

type Loader = () => Promise<{ default: React.ComponentType }>;
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
        children: [{ index: true, ...page(() => import('@/screens/S05-home')) }],
      },
      {
        element: <FullLayout />,
        errorElement: <RouteError />,
        children: [
          { path: 'settings/*', ...page(() => import('@/screens/S14-settings')) },
          // /dev pages ship as lazy chunks so the phone checks can reach them (DECISIONS D33).
          { path: 'dev/components', ...page(() => import('@/screens/dev/DevComponents')) },
          { path: '*', ...page(() => import('@/screens/NotFound')) },
        ],
      },
    ],
  },
];

/** The APK serves files from the bundle, so it uses hash routing; the PWA uses clean URLs. */
export const router = isNative ? createHashRouter(routes) : createBrowserRouter(routes);

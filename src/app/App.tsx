import { Outlet } from 'react-router';
import { useThemeSync } from './theme';
import { UpdateToast } from './UpdateToast';

/** Root: theme sync, service-worker updates, and the routed screen. */
export function App() {
  useThemeSync();
  return (
    <>
      <Outlet />
      <UpdateToast />
    </>
  );
}

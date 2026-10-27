import { Outlet } from 'react-router';
import { TabBar } from '@/components/TabBar';

/** Screens with the bottom tab bar (Today, Plan, Progress; FR-NAV-1). Centred column, max 480 px (§2.1). */
export function TabLayout() {
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-[480px] pb-[calc(96px+env(safe-area-inset-bottom))] pt-safe">
        <Outlet />
      </div>
      <TabBar />
    </>
  );
}

/** Full-screen flows (onboarding, workout, settings…). */
export function FullLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col pt-safe">
      <Outlet />
    </div>
  );
}

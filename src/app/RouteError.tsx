import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { en } from '@/copy/en';
import { CrashScreen } from './CrashScreen';

/** NFR-REL-4: errorElement for every route. 404s get a plain message; everything else the crash screen. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-4 px-5">
        <h1 className="t-display text-[34px]">{en.errors.notFound}</h1>
        <Link to="/" className="ll-link self-start">
          {en.errors.goHome}
        </Link>
      </main>
    );
  }
  return <CrashScreen error={error} />;
}

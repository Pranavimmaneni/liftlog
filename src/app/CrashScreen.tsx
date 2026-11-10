import { useEffect } from 'react';
import { Button } from '@/components/Button';
import { en } from '@/copy/en';
import { logError } from '@/db/errors';
import { useDesign } from './design';

/** S26 crash boundary: "Something broke. Your logged sets are saved." with Reload and Export. */
export function CrashScreen({ error }: { error: unknown }) {
  useEffect(() => {
    void logError(error, typeof location === 'undefined' ? undefined : location.pathname);
  }, [error]);
  const sun = useDesign() === 'sun';
  const actions = (
    <>
      <Button variant="primary" onClick={() => location.reload()}>
        {en.common.reload}
      </Button>
      <Button variant="secondary" onClick={() => void import('./share-backup').then((m) => m.shareBackup())}>
        {en.common.exportBackup}
      </Button>
    </>
  );
  // Rising Sun (FR-DSN-10, S26): the same message and actions on one glass card.
  if (sun)
    return (
      <main
        className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-5 py-10"
        role="alert"
      >
        <div className="sun-glass rounded-[18px] p-[18px]">
          <h1 className="sun-display break-words text-[24px] uppercase">{en.errors.crashTitle}</h1>
          <p className="mt-2.5 text-[15px] leading-snug text-ink2">{en.errors.crashBody}</p>
          <div className="mt-5 flex flex-col gap-3">{actions}</div>
        </div>
      </main>
    );
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-4 px-5 py-10"
      role="alert"
    >
      <h1 className="t-display text-[38px]">{en.errors.crashTitle}</h1>
      <p className="text-[15px] leading-snug text-ink2">{en.errors.crashBody}</p>
      <div className="mt-4 flex flex-col gap-3">{actions}</div>
    </main>
  );
}

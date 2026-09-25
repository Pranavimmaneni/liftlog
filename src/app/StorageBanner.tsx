import { useEffect, useState } from 'react';
import { en } from '@/copy/en';

/** IndexedDB / Dexie failures that mean "your data may not have been saved". */
const STORAGE_ERRORS = new Set([
  'QuotaExceededError',
  'DatabaseClosedError',
  'OpenFailedError',
  'UnknownError',
  'InvalidStateError',
  'DataCloneError',
]);

let listeners: ((on: boolean) => void)[] = [];

/** S26: call when a save fails; the banner stays until the page reloads. */
export function reportStorageError(): void {
  listeners.forEach((l) => l(true));
}

export function isStorageError(e: unknown): boolean {
  const err = e as { name?: string; inner?: { name?: string } } | null;
  return !!err && (STORAGE_ERRORS.has(err.name ?? '') || STORAGE_ERRORS.has(err.inner?.name ?? ''));
}

/** S26 storage-error banner with "Export backup" (PRD §4.1). */
export function StorageBanner() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const l = (v: boolean) => setOn(v);
    listeners.push(l);
    const onRejection = (e: PromiseRejectionEvent) => isStorageError(e.reason) && setOn(true);
    const onError = (e: ErrorEvent) => isStorageError(e.error) && setOn(true);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      listeners = listeners.filter((x) => x !== l);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);
  if (!on) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 mx-auto flex max-w-[480px] items-center gap-3 border-b-2 border-accent bg-card px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))]"
    >
      <p className="grow text-[14px] leading-snug">{en.storage.error}</p>
      <button
        type="button"
        className="ll-chip min-h-11 shrink-0"
        data-variant="outline-red"
        onClick={async () => (await import('./share-backup')).shareBackup()}
      >
        {en.storage.export}
      </button>
    </div>
  );
}

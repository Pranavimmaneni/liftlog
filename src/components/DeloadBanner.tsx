import { en } from '@/copy/en';
import type { DeloadInfo } from '@/db/deload';

/** FR-PRG-7: deload announced the week before (Home and Plan), and shown during the deload week. */
export function DeloadBanner({ deload }: { deload: DeloadInfo | undefined }) {
  if (!deload || (!deload.thisWeek && !deload.nextWeek)) return null;
  return (
    <p
      role="status"
      className="mt-3 rounded-md border-[1.5px] border-brass bg-brass-wash px-3.5 py-2.5 text-[14px]"
    >
      <b>{deload.thisWeek ? en.home.deloadNow : en.home.deloadNext}</b>{' '}
      {deload.reason === 'stalls' ? en.home.deloadStalls : en.home.deloadScheduled}
    </p>
  );
}

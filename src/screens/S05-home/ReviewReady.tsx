import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';
import { addDays, startOfWeek, weekNumber } from '@/engine/week';

/**
 * FR-REV-1: last week's review is announced on Home for the first two days of the new week (D62),
 * when last week had at least one session.
 */
export function ReviewReady({
  finished,
  weekStart,
  now,
}: {
  finished: { startedAt: number }[] | undefined;
  weekStart: number;
  now: number;
}) {
  if (!finished?.length) return null;
  const thisWeek = startOfWeek(now, weekStart);
  const lastWeek = addDays(thisWeek, -7);
  if (now - thisWeek >= 2 * 86_400_000) return null;
  if (!finished.some((s) => s.startedAt >= lastWeek && s.startedAt < thisWeek)) return null;
  const n = weekNumber(lastWeek, finished[0]!.startedAt, weekStart);
  return (
    <Link
      to="/progress/review"
      className="ll-card mt-3 flex min-h-12 items-center justify-between gap-2 px-3.5 py-2.5 text-ink no-underline"
    >
      <span className="text-[15px] font-bold">{en.review.ready(n)}</span>
      <Icon name="chevronRight" size={18} />
    </Link>
  );
}

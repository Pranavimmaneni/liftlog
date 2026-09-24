import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { EmptyState } from '@/components/Toast';
import { en } from '@/copy/en';
import { longDate } from '@/copy/format';
import { db } from '@/db/schema';

/** S12 Progress hub. M1: session history (→ ticket). Lifts, Body and PRs arrive in M4. */
export default function Progress() {
  const sessions = useLiveQuery(
    async () =>
      (await db.sessions.filter((s) => s.endedAt !== undefined).toArray()).sort(
        (a, b) => b.startedAt - a.startedAt,
      ),
    [],
  );
  return (
    <main className="px-5 pt-4">
      <h1 className="t-display text-[40px]">{en.progress.title}</h1>
      <h2 className="t-label mt-5">{en.progress.history}</h2>
      {sessions && sessions.length === 0 && (
        <div className="mt-2">
          <EmptyState
            action={
              <Link to="/" className="ll-link">
                {en.progress.startFirst}
              </Link>
            }
          >
            {en.progress.noSessions}
          </EmptyState>
        </div>
      )}
      <ul className="ll-card mt-2 overflow-hidden">
        {sessions?.map((s) => (
          <li key={s.id}>
            <Link to={`/summary/${s.id}`} className="ll-row min-h-14 text-ink no-underline">
              <span className="grow">
                <span className="block text-[16px] font-bold">{s.name}</span>
                <span className="t-mono block text-[12px] text-ink2">{longDate(s.startedAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

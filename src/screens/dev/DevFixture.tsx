import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { db } from '@/db/schema';
import { en } from '@/copy/en';

/**
 * /dev/fixture: replaces all data with a realistic 6-week demo (DECISIONS D33).
 * Needs the word LOAD typed, or ?auto=1 on an empty database (used by screenshot scripts).
 */
export default function DevFixture() {
  const [params] = useSearchParams();
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const hasProfile = useLiveQuery(async () => (await db.profile.count()) > 0, []);
  const auto = params.get('auto') === '1';
  const active = params.get('active') === '1';

  const run = async () => {
    setState('running');
    const { loadFixture } = await import('@/dev/fixture');
    await loadFixture({ active });
    setState('done');
  };

  useEffect(() => {
    if (auto && hasProfile === false && state === 'idle') void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, hasProfile]);

  return (
    <main className="pb-10" data-fixture-done={state === 'done' ? '' : undefined}>
      <ScreenHeader title={en.dev.fixture} subtitle="/dev/fixture" backTo="/" />
      <p className="px-5 pt-3 text-[15px]">{en.dev.fixtureBody}</p>
      <label className="block px-5 pt-3">
        <span className="t-label">{en.dev.fixtureType}</span>
        <input
          className="ll-input mt-1.5"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="px-5 pt-4">
        <Button variant="destructive" disabled={typed !== 'LOAD' || state === 'running'} onClick={run}>
          {state === 'running'
            ? en.common.loading
            : state === 'done'
              ? en.dev.fixtureDone
              : en.dev.fixtureButton}
        </Button>
      </div>
    </main>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Switch } from '@/components/Switch';
import { en } from '@/copy/en';
import { loadCatalog } from '@/db/catalog';
import { Pictogram } from '@/illustration/Pictogram';
import { poseIds } from '@/illustration/svg';
import { TIER1 } from '@/illustration/tier1';
import type { Exercise } from '@/engine/types';

/** 600+ live SVGs at once are slow on a phone (and in jsdom); the filter still searches all of them. */
const PAGE = 120;

/** /dev/poses: review gallery for every pictogram, Tier 1 and Tier 2 (FR-ILL-2, FR-ILL-6, DECISIONS D33, D96). */
export default function DevPoses() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [q, setQ] = useState('');
  const [animate, setAnimate] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    void loadCatalog().then(setExercises);
  }, []);
  const names = useMemo(() => new Map((exercises ?? []).map((e) => [e.poseId ?? e.id, e.name])), [exercises]);
  if (!exercises) return null;
  const ids = poseIds();
  const shown = ids.filter(
    (id) => !q || id.includes(q.toLowerCase()) || names.get(id)?.toLowerCase().includes(q.toLowerCase()),
  );
  const t1 = Object.keys(TIER1).length;
  return (
    <main className="pb-10">
      <ScreenHeader title={en.dev.poses} subtitle="/dev/poses" backTo="/" />
      <div className="flex items-center gap-3 px-5 pt-3">
        <input
          className="ll-input grow"
          type="search"
          aria-label={en.dev.posesFilter}
          placeholder={en.dev.posesFilter}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
        />
        <Switch checked={animate} onChange={setAnimate} label={en.dev.posesAnimate} />
      </div>
      <p className="t-label px-5 pt-2" data-testid="pose-count">
        {en.dev.posesCount(ids.length, t1)}
      </p>
      <ul className="grid grid-cols-2 gap-2.5 px-5 pt-3">
        {shown.slice(0, limit).map((id) => (
          <li
            key={id}
            className="overflow-hidden rounded-lg border-[1.5px] border-line bg-panel"
            data-pose={id}
          >
            <Pictogram poseId={id} animate={animate} label={names.get(id) ?? id} className="block w-full" />
            <p className="px-2 pb-2 text-[12px] leading-tight">
              {names.get(id) ?? id}
              {id in TIER1 && <span className="t-label ml-1">{en.dev.posesTier1}</span>}
            </p>
          </li>
        ))}
      </ul>
      {shown.length > limit && (
        <div className="px-5 pt-3">
          <button type="button" className="ll-link w-full" onClick={() => setLimit(limit + PAGE)}>
            {en.common.more}
          </button>
        </div>
      )}
    </main>
  );
}

import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { ExerciseRow } from '@/components/ExerciseRow';
import { ToggleChip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/Toast';
import { en } from '@/copy/en';
import type { Exercise } from '@/engine/types';
import { useLibrary } from './useLibrary';

const PAGE = 60;

/** Pick an exercise from the library (S04 add/replace, S06 "Add from list"). */
export function ExercisePicker({
  open,
  title,
  onClose,
  onPick,
  exclude = [],
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (e: Exercise) => void;
  exclude?: string[];
}) {
  const [query, setQuery] = useState('');
  const [inGym, setInGym] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const { results } = useLibrary({ query, inGym, muscle: null, equipment: null, level: null });
  const list = results.filter((r) => !exclude.includes(r.exercise.id));
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <label className="flex h-14 items-center gap-3 rounded-lg border-2 border-ink bg-card px-4">
        <Icon name="search" className="shrink-0 text-ink2" />
        <input
          type="search"
          className="h-full w-full bg-transparent text-[18px] outline-none"
          placeholder={en.library.search}
          aria-label={en.library.search}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
        />
      </label>
      <div className="mt-2.5 flex gap-2">
        <ToggleChip on={inGym} check onClick={() => setInGym(!inGym)}>
          {en.library.inMyGym}
        </ToggleChip>
      </div>
      <div className="ll-card mt-3 overflow-hidden" role="list">
        {list.slice(0, limit).map((r) => (
          <div role="listitem" key={r.exercise.id}>
            <ExerciseRow
              exercise={r.exercise}
              alias={r.alias}
              dimmed={!r.available}
              onClick={() => {
                onPick(r.exercise);
                setQuery('');
              }}
            />
          </div>
        ))}
        {!list.length && (
          <div className="p-3">
            <EmptyState>{en.library.none(query)}</EmptyState>
          </div>
        )}
      </div>
      {list.length > limit && (
        <button type="button" className="ll-link w-full" onClick={() => setLimit(limit + PAGE)}>
          {en.common.more}
        </button>
      )}
    </Sheet>
  );
}

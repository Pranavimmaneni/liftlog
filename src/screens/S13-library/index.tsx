import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Chip, ToggleChip } from '@/components/Chip';
import { ExerciseRow } from '@/components/ExerciseRow';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/Toast';
import { en } from '@/copy/en';
import { EQUIPMENT, MACHINES } from '@/engine/data';
import { EXPERIENCES, MUSCLE_GROUPS, type Experience, type MuscleGroup } from '@/engine/types';
import { useLibrary } from './useLibrary';

const PAGE = 50;

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | null;
  onChange: (v: T | null) => void;
  options: [T, string][];
}) {
  const on = value !== null;
  return (
    <label
      className={`relative inline-flex min-h-12 items-center gap-2 rounded-md border-[1.5px] px-3 font-mono text-[13px] font-semibold uppercase tracking-[0.1em] ${
        on ? 'border-ink bg-ink text-card' : 'border-line bg-card text-ink'
      }`}
    >
      <span>{on ? options.find(([v]) => v === value)?.[1] : label}</span>
      <Icon name="chevronDown" size={16} />
      <select
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as T | null)}
      >
        <option value="">{`${label}: ${en.library.any}`}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** S13 Library: search, filters, results (FR-LIB-3/4/5). Pictograms or muscle-map fallback (FR-ILL-3). */
export default function Library() {
  const [query, setQuery] = useState('');
  const [inGym, setInGym] = useState(true);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [level, setLevel] = useState<Experience | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const { results, outside, total, recentIds, loading } = useLibrary({
    query,
    inGym,
    muscle,
    equipment,
    level,
  });
  const recentCount = !query ? results.filter((r) => recentIds.includes(r.exercise.id)).length : 0;

  const rows: ReactNode[] = [];
  results.slice(0, limit).forEach((r, i) => {
    if (!query && recentCount && i === 0)
      rows.push(
        <li key="h-recent">
          <h3 className="t-label px-3 pb-1 pt-2.5">{en.library.recent}</h3>
        </li>,
      );
    if (!query && recentCount && i === recentCount)
      rows.push(
        <li key="h-all">
          <h3 className="t-label border-t-[1.5px] border-line px-3 pb-1 pt-2.5">{en.library.all}</h3>
        </li>,
      );
    rows.push(
      <li key={r.exercise.id}>
        <Link to={`/library/${r.exercise.id}`} className="block text-ink no-underline">
          <ExerciseRow
            exercise={r.exercise}
            alias={r.alias}
            dimmed={!r.available}
            thumbClass="h-[42px] w-[58px]"
          />
        </Link>
      </li>,
    );
  });

  return (
    <main className="px-5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="t-display text-[40px]">{en.library.title}</h1>
        <Chip variant="soft" className="!px-4 !py-2.5 !text-[13px]">
          {en.library.count(total)}
        </Chip>
      </div>
      <label className="mt-4 flex h-[60px] items-center gap-3 rounded-lg border-2 border-ink bg-card px-4">
        <Icon name="search" size={26} className="shrink-0 text-ink2" />
        <input
          type="search"
          className="h-full w-full bg-transparent text-[20px] outline-none"
          placeholder={en.library.search}
          aria-label={en.library.search}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
        />
      </label>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <ToggleChip on={inGym} check className="!min-h-12 !text-[13px]" onClick={() => setInGym(!inGym)}>
          {en.library.inMyGym}
        </ToggleChip>
        <FilterSelect
          label={en.library.muscle}
          value={muscle}
          onChange={setMuscle}
          options={MUSCLE_GROUPS.map((m) => [m, en.muscles[m]!])}
        />
        <FilterSelect
          label={en.library.equipment}
          value={equipment}
          onChange={setEquipment}
          options={[
            ...EQUIPMENT.map((e) => [e.id, e.name] as [string, string]),
            ...MACHINES.map((m) => [m.id, m.name] as [string, string]),
          ]}
        />
        <FilterSelect
          label={en.library.level}
          value={level}
          onChange={setLevel}
          options={EXPERIENCES.map((l) => [l, en.levels[l]!])}
        />
      </div>
      <p className="t-label mt-4" aria-live="polite">
        {loading ? en.common.loading : en.library.results(results.length)}
      </p>
      {!loading && results.length === 0 && outside.length === 0 ? (
        <div className="mt-2">
          <EmptyState
            action={
              <Link to="/library/new" className="ll-link">
                {en.library.create}
              </Link>
            }
          >
            {en.library.none(query)}
          </EmptyState>
        </div>
      ) : (
        rows.length > 0 && <ul className="ll-card mt-2 overflow-hidden">{rows}</ul>
      )}
      {results.length > limit && (
        <button type="button" className="ll-link w-full" onClick={() => setLimit(limit + PAGE)}>
          {en.common.more}
        </button>
      )}
      {outside.length > 0 && (
        <>
          <h2 className="t-label mt-4">{en.library.outsideGym}</h2>
          <ul className="ll-card mt-2 overflow-hidden" aria-label={en.library.outsideGym}>
            {outside.slice(0, PAGE).map((r) => (
              <li key={r.exercise.id}>
                <Link to={`/library/${r.exercise.id}`} className="block text-ink no-underline">
                  <ExerciseRow exercise={r.exercise} alias={r.alias} dimmed thumbClass="h-[42px] w-[58px]" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link to="/library/new" className="ll-btn mt-3 h-14 w-full" data-variant="ghost">
        <Icon name="plus" /> {en.library.create}
      </Link>
      <p className="mt-3 text-[14px] leading-snug text-ink2">{en.library.footer}</p>
    </main>
  );
}

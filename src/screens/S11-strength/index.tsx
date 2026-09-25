import { Link, Navigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/Toast';
import { en } from '@/copy/en';
import { useExerciseMap } from '@/db/catalog';
import { getStrength, type StrengthGroup } from '@/db/insight';
import { useProfile } from '@/db/repo';
import { STANDARDS } from '@/engine/data';
import { isGuidelineSource, isRepsBenchmark, type Eta } from '@/engine/strength';
import { displayNumber, loadUnitLabel } from '@/engine/units';
import type { Exercise, Units } from '@/engine/types';

/** S11 strength levels (FR-STR-1…3). S19 opens first when no body stats exist. */
export default function Strength() {
  const view = useLiveQuery(() => getStrength(), []);
  const profile = useProfile();
  const map = useExerciseMap();
  const s = en.strength;
  if (!view || !profile || !map) return <main className="px-5 pt-4" />;
  if (view.needsBodyStats) return <Navigate to="/progress/body-stats?next=/progress/strength" replace />;
  const units = profile.units;
  const age = view.birthYear ? new Date().getFullYear() - view.birthYear : null;
  const shown = view.groups.filter((g) => g.result || g.machineOnly);

  return (
    <main className="px-5 pb-6 pt-4">
      <h1 className="t-display text-[40px]">{s.title}</h1>
      <p className="mt-1.5 text-[15px] leading-snug text-ink2">{s.intro}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Chip variant="soft">{s.sex[view.sex]}</Chip>
        {age !== null && <Chip variant="soft">{s.age(age)}</Chip>}
        {view.bodyweightKg !== null && (
          <Chip variant="soft">
            {displayNumber(view.bodyweightKg, units)} {units}
          </Chip>
        )}
        {isGuidelineSource(STANDARDS.source) && <Chip variant="dashed">{s.guideline}</Chip>}
      </div>
      {view.sex === 'unspecified' && <p className="mt-2 text-[13px] text-ink2">{s.unspecifiedNote}</p>}

      {view.bodyweightKg === null ? (
        <div className="mt-3">
          <EmptyState
            action={
              <Link to="/progress/body-stats?next=/progress/strength" className="ll-link">
                {s.editStats}
              </Link>
            }
          >
            {s.noBodyweight}
          </EmptyState>
        </div>
      ) : shown.every((g) => !g.result) ? (
        <div className="mt-3">
          <EmptyState>{s.noLifts}</EmptyState>
        </div>
      ) : null}

      {shown.some((g) => g.result) && (
        <section className="ll-card mt-3 px-3.5">
          {shown
            .filter((g) => g.result)
            .map((g) => (
              <GroupRow key={g.id} group={g} ex={map.get(g.result!.exerciseId)} units={units} />
            ))}
        </section>
      )}

      {shown
        .filter((g) => g.machineOnly)
        .map((g) => (
          <div
            key={g.id}
            className="mt-3 flex items-center gap-4 rounded-lg border-[1.5px] border-dashed border-ink2 px-3.5 py-3"
          >
            <h2 className="t-display w-[88px] shrink-0 text-[24px]">{s.groups[g.id]}</h2>
            <p className="text-[14px] leading-snug">
              {STANDARDS.machineOnlyMessage} {s.unlock(map.get(g.unlockExerciseId)?.name.toLowerCase() ?? '')}
            </p>
          </div>
        ))}

      <p className="mt-3 text-[13px] text-ink2">{s.footer}</p>
      <Link to="/progress/body-stats?next=/progress/strength" className="ll-link mt-2 inline-block">
        {s.editStats}
      </Link>
    </main>
  );
}

function etaText(e: Eta): string {
  const s = en.strength;
  if (!e) return s.keepLogging;
  return 'weeks' in e ? s.weeks(e.weeks) : s.months(e.months);
}

function GroupRow({ group, ex, units }: { group: StrengthGroup; ex: Exercise | undefined; units: Units }) {
  const s = en.strength;
  const r = group.result!;
  const reps = isRepsBenchmark(r.key);
  const lt = ex?.loadType ?? 'barbell';
  const val = (v: number) =>
    reps ? s.bwReps(Math.round(v)) : `${displayNumber(v, units)} ${loadUnitLabel(lt, units)}`;
  const label = `${s.groups[group.id]}: ${r.level.reached < 0 ? s.below : s.bands[r.level.reached]}`;
  return (
    <div className="border-b border-rule py-3.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="t-display text-[28px]">{s.groups[group.id]}</h2>
        <p className="t-mono min-w-0 truncate text-[12px] text-ink2">
          {ex?.name} · {val(r.best)}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" role="img" aria-label={label}>
        {s.short.map((b, i) => (
          <div key={b} className="relative h-[9px] rounded-[2px] bg-panel">
            {i <= r.level.reached && <div className="absolute inset-0 rounded-[2px] bg-ink" />}
            {i === r.level.segment && r.level.next !== null && (
              <div
                className="absolute -top-[4px] h-[17px] w-[11px] -translate-x-1/2 rounded-[1px] bg-accent"
                style={{ left: `${Math.max(8, Math.min(92, r.level.position * 100))}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" aria-hidden="true">
        {s.short.map((b, i) => (
          <span
            key={b}
            className={`t-mono text-center text-[11px] font-semibold uppercase ${i <= r.level.reached ? 'text-ink' : 'text-ink2'}`}
          >
            {b}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[15px]">
        {r.level.next === null || r.nextValue === null ? (
          <b>{s.top}</b>
        ) : (
          <>
            <b>{s.next(s.bands[r.level.next]!, val(r.nextValue))}</b>
            <span className="text-ink2">{etaText(r.eta)}</span>
          </>
        )}
      </p>
    </div>
  );
}

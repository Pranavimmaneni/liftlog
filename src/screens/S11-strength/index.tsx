import { Link, Navigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useDesign } from '@/app/design';
import { MuscleMap } from '@/illustration/Pictogram';
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
  const c = en.sun.progress.strength;
  const sun = useDesign() === 'sun';
  if (!view || !profile || !map) return <main className="px-5 pt-4" />;
  if (view.needsBodyStats) return <Navigate to="/progress/body-stats?next=/progress/strength" replace />;
  const units = profile.units;
  const age = view.birthYear ? new Date().getFullYear() - view.birthYear : null;
  const shown = view.groups.filter((g) => g.result || g.machineOnly);

  if (sun) {
    const results = shown.filter((g) => g.result);
    const muscles = [...new Set(results.flatMap((g) => map.get(g.result!.exerciseId)?.primary ?? []))];
    const o = view.overall;
    const stats = '/progress/body-stats?next=/progress/strength';
    return (
      <main className="pb-6">
        <ScreenHeader title={s.title} backTo="/progress" />
        <div className="px-5 pt-4">
          <section className="sun-glass rounded-[18px] p-[18px]" aria-label={c.overall}>
            <p className="text-[15px] text-ink2">{c.overall}</p>
            <p className="sun-display mt-2 break-words text-[24px] uppercase">
              {o ? `${o.band < 0 ? s.below : s.bands[o.band]}${o.plus ? '+' : ''}` : c.notYet}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                {o && (
                  <p className="text-[15px] font-medium">
                    {o.next === null ? en.progress.strengthTop : en.progress.strengthNext(s.bands[o.next]!)}
                  </p>
                )}
                <p className="mt-1 text-[14px] leading-snug text-ink2">{s.intro}</p>
              </div>
              {muscles.length > 0 && (
                <MuscleMap
                  primary={muscles}
                  secondary={[]}
                  label={c.basedOn}
                  className="h-[92px] w-[114px] shrink-0"
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
          </section>

          {view.bodyweightKg === null ? (
            <div className="mt-3">
              <EmptyState
                action={
                  <Link to={stats} className="ll-link">
                    {s.editStats}
                  </Link>
                }
              >
                {s.noBodyweight}
              </EmptyState>
            </div>
          ) : results.length === 0 ? (
            <div className="mt-3">
              <EmptyState>{s.noLifts}</EmptyState>
            </div>
          ) : null}

          {results.length > 0 && (
            <section className="sun-glass mt-3 rounded-[14px] px-4">
              {results.map((g) => (
                <GroupRow key={g.id} group={g} ex={map.get(g.result!.exerciseId)} units={units} sun />
              ))}
            </section>
          )}

          {shown
            .filter((g) => g.machineOnly)
            .map((g) => (
              <div key={g.id} className="sun-glass mt-3 rounded-[14px] px-4 py-3.5">
                <h2 className="font-bold">{s.groups[g.id]}</h2>
                <p className="mt-1 text-[14px] leading-snug text-ink2">
                  {STANDARDS.machineOnlyMessage}{' '}
                  {s.unlock(map.get(g.unlockExerciseId)?.name.toLowerCase() ?? '')}
                </p>
              </div>
            ))}

          <div className="sun-glass mt-3 overflow-hidden rounded-[14px]">
            <p className="px-4 py-3 text-[14px] leading-snug text-ink2">{s.footer}</p>
            <Link to={stats} className="sun-list-row border-t border-rule !text-ink">
              <span className="font-medium">{s.editStats}</span>
              <Icon name="chevronRight" size={16} className="text-ink2" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

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

function GroupRow({
  group,
  ex,
  units,
  sun = false,
}: {
  group: StrengthGroup;
  ex: Exercise | undefined;
  units: Units;
  sun?: boolean;
}) {
  const s = en.strength;
  const r = group.result!;
  const reps = isRepsBenchmark(r.key);
  const lt = ex?.loadType ?? 'barbell';
  const val = (v: number) =>
    reps ? s.bwReps(Math.round(v)) : `${displayNumber(v, units)} ${loadUnitLabel(lt, units)}`;
  const label = `${s.groups[group.id]}: ${r.level.reached < 0 ? s.below : s.bands[r.level.reached]}`;
  if (sun) {
    // One bar across the five bands (mockup HW1S11): filled as far as the lift has come.
    const filled = r.level.next === null ? 1 : (r.level.segment + r.level.position) / s.bands.length;
    return (
      <div className="border-t border-rule py-3.5 first:border-t-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold">{s.groups[group.id]}</h2>
          <p className="text-[15px] text-ink2">{r.level.reached < 0 ? s.below : s.bands[r.level.reached]}</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-soft" role="img" aria-label={label}>
          <div className="h-full rounded-full bg-sage" style={{ width: `${Math.max(3, filled * 100)}%` }} />
        </div>
        <p className="mt-2 text-[13px] text-ink2">
          {en.sun.progress.strength.best(ex?.name ?? '', val(r.best))}
        </p>
        <p className="text-[14px]">
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

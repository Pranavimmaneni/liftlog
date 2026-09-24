import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { LineChart } from '@/components/Chart';
import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { EmptyState, toast } from '@/components/Toast';
import { muscleName } from '@/components/ExerciseRow';
import { MuscleMap, Pictogram } from '@/illustration/Pictogram';
import { poseDef } from '@/illustration/svg';
import { en } from '@/copy/en';
import { list, shortDate } from '@/copy/format';
import { db } from '@/db/schema';
import type { SessionRow } from '@/db/types';
import { useExerciseMap } from '@/db/catalog';
import { deleteCustomExercise } from '@/db/custom';
import { updateRoutineSessions, useActiveRoutine, useGym, useProfile } from '@/db/repo';
import { addToSession } from '@/db/workout';
import { useActiveSessionId } from '@/app/session-model';
import { setE1rm } from '@/engine/e1rm';
import { bodyweightOn } from '@/engine/load';
import { isAvailable, presetGym } from '@/engine/suggest';
import { displayNumber, formatLoad, hasLoad, toDisplay } from '@/engine/units';
import { dateKey } from '@/engine/week';

/** S16 exercise detail (from Library). */
export default function ExerciseDetail() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const map = useExerciseMap();
  const gym = useGym();
  const profile = useProfile();
  const routine = useActiveRoutine();
  const activeId = useActiveSessionId();
  const [addOpen, setAddOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState<null | number>(null);
  const [swapPick, setSwapPick] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const ex = map?.get(exerciseId);

  const history = useLiveQuery(async () => {
    const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
    const ids = [...new Set(sets.map((s) => s.sessionId))];
    const sessions = (await db.sessions.bulkGet(ids)).filter(
      (s): s is SessionRow => !!s && s.endedAt !== undefined,
    );
    const bws = await db.bodyweights.toArray();
    return { sets, sessions: sessions.sort((a, b) => a.startedAt - b.startedAt), bws };
  }, [exerciseId]);

  const stats = useMemo(() => {
    if (!history || !ex) return null;
    const bySession = history.sessions.map((s) => {
      const sets = history.sets
        .filter((x) => x.sessionId === s.id && x.kind !== 'warmup')
        .sort((a, b) => a.idx - b.idx || a.loggedAt - b.loggedAt);
      const bw = bodyweightOn(history.bws, dateKey(s.startedAt));
      const best = sets.reduce<{ e: number; s: (typeof sets)[number] } | null>((m, x) => {
        const e = setE1rm(x, ex.loadType, bw);
        return e !== null && (!m || e > m.e) ? { e, s: x } : m;
      }, null);
      return { session: s, sets, best };
    });
    const withBest = bySession.filter((b) => b.best);
    const top = withBest.reduce<(typeof withBest)[number] | null>(
      (m, b) => (!m || b.best!.e > m.best!.e ? b : m),
      null,
    );
    return {
      bySession,
      top,
      chart: withBest.map((b) => ({ label: shortDate(b.session.startedAt), value: b.best!.e })),
    };
  }, [history, ex]);

  if (map && !ex) return <Navigate to="/library" replace />;
  if (!ex || !profile) return null;
  const units = profile.units;
  const inGym = isAvailable(ex, gym ?? presetGym('full-gym'));
  const hasPose = !!poseDef(ex.poseId);
  const lt = ex.loadType;
  const d = en.detail;
  const sessions = routine?.sessions ?? [];

  return (
    <main className="pb-[calc(24px+env(safe-area-inset-bottom))]">
      <ScreenHeader
        title={ex.name}
        size={30}
        subtitle={[muscleName(ex.primary[0]), ex.equipment].join(' · ')}
        backTo="/library"
      />
      {ex.aliases.length > 0 && (
        <p className="px-5 pt-1 text-[13px] italic text-ink2">{en.library.also(ex.aliases.join(', '))}</p>
      )}

      <div className="mx-5 mt-3 overflow-hidden rounded-lg border-[1.5px] border-line bg-panel">
        {hasPose ? (
          <Pictogram poseId={ex.poseId!} animate label={ex.name} className="h-auto w-full" />
        ) : (
          <div className="flex flex-col items-center p-4">
            <MuscleMap primary={ex.primary} secondary={ex.secondary} className="h-[180px] w-full" />
            <span className="t-label mt-2">{ex.equipment}</span>
          </div>
        )}
      </div>

      <div className="mx-5 mt-3 flex items-center gap-3">
        {hasPose && (
          <MuscleMap primary={ex.primary} secondary={ex.secondary} className="h-[88px] w-[110px] shrink-0" />
        )}
        <div className="text-[14px] leading-snug">
          <p>
            <b>{d.main}</b> {list(ex.primary.map(muscleName))}
          </p>
          {ex.secondary.length > 0 && (
            <p className="mt-1">
              <b>{d.helps}</b> {list(ex.secondary.map(muscleName)).toLowerCase()}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <span>{ex.equipment}</span>
            <Chip variant={inGym ? 'soft' : 'outline-red'}>{inGym ? d.inGym : en.library.notInGym}</Chip>
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 px-5">
        <Button variant="ghost" className="h-14" onClick={() => setAddOpen(true)}>
          {d.add}
        </Button>
        <Button variant="ghost" className="h-14" onClick={() => setSwapOpen(-1)}>
          {d.swapInto}
        </Button>
      </div>
      {activeId && (
        <div className="px-5 pt-2.5">
          <Button
            variant="secondary"
            onClick={async () => {
              await addToSession(activeId, ex.id);
              navigate(`/workout/${ex.id}`);
            }}
          >
            {d.addToday}
          </Button>
        </div>
      )}

      <SectionLabel>{d.howTo}</SectionLabel>
      <ol className="list-decimal space-y-2 px-5 pl-10 text-[15px] leading-snug">
        {ex.instructions.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {ex.notes && <p className="mx-5 mt-2 rounded-md bg-panel px-3 py-2 text-[14px]">{ex.notes}</p>}

      <SectionLabel>{d.history}</SectionLabel>
      <div className="px-5">
        {!stats || stats.bySession.length === 0 ? (
          <EmptyState>{d.noHistory}</EmptyState>
        ) : (
          <>
            {stats.top && (
              <p className="ll-card mb-3 px-3.5 py-2.5 text-[15px]">
                <span className="t-label block">{d.best}</span>
                <b>
                  {hasLoad(lt) ? `${displayNumber(stats.top.best!.s.loadKg, units)} ${units} × ` : ''}
                  {stats.top.best!.s.reps}
                </b>{' '}
                · {d.e1rm(Math.round(toDisplay(stats.top.best!.e, units)), units)} ·{' '}
                {shortDate(stats.top.session.startedAt)}
              </p>
            )}
            <div className="ll-card px-3.5 py-3">
              <p className="t-label mb-2">{d.e1rmChart}</p>
              <LineChart
                points={stats.chart.map((p) => ({ ...p, value: toDisplay(p.value, units) }))}
                unit={units}
                title={d.e1rmChart}
              />
            </div>
            <ul className="ll-card mt-3">
              {[...stats.bySession]
                .reverse()
                .slice(0, 5)
                .map((b) => (
                  <li key={b.session.id}>
                    <Link to={`/progress/session/${b.session.id}`} className="ll-row text-ink no-underline">
                      <span className="grow">
                        <span className="block text-[15px] font-semibold">
                          {shortDate(b.session.startedAt)} · {b.session.name}
                        </span>
                        <span className="t-mono block text-[12px] text-ink2">
                          {hasLoad(lt) && b.sets[0] ? `${formatLoad(b.sets[0].loadKg, lt, units)} · ` : ''}
                          {b.sets.map((s) => s.reps).join('·')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>

      {ex.isCustom && !ex.deleted && (
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-5">
          <Link to={`/library/${ex.id}/edit`} className="ll-btn h-14" data-variant="ghost">
            {en.common.edit}
          </Link>
          <Button variant="ghost" className="h-14 !text-accent" onClick={() => setDelOpen(true)}>
            {en.common.delete}
          </Button>
        </div>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={d.add}>
        {sessions.length === 0 && <p className="text-[15px] text-ink2">{en.home.noRoutine}</p>}
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <Button
              key={s.id}
              variant="secondary"
              disabled={s.items.some((i) => i.exerciseId === ex.id)}
              onClick={async () => {
                await updateRoutineSessions(
                  routine!.id,
                  sessions.map((x) =>
                    x.id === s.id
                      ? { ...x, items: [...x.items, { exerciseId: ex.id, order: x.items.length }] }
                      : x,
                  ),
                );
                setAddOpen(false);
                toast(en.routine.fixed(ex.name, s.name));
              }}
            >
              {s.name}
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={swapOpen !== null}
        onClose={() => (setSwapOpen(null), setSwapPick(false))}
        title={d.swapInto}
      >
        {!swapPick ? (
          <div className="flex flex-col gap-2">
            {sessions.map((s, i) => (
              <Button key={s.id} variant="secondary" onClick={() => (setSwapOpen(i), setSwapPick(true))}>
                {s.name}
              </Button>
            ))}
          </div>
        ) : (
          <>
            <p className="t-label mb-2">{d.replaceWhich}</p>
            <div className="flex flex-col gap-2">
              {(sessions[swapOpen ?? 0]?.items ?? [])
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((it) => (
                  <Button
                    key={it.exerciseId}
                    variant="secondary"
                    disabled={it.exerciseId === ex.id}
                    onClick={async () => {
                      const target = sessions[swapOpen!]!;
                      await updateRoutineSessions(
                        routine!.id,
                        sessions.map((x) =>
                          x.id === target.id
                            ? {
                                ...x,
                                items: x.items.map((y) =>
                                  y.exerciseId === it.exerciseId ? { ...y, exerciseId: ex.id } : y,
                                ),
                              }
                            : x,
                        ),
                      );
                      setSwapOpen(null);
                      setSwapPick(false);
                      toast(d.swapped(map!.get(it.exerciseId)?.name ?? '', ex.name));
                    }}
                  >
                    {map?.get(it.exerciseId)?.name ?? it.exerciseId}
                  </Button>
                ))}
            </div>
          </>
        )}
      </Sheet>

      <Sheet
        open={delOpen}
        tone="danger"
        onClose={() => setDelOpen(false)}
        title={d.deleteTitle(ex.name)}
        footer={
          <Button
            variant="destructive"
            onClick={async () => {
              await deleteCustomExercise(ex.id);
              setDelOpen(false);
              navigate('/library', { replace: true });
            }}
          >
            {en.common.delete}
          </Button>
        }
      >
        <p className="text-[15px]">{d.deleteBody}</p>
      </Sheet>
    </main>
  );
}

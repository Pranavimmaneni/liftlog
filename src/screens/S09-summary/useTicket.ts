import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { useExerciseMap } from '@/db/catalog';
import { goalFromHistory, historyFor } from '@/db/workout';
import { buildSessionModel, loadSessionRaw, type SessionModel } from '@/app/session-model';
import type { PrRow, SessionRow } from '@/db/types';
import { bodyweightOn } from '@/engine/load';
import { sessionTotals, type SessionTotals } from '@/engine/summary';
import { dateKey } from '@/engine/week';
import type { Goal } from '@/engine/goal';
import type { Exercise } from '@/engine/types';

export interface Ticket {
  model: SessionModel;
  totals: SessionTotals;
  number: number;
  prs: (PrRow & { exercise?: Exercise })[];
  prev: { session: SessionRow; totals: SessionTotals } | null;
  next: { exercise: Exercise; goal: Goal }[];
}

/** FR-SUM-1: everything the ticket shows, derived from the log. */
export function useTicket(sessionId: string | undefined): Ticket | null | undefined {
  const exMap = useExerciseMap();
  const raw = useLiveQuery(async () => {
    if (!sessionId) return null;
    const base = await loadSessionRaw(sessionId);
    if (!base) return null;
    const s = base.session;
    const finished = (await db.sessions.filter((x) => x.endedAt !== undefined).toArray()).sort(
      (a, b) => a.startedAt - b.startedAt,
    );
    const number = finished.findIndex((x) => x.id === s.id) + 1 || finished.length + 1;
    const prev =
      [...finished]
        .reverse()
        .find((x) => x.routineSessionId === s.routineSessionId && x.startedAt < s.startedAt) ?? null;
    const prevSets = prev ? await db.sets.where('sessionId').equals(prev.id).toArray() : [];
    const setIds = base.sets.map((x) => x.id);
    const prs = setIds.length
      ? await db.prs
          .where('exerciseId')
          .anyOf([...new Set(base.sets.map((x) => x.exerciseId))])
          .toArray()
      : [];
    const after = await historyFor(
      s.plan.map((p) => p.exerciseId),
      undefined,
      Number.MAX_SAFE_INTEGER,
    );
    return { base, number, prev, prevSets, prs: prs.filter((p) => setIds.includes(p.setId)), after };
  }, [sessionId]);

  return useMemo(() => {
    if (raw === undefined || !exMap) return undefined;
    if (raw === null) return null;
    const model = buildSessionModel(raw.base, exMap);
    const s = raw.base.session;
    const bw = bodyweightOn(raw.base.bodyweights, dateKey(s.startedAt));
    const totals = sessionTotals(raw.base.sets, exMap, bw, s.startedAt, s.endedAt ?? Date.now());
    const prev = raw.prev
      ? {
          session: raw.prev,
          totals: sessionTotals(
            raw.prevSets,
            exMap,
            bodyweightOn(raw.base.bodyweights, dateKey(raw.prev.startedAt)),
            raw.prev.startedAt,
            raw.prev.endedAt ?? raw.prev.startedAt,
          ),
        }
      : null;
    const next = model.items
      .filter((i) => i.planned)
      .map((i) => ({ exercise: i.exercise, goal: goalFromHistory(i.exercise, raw.after, raw.base.profile) }));
    return {
      model,
      totals,
      number: raw.number,
      prs: raw.prs.map((p) => ({ ...p, exercise: exMap.get(p.exerciseId) })),
      prev,
      next,
    };
  }, [raw, exMap]);
}

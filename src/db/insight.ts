/**
 * M4 read models: weekly/monthly review (S10, FR-REV-1/2), recomp check (FR-REV-3), strength levels
 * (S11, FR-STR) and lift series for the progress hub (S12, FR-PRO-1). Everything is derived from the
 * log on demand; nothing here is stored.
 */
import { db } from './schema';
import { getExerciseMap } from './catalog';
import { getSettings } from './settings';
import { goalFromHistory, historyFor } from './workout';
import { buildSessionModel, type SessionRaw } from '@/app/session-model';
import type { BodyweightRow, GoalChangeRow, PrRow, ProfileRow, SessionRow, SetRow } from './types';
import { setE1rm } from '@/engine/e1rm';
import { bodyweightOn } from '@/engine/load';
import { weeklyTarget } from '@/engine/prescription';
import {
  goingWell,
  hardSetsByMuscle,
  needsWork,
  recompCheck,
  relativeChange,
  strengthIndex,
  type GoingWell,
  type NeedsWork,
  type RecompStatus,
} from '@/engine/review';
import {
  BENCHMARK_EXERCISES,
  benchmarkResult,
  GROUP_MUSCLES,
  isRepsBenchmark,
  overallLevel,
  pickGroupResult,
  STRENGTH_GROUPS,
  type BenchmarkResult,
  type Point,
  type Sex,
} from '@/engine/strength';
import { addDays, dateKey, DAY_MS, startOfWeek, weekNumber } from '@/engine/week';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '@/engine/types';

const WEEK = 7 * DAY_MS;

interface LogData {
  sessions: SessionRow[];
  sets: SetRow[];
  bodyweights: BodyweightRow[];
  map: Map<string, Exercise>;
  profile: ProfileRow;
}

async function loadLog(): Promise<LogData | null> {
  const profile = await db.profile.get('me');
  if (!profile) return null;
  const [sessions, sets, bodyweights, map] = await Promise.all([
    db.sessions.filter((s) => s.endedAt !== undefined).toArray(),
    db.sets.toArray(),
    db.bodyweights.toArray(),
    getExerciseMap(),
  ]);
  const done = new Set(sessions.map((s) => s.id));
  return {
    sessions: sessions.sort((a, b) => a.startedAt - b.startedAt),
    sets: sets.filter((s) => done.has(s.sessionId)),
    bodyweights: bodyweights.sort((a, b) => a.date.localeCompare(b.date)),
    map,
    profile,
  };
}

/** Per-session best e1RM (kg) per exercise; for rep benchmarks (pull-ups) the best reps. */
function seriesFor(log: LogData, exerciseId: string, reps = false): Point[] {
  const ex = log.map.get(exerciseId);
  if (!ex) return [];
  const byId = new Map(log.sessions.map((s) => [s.id, s]));
  const best = new Map<string, number>();
  for (const s of log.sets) {
    if (s.exerciseId !== exerciseId || s.kind === 'warmup' || s.hurts) continue;
    const at = byId.get(s.sessionId)!.startedAt;
    const v = reps ? s.reps : setE1rm(s, ex.loadType, bodyweightOn(log.bodyweights, dateKey(at)));
    if (v === null || v <= 0) continue;
    best.set(s.sessionId, Math.max(best.get(s.sessionId) ?? 0, v));
  }
  return [...best].map(([id, value]) => ({ at: byId.get(id)!.startedAt, value })).sort((a, b) => a.at - b.at);
}

// ---------- S12 Lifts ----------

export interface LiftSeries {
  exerciseId: string;
  points: Point[];
}

/** Exercises with at least one e1RM point, most recently trained first. */
export async function getLiftSeries(): Promise<LiftSeries[]> {
  const log = await loadLog();
  if (!log) return [];
  const ids = [...new Set(log.sets.map((s) => s.exerciseId))];
  return ids
    .map((id) => ({ exerciseId: id, points: seriesFor(log, id) }))
    .filter((l) => l.points.length > 0)
    .sort((a, b) => b.points[b.points.length - 1]!.at - a.points[a.points.length - 1]!.at);
}

/** Weekly best (label W1…Wn) over the last `weeks` weeks, for the S12 chart. */
export function weeklyBest(
  points: Point[],
  now: number,
  weekStart: number,
  weeks = 8,
): { label: string; value: number; at: number }[] {
  const start = addDays(startOfWeek(now, weekStart), -7 * (weeks - 1));
  const out: { label: string; value: number; at: number }[] = [];
  for (let w = 0; w < weeks; w++) {
    const a = addDays(start, 7 * w);
    const b = addDays(start, 7 * (w + 1));
    const vals = points.filter((p) => p.at >= a && p.at < b).map((p) => p.value);
    if (vals.length) out.push({ label: `W${w + 1}`, value: Math.max(...vals), at: a });
  }
  return out;
}

export async function getRecentPrs(limit = 10): Promise<PrRow[]> {
  return (await db.prs.toArray()).sort((a, b) => b.at - a.at).slice(0, limit);
}

// ---------- S11 strength levels ----------

export interface StrengthGroup {
  id: (typeof STRENGTH_GROUPS)[number]['id'];
  result: BenchmarkResult | null;
  /** Trained, but only with non-benchmark (machine) exercises (FR-STR-2). */
  machineOnly: boolean;
  /** Exercise that would unlock this group. */
  unlockExerciseId: string;
}

export interface StrengthView {
  sex: Sex;
  birthYear?: number;
  bodyweightKg: number | null;
  /** Neither sex nor birth year nor a weigh-in yet: S19 opens first (FR-STR-3). */
  needsBodyStats: boolean;
  groups: StrengthGroup[];
  overall: ReturnType<typeof overallLevel>;
}

export async function getStrength(now = Date.now()): Promise<StrengthView | null> {
  const log = await loadLog();
  if (!log) return null;
  const { profile } = log;
  const bw = log.bodyweights.length ? log.bodyweights[log.bodyweights.length - 1]!.kg : null;
  const sex: Sex = profile.sex ?? 'unspecified';
  const trained = new Set<MuscleGroup>();
  for (const s of log.sets) {
    const ex = log.map.get(s.exerciseId);
    if (ex && s.kind !== 'warmup') ex.primary.forEach((m) => trained.add(m));
  }
  const groups: StrengthGroup[] = STRENGTH_GROUPS.map((g) => {
    const results =
      bw === null
        ? []
        : g.benchmarks.flatMap((key) =>
            BENCHMARK_EXERCISES[key]!.map((id) =>
              benchmarkResult(
                { key, exerciseId: id, points: seriesFor(log, id, isRepsBenchmark(key)) },
                { sex, birthYear: profile.birthYear, bodyweightKg: bw },
                now,
              ),
            ).filter((r): r is BenchmarkResult => r !== null),
          );
    const result = pickGroupResult(results);
    const didTrain = GROUP_MUSCLES[g.id].some((m) => trained.has(m));
    return {
      id: g.id,
      result,
      machineOnly: !result && didTrain,
      unlockExerciseId: BENCHMARK_EXERCISES[g.benchmarks[0]!]![0]!,
    };
  });
  return {
    sex,
    birthYear: profile.birthYear,
    bodyweightKg: bw,
    needsBodyStats: profile.sex === undefined && profile.birthYear === undefined && bw === null,
    groups,
    overall: overallLevel(groups.map((g) => g.result).filter((r): r is BenchmarkResult => r !== null)),
  };
}

// ---------- S10 review ----------

export type ReviewKind = 'week' | 'month';

export interface NextChange {
  exerciseId: string;
  change: GoalChangeRow;
}

export interface Review {
  kind: ReviewKind;
  start: number;
  end: number;
  weekNumber: number;
  sessionsDone: number;
  sessionsPlanned: number;
  goalSetsMet: number;
  goalSetsTotal: number;
  prs: PrRow[];
  bestPr: PrRow | null;
  goingWell: GoingWell | null;
  needsWork: NeedsWork | null;
  recomp: RecompStatus;
  bodyweight: Point[];
  strength: Point[];
  changes: NextChange[];
  /** Monthly only: hard sets per muscle for each week of the month. */
  muscleTrend: { muscle: MuscleGroup; weeks: number[]; target: number }[];
}

/** Week containing `t`, or the calendar month containing `t`. */
export function periodOf(kind: ReviewKind, t: number, weekStart: number): [number, number] {
  if (kind === 'week') {
    const s = startOfWeek(t, weekStart);
    return [s, addDays(s, 7)];
  }
  const d = new Date(t);
  return [
    new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
  ];
}

/** FR-REV-1: the default week is the last completed one ("available from Monday for the previous week"). */
export function defaultReviewTime(now: number, weekStart: number): number {
  return addDays(startOfWeek(now, weekStart), -7);
}

export async function getReview(kind: ReviewKind, t: number, now = Date.now()): Promise<Review | null> {
  const log = await loadLog();
  if (!log) return null;
  const settings = await getSettings();
  const [start, end] = periodOf(kind, t, settings.weekStart);
  const { profile, map } = log;
  const inPeriod = log.sessions.filter((s) => s.startedAt >= start && s.startedAt < end);
  const ids = new Set(inPeriod.map((s) => s.id));
  const periodSets = log.sets.filter((s) => ids.has(s.sessionId));
  const weeks = (end - start) / WEEK;
  const sessionsPlanned = Math.round(profile.daysPerWeek * weeks);

  // Goal sets, counted exactly like the ticket (S09), from the log already in memory (one query
  // per table instead of several per session: this matters on slow IndexedDB, D58).
  let goalSetsMet = 0;
  let goalSetsTotal = 0;
  const goals = await db.goals.toArray();
  for (const s of inPeriod) {
    const ids = s.plan.map((p) => p.exerciseId);
    const idSet = new Set(ids);
    const before = log.sessions.filter((x) => x.id !== s.id && x.startedAt < s.startedAt);
    const beforeIds = new Set(before.map((x) => x.id));
    const raw: SessionRaw = {
      session: s,
      sets: log.sets.filter((x) => x.sessionId === s.id),
      history: {
        sets: log.sets.filter((x) => beforeIds.has(x.sessionId) && idSet.has(x.exerciseId)),
        sessions: new Map(before.map((x) => [x.id, { startedAt: x.startedAt, deload: x.deload }])),
      },
      goals: goals.filter((g) => idSet.has(g.exerciseId)),
      bodyweights: log.bodyweights,
      profile,
      settings,
      finishedBefore: before.length,
      anchor: start,
    };
    const m = buildSessionModel(raw, map).meter;
    goalSetsMet += m.done;
    goalSetsTotal += m.total;
  }

  const prs = (await db.prs.toArray()).filter((p) => p.at >= start && p.at < end);
  const bestPr =
    [...prs].sort((a, b) => b.e1rm / (b.prevE1rm || b.e1rm) - a.e1rm / (a.prevE1rm || a.e1rm))[0] ?? null;

  // e1RM change on benchmark lifts over the 4 weeks up to the period end.
  const benchmarkIds = [...new Set(Object.values(BENCHMARK_EXERCISES).flat())].filter(
    (id) => !id.includes('pull'),
  );
  const benchmarkChanges = benchmarkIds.flatMap((id) => {
    const pts = seriesFor(log, id).filter((p) => p.at >= end - 4 * WEEK && p.at < end);
    const change = relativeChange(pts);
    if (change === null) return [];
    const span = Math.max(1, Math.round((pts[pts.length - 1]!.at - pts[0]!.at) / WEEK));
    return [{ exerciseId: id, change, weeks: span }];
  });

  const target = weeklyTarget(profile)[0];
  const done = hardSetsByMuscle(periodSets, map);
  const routine = await db.routines.where('active').equals(1).first();
  const routineMuscles = new Set(
    (routine?.sessions ?? []).flatMap((s) => s.items.flatMap((i) => map.get(i.exerciseId)?.primary ?? [])),
  );
  const muscleSets = MUSCLE_GROUPS.filter((m) => routineMuscles.has(m) || done.get(m)! > 0).map((m) => ({
    muscle: m,
    sets: done.get(m)!,
    target: Math.round(target * weeks),
  }));

  const routineIds = [...new Set((routine?.sessions ?? []).flatMap((s) => s.items.map((i) => i.exerciseId)))];
  const hist = await historyFor(routineIds, undefined, end);
  const stalled = routineIds.filter((id) => {
    const ex = map.get(id);
    return ex ? goalFromHistory(ex, hist, profile).stalled : false;
  });
  const hurts = [...new Set(periodSets.filter((s) => s.hurts).map((s) => s.exerciseId))];

  const input = {
    sessionsDone: inPeriod.length,
    sessionsPlanned,
    goalSetsMet,
    goalSetsTotal,
    newPrs: prs.length,
    benchmarkChanges,
    muscleSets,
    stalled,
    hurts,
  };

  // Recomp: the 6 weeks up to the period end (or now, if sooner).
  const rEnd = Math.min(end, now);
  const rStart = rEnd - 6 * WEEK;
  const bodyweight = log.bodyweights
    .map((b) => ({ at: new Date(b.date + 'T00:00:00').getTime(), value: b.kg }))
    .filter((p) => p.at >= rStart && p.at < rEnd);
  const weekStarts = Array.from({ length: 6 }, (_, i) =>
    addDays(startOfWeek(rStart, settings.weekStart), 7 * i),
  );
  const liftIds = routineIds.length ? routineIds : [...new Set(log.sets.map((s) => s.exerciseId))];
  const per = new Map(
    liftIds.map((id) => [id, seriesFor(log, id).filter((p) => p.at >= rStart && p.at < rEnd)]),
  );
  const strength = strengthIndex(per, weekStarts);
  const recomp = recompCheck({
    goal: profile.goal,
    weighIns: bodyweight,
    strength,
    sessionsDone: log.sessions.filter((s) => s.startedAt >= rStart && s.startedAt < rEnd).length,
    sessionsPlanned: profile.daysPerWeek * 6,
  });

  // Next week's changes: the latest goal change per exercise recorded in the period.
  const changesRaw = (await db.goalChanges.toArray()).filter((c) => c.at >= start && c.at < end);
  const latest = new Map<string, GoalChangeRow>();
  for (const c of changesRaw.sort((a, b) => a.at - b.at)) latest.set(c.exerciseId, c);
  const changes = [...latest].map(([exerciseId, change]) => ({ exerciseId, change }));

  const muscleTrend =
    kind === 'month'
      ? muscleSets.map(({ muscle }) => ({
          muscle,
          target,
          weeks: Array.from({ length: Math.ceil(weeks) }, (_, w) => {
            const a = start + w * WEEK;
            const b = Math.min(end, a + WEEK);
            const wIds = new Set(
              inPeriod.filter((s) => s.startedAt >= a && s.startedAt < b).map((s) => s.id),
            );
            return hardSetsByMuscle(
              periodSets.filter((s) => wIds.has(s.sessionId)),
              map,
            ).get(muscle)!;
          }),
        }))
      : [];

  const anchor = log.sessions.find((s) => s.routineId === routine?.id)?.startedAt ?? start;
  return {
    kind,
    start,
    end,
    weekNumber: weekNumber(start, anchor, settings.weekStart),
    sessionsDone: inPeriod.length,
    sessionsPlanned,
    goalSetsMet,
    goalSetsTotal,
    prs,
    bestPr,
    goingWell: goingWell(input),
    needsWork: needsWork(input),
    recomp,
    bodyweight,
    strength,
    changes,
    muscleTrend,
  };
}

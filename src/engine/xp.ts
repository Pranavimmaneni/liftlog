/**
 * FR-XP-1…6: XP, levels, streaks, milestones and the weekly quest, all derived from the log
 * (never stored as running totals), with the values from xp.json. DECISIONS D4–D6, D65–D68.
 */
import { XP } from './data';
import type { MuscleGroup, SetKind } from './types';

const E = XP.events;

export interface XpSession {
  id: string;
  startedAt: number;
  /** Every exercise in it was a first exposure (D4). */
  calibration: boolean;
  /** Session tonnage in kg (milestones). */
  tonnageKg: number;
  /** A bodyweight pull-up/chin-up set with ≥ 1 rep (milestone "first_bw_pullup"). */
  bwPullup: boolean;
}

export interface XpSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  kind: SetKind;
  goalMet: boolean;
  bonusReps: number;
  hurts: boolean;
}

export type XpCode =
  | 'goalSet'
  | 'bonusRep'
  | 'extraSet'
  | 'pr'
  | 'sessionComplete'
  | 'firstSession'
  | 'weekComplete'
  | 'weeklyQuest';

export interface XpLine {
  code: XpCode;
  count: number;
  xp: number;
}

export type Milestone =
  | { id: 'tonnage'; thresholdKg: number; equivalent: { name: string; count: number } }
  | { id: 'sessions'; count: number }
  | { id: 'first_bw_pullup' };

export interface SessionXp {
  sessionId: string;
  lines: XpLine[];
  /** After the per-session cap. */
  total: number;
  /** Cumulative XP after this session. */
  cumulative: number;
  milestones: Milestone[];
}

export interface LedgerInput {
  sessions: XpSession[];
  sets: XpSet[];
  prSetIds: Set<string>;
  /** Sessions that completed their week's plan (weekComplete) and weekly quest (weeklyQuest). */
  weekCompleteSessionIds: Set<string>;
  questSessionIds: Set<string>;
}

/** Equivalent for a tonnage milestone: the biggest object you lifted at least once (D67). */
export function tonnageEquivalent(kg: number): { name: string; count: number } {
  const eq = XP.milestones.find((m) => m.id === 'tonnage')!.equivalents!;
  const fits = eq.filter(([, w]) => kg / w >= 1).sort((a, b) => b[1] - a[1]);
  const [name, w] = fits[0] ?? [...eq].sort((a, b) => a[1] - b[1])[0]!;
  return { name, count: Math.round((kg / w) * 10) / 10 };
}

/**
 * Per-session XP in time order. Per-set XP is withheld for an exercise's first exposure and for
 * "hurts" sets; warm-ups never count; one extra set per exercise earns extraSetBonus; bonus reps are
 * capped per exercise (D65); the session total is capped at sessionCap.
 */
export function xpLedger(i: LedgerInput): SessionXp[] {
  const sessions = [...i.sessions].sort((a, b) => a.startedAt - b.startedAt);
  const order = new Map(sessions.map((s, k) => [s.id, k]));
  const bySession = new Map<string, XpSet[]>();
  for (const s of i.sets) {
    if (!order.has(s.sessionId)) continue;
    (bySession.get(s.sessionId) ?? bySession.set(s.sessionId, []).get(s.sessionId)!).push(s);
  }
  const firstExposure = new Map<string, string>();
  for (const s of sessions) {
    for (const set of bySession.get(s.id) ?? []) {
      if (set.kind !== 'warmup' && !firstExposure.has(set.exerciseId))
        firstExposure.set(set.exerciseId, s.id);
    }
  }
  const tonnageMs = XP.milestones.find((m) => m.id === 'tonnage')!.thresholdsKg!;
  const sessionMs = XP.milestones.find((m) => m.id === 'sessions')!.thresholds!;
  let cumulative = 0;
  let tonnage = 0;
  let pulledUp = false;
  return sessions.map((s, k) => {
    const sets = bySession.get(s.id) ?? [];
    let goal = 0;
    let prs = 0;
    const bonus = new Map<string, number>();
    const extra = new Set<string>();
    for (const set of sets) {
      if (set.kind === 'warmup' || set.hurts) continue;
      if (firstExposure.get(set.exerciseId) === s.id) continue;
      if (set.kind === 'extra') {
        extra.add(set.exerciseId);
        continue;
      }
      if (set.goalMet) goal++;
      bonus.set(set.exerciseId, (bonus.get(set.exerciseId) ?? 0) + set.bonusReps);
      if (i.prSetIds.has(set.id)) prs++;
    }
    const bonusReps = [...bonus.values()].reduce((a, b) => a + Math.min(b, E.bonusRepCapPerExercise), 0);
    const lines: XpLine[] = [];
    const add = (code: XpCode, count: number, each: number) => {
      if (count > 0) lines.push({ code, count, xp: count * each });
    };
    add('goalSet', goal, E.goalSet);
    add('bonusRep', bonusReps, E.bonusRep);
    add('extraSet', extra.size, E.extraSetBonus);
    add('pr', prs, E.pr);
    if (!s.calibration) add('sessionComplete', 1, E.sessionComplete);
    if (k === 0) add('firstSession', 1, E.firstSession);
    if (i.weekCompleteSessionIds.has(s.id)) add('weekComplete', 1, E.weekComplete);
    if (i.questSessionIds.has(s.id)) add('weeklyQuest', 1, E.weeklyQuest);
    const total = Math.min(
      XP.sessionCap,
      lines.reduce((a, l) => a + l.xp, 0),
    );
    cumulative += total;

    const milestones: Milestone[] = [];
    const before = tonnage;
    tonnage += s.tonnageKg;
    const crossed = tonnageMs.filter((t) => before < t && tonnage >= t);
    if (crossed.length) {
      const t = crossed[crossed.length - 1]!;
      milestones.push({ id: 'tonnage', thresholdKg: t, equivalent: tonnageEquivalent(t) });
    }
    if (sessionMs.includes(k + 1)) milestones.push({ id: 'sessions', count: k + 1 });
    if (s.bwPullup && !pulledUp) {
      pulledUp = true;
      milestones.push({ id: 'first_bw_pullup' });
    }
    return { sessionId: s.id, lines, total, cumulative, milestones };
  });
}

// ---------- levels (FR-XP-2, D5) ----------

/** xp.json: xpForLevel(n) = round(250 · n^1.35); level L+1 is reached at xpForLevel(L) total XP. */
export function xpForLevel(n: number): number {
  return Math.round(250 * n ** 1.35);
}

export interface LevelInfo {
  level: number;
  title: string;
  /** XP needed for this level and the next (cumulative). */
  floor: number;
  next: number;
  /** 0…1 through the current level. */
  progress: number;
}

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  while (totalXp >= xpForLevel(level)) level++;
  const floor = level === 1 ? 0 : xpForLevel(level - 1);
  const next = xpForLevel(level);
  const title = [...XP.levels.titles].reverse().find(([l]) => level >= l)![1];
  return { level, title, floor, next, progress: (totalXp - floor) / (next - floor) };
}

// ---------- streak (FR-XP-4, D6) ----------

export interface StreakWeek {
  start: number;
  /** Completed (non-calibration) sessions ≥ planned. */
  complete: boolean;
  /** The week hasn't ended yet. */
  current: boolean;
}

export interface Streak {
  weeks: number;
  passBanked: boolean;
  /** Week starts where the rest-week pass was used. */
  passUsed: number[];
}

/**
 * Weeks in order from the first training week. Every 8 streak weeks bank one rest-week pass (max 1);
 * a missed finished week spends it automatically; the current week never breaks the streak.
 */
export function streakFor(weeks: StreakWeek[]): Streak {
  const every = XP.streak.restWeekPassEveryWeeks;
  let streak = 0;
  let banked = false;
  let sinceEarn = 0;
  const passUsed: number[] = [];
  for (const w of weeks) {
    if (w.complete) {
      streak++;
      sinceEarn++;
      if (sinceEarn >= every) {
        banked = true;
        sinceEarn = 0;
      }
    } else if (w.current) {
      continue;
    } else if (banked) {
      banked = false;
      passUsed.push(w.start);
    } else {
      streak = 0;
      sinceEarn = 0;
    }
  }
  return { weeks: streak, passBanked: banked, passUsed };
}

// ---------- weekly quest (FR-XP-6, D68) ----------

export type Quest =
  | { kind: 'all_sessions'; target: number }
  | { kind: 'muscle'; muscle: MuscleGroup; target: number }
  | { kind: 'progress'; target: number };

export interface QuestBasis {
  /** Last week, or null for the first training week. */
  previous: {
    sessionsDone: number;
    sessionsPlanned: number;
    /** Hard sets done vs the routine's planned hard sets, per muscle in the routine. */
    muscles: { muscle: MuscleGroup; done: number; planned: number }[];
  } | null;
  sessionsPlanned: number;
}

/** One quest a week from last week's weak spot: missed sessions → weakest muscle → beat 3 lifts. */
export function questFor(b: QuestBasis): Quest {
  const p = b.previous;
  if (!p || p.sessionsDone < p.sessionsPlanned) return { kind: 'all_sessions', target: b.sessionsPlanned };
  const weak = p.muscles
    .filter((m) => m.planned > 0 && m.done < m.planned)
    .sort((a, c) => a.done / a.planned - c.done / c.planned)[0];
  if (weak) return { kind: 'muscle', muscle: weak.muscle, target: Math.ceil(weak.planned) };
  return { kind: 'progress', target: 3 };
}

export interface QuestWeek {
  sessionsDone: number;
  muscleSets: Map<MuscleGroup, number>;
  /** Exercises whose best e1RM beat their previous exposure this week. */
  progressed: number;
}

export function questProgress(q: Quest, w: QuestWeek): { done: number; target: number; complete: boolean } {
  const done =
    q.kind === 'all_sessions'
      ? w.sessionsDone
      : q.kind === 'muscle'
        ? Math.floor(w.muscleSets.get(q.muscle) ?? 0)
        : w.progressed;
  return { done: Math.min(done, q.target), target: q.target, complete: done >= q.target };
}

import { describe, expect, it } from 'vitest';
import posesJson from '@/data/poses.json';
import exercisesJson from '@/data/exercises.json';
import { loadCatalog } from '@/db/catalog';
import { HEAD_R, pose, type JointName } from './rig';
import { poseDef } from './svg';
import { layersFor, lerpPose, TIER1 } from './tier1';
import { SCALE_ORIGIN, tier2Def, tier2Defs, type PoseData } from './tier2';

const data = posesJson as unknown as PoseData;
const exerciseIds = new Set((exercisesJson as { id: string; poseId?: string }[]).map((e) => e.id));
const tier1Exercises = new Set(
  (exercisesJson as { id: string; poseId?: string }[]).filter((e) => e.poseId).map((e) => e.id),
);
const PART_KINDS = new Set(['floor', 'line', 'rect', 'stack', 'pulley', 'disc']);
const HOLDS = new Set([
  'none',
  'dumbbell',
  'dumbbell-v',
  'barbell',
  'bar',
  'kettlebell',
  'handle',
  'rope',
  'back-bar',
  'front-bar',
  'hip-bar',
  'plate-chest',
]);

describe('Tier 2 pose data (FR-ILL-2)', () => {
  it('covers at least 120 exercises, each a seeded exercise without a Tier 1 pose', () => {
    const ids = Object.keys(data.poses);
    expect(ids.length).toBeGreaterThanOrEqual(120);
    for (const id of ids) {
      expect(exerciseIds.has(id), id).toBe(true);
      expect(tier1Exercises.has(id), id).toBe(false);
      expect(id in TIER1, id).toBe(false);
    }
  });

  it('every entry names a real archetype, and every archetype is used', () => {
    const used = new Set(Object.values(data.poses).map((p) => p.a));
    for (const [id, p] of Object.entries(data.poses)) expect(data.archetypes[p.a], id).toBeDefined();
    for (const a of Object.keys(data.archetypes)) expect(used.has(a), a).toBe(true);
  });

  it('parts and holds use known primitives', () => {
    for (const [name, a] of Object.entries(data.archetypes)) {
      for (const p of a.parts) expect(PART_KINDS.has(p[0]), `${name}: ${p[0]}`).toBe(true);
      if (a.hold) expect(HOLDS.has(a.hold), name).toBe(true);
    }
    for (const [id, e] of Object.entries(data.poses)) {
      for (const p of e.parts ?? []) expect(PART_KINDS.has(p[0]), `${id}: ${p[0]}`).toBe(true);
      if (e.hold) expect(HOLDS.has(e.hold), id).toBe(true);
    }
  });

  it('the figure stays inside the 240 × 170 panel through the whole movement', () => {
    const joints: JointName[] = ['hip', 'neck', 'head', 'shoulder', 'elbow', 'hand', 'knee', 'ankle', 'toe'];
    const bad: string[] = [];
    for (const [id, e] of Object.entries(data.poses)) {
      const def = tier2Def(e, data.archetypes)!;
      const s = data.archetypes[e.a]!.scale ?? 1;
      const [ox, oy] = data.archetypes[e.a]!.origin ?? SCALE_ORIGIN;
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const j = pose(lerpPose(def.start, def.end, t), def.anchor);
        for (const k of joints) {
          const p = j[k];
          if (!p) continue;
          const r = k === 'head' ? HEAD_R : 4;
          const x = ox + (p[0] - ox) * s;
          const y = oy + (p[1] - oy) * s;
          if (x - r < -2 || x + r > 242 || y - r < -2 || y + r > 172) bad.push(`${id}@${t}:${k}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('renders every layer as SVG with finite numbers', () => {
    for (const [id, def] of Object.entries(tier2Defs(data))) {
      for (const t of [null, 0, 0.5]) {
        const l = layersFor(def, 'var(--ll-panel)', t);
        const all = l.back + l.ghost + l.solid + l.arrow;
        expect(all, id).not.toMatch(/NaN|undefined|Infinity/);
        expect(l.solid.length, id).toBeGreaterThan(100);
      }
    }
  });

  it('overrides replace only the named angles, hold and lever', () => {
    const base = data.archetypes['seated-chest-press']!;
    const d = tier2Def(
      { a: 'seated-chest-press', end: { ua: -36 }, lever: null, hold: 'bar' },
      data.archetypes,
    )!;
    expect(d.end.ua).toBe(-36);
    expect(d.end.fa).toBe(base.end.fa);
    const l = layersFor(d);
    expect(l.solid).not.toContain(`M160 70`);
    expect(tier2Def({ a: 'nope' }, data.archetypes)).toBeUndefined();
  });

  it('loadCatalog registers the poses and gives those exercises a poseId', async () => {
    const cat = await loadCatalog();
    const bench = cat.find((e) => e.id === 'bench-press')!;
    expect(bench.poseId).toBe('bench-press');
    expect(poseDef('bench-press')).toBeDefined();
    // Tier 1 ids are untouched.
    expect(cat.find((e) => e.id === 'incline-dumbbell-press')!.poseId).toBe('incline-db-press');
    const withPose = cat.filter((e) => poseDef(e.poseId)).length;
    expect(withPose).toBeGreaterThanOrEqual(130);
  });
});

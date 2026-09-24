/**
 * Tier 2 pictograms (FR-ILL-2): about 120 common exercises authored as data in src/data/poses.json
 * and drawn by one generic renderer with the same rig and equipment parts as Tier 1.
 *
 * poses.json has two maps:
 *  - `archetypes`: a movement (anchor + start/end joint angles), the equipment `parts` behind the
 *    figure, what the hands hold, optional cable/lever attachments, the red motion arrow and an
 *    optional `scale` for movements that reach above the 170-unit panel (standing overhead work).
 *  - `poses`: exercise id → archetype, with optional overrides (hold, extra parts, angles).
 */
import {
  add,
  arrow,
  C,
  cable,
  dumbbell,
  f,
  figure,
  floor,
  line,
  plate,
  poly,
  pulley,
  stack,
  type JointName,
  type Joints,
  type PoseAngles,
  type Pt,
} from './rig';
import type { Layers, PoseDef } from './tier1';

/** Equipment primitives: coordinates are panel units (240 × 170); "e" = equipment, "d" = dark. */
export type Part =
  | ['floor']
  | ['floor', number]
  | ['line', number, number, number, number, number, ('e' | 'd')?]
  | ['rect', number, number, number, number]
  | ['stack', number, number, number, number]
  | ['pulley', number, number]
  | ['disc', number, number, number, ('e' | 'd')?];

export type Hold =
  | 'none'
  | 'dumbbell'
  | 'dumbbell-v'
  | 'barbell'
  | 'bar'
  | 'kettlebell'
  | 'handle'
  | 'rope'
  | 'back-bar'
  | 'front-bar'
  | 'hip-bar'
  | 'plate-chest';

export interface Archetype {
  anchor: [JointName, [number, number]];
  start: PoseAngles;
  end: PoseAngles;
  parts: Part[];
  hold?: Hold;
  /** Pulley point: a cable runs from the hands to it. */
  cable?: [number, number];
  /** Machine lever pivot: an arm runs from it to the hands. */
  lever?: [number, number];
  /** A pad/roller rides on this joint (leg extension, leg curl). */
  roller?: JointName;
  /** Red motion arrow (omitted for holds such as the plank). */
  arrow?: [[number, number], [number, number], number];
  scale?: number;
  /** Point the scale is about: the floor centre by default, the top for hanging movements. */
  origin?: [number, number];
}

export interface PoseEntry {
  a: string;
  hold?: Hold;
  parts?: Part[];
  cable?: [number, number] | null;
  lever?: [number, number] | null;
  start?: Partial<PoseAngles>;
  end?: Partial<PoseAngles>;
}

export interface PoseData {
  archetypes: Record<string, Archetype>;
  poses: Record<string, PoseEntry>;
}

function partSvg(p: Part): string {
  const col = (k?: 'e' | 'd') => (k === 'd' ? C.EQUIP_D : C.EQUIP);
  switch (p[0]) {
    case 'floor':
      return floor(p[1]);
    case 'line':
      return line([p[1], p[2]], [p[3], p[4]], p[5], col(p[6]));
    case 'rect':
      return `<rect x="${f(p[1])}" y="${f(p[2])}" width="${f(p[3])}" height="${f(p[4])}" rx="2" fill="none" stroke="${C.EQUIP}" stroke-width="3"/>`;
    case 'stack':
      return stack(p[1], p[2], p[3], p[4]);
    case 'pulley':
      return pulley([p[1], p[2]]);
    case 'disc':
      return `<circle cx="${f(p[1])}" cy="${f(p[2])}" r="${f(p[3])}" fill="${col(p[4])}"/>`;
  }
}

function kettlebell(c: Pt, color: string, bg: string): string {
  const [x, y] = c;
  return (
    `<circle cx="${f(x)}" cy="${f(y + 11)}" r="10" fill="${color}" stroke="${bg}" stroke-width="2"/>` +
    `<path d="M${f(x - 6)} ${f(y + 4)}L${f(x - 5)} ${f(y - 2)}L${f(x + 5)} ${f(y - 2)}L${f(x + 6)} ${f(y + 4)}" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/** What the hands (or body) carry, drawn from the current joints. */
function holdSvg(h: Hold, j: Joints, color: string, bg: string | null): string {
  const b = bg ?? C.PANEL_BG;
  switch (h) {
    case 'none':
      return '';
    case 'dumbbell':
      return dumbbell(j.hand, color, bg);
    case 'dumbbell-v':
      return dumbbell(j.hand, color, bg, 90);
    case 'barbell':
      return plate(j.hand, 17, color, b);
    case 'back-bar':
      return plate(add(j.neck, [-3, 6]), 15, color, b);
    case 'front-bar':
      return plate(j.hand, 13, color, b);
    case 'hip-bar':
      return plate(add(j.hip, [2, -12]), 15, color, b);
    case 'plate-chest':
      return plate(j.hand, 12, color, b);
    case 'kettlebell':
      return kettlebell(j.hand, color, b);
    case 'bar':
      return line(add(j.hand, [-7, 0]), add(j.hand, [7, 0]), 5, color);
    case 'handle':
      return line(add(j.hand, [0, -6]), add(j.hand, [0, 6]), 5, color);
    case 'rope':
      return (
        poly([add(j.hand, [1, -4]), add(j.hand, [5, 5])], 4, color) +
        poly([add(j.hand, [-1, -4]), add(j.hand, [-5, 5])], 4, color)
      );
  }
}

function merge(base: PoseAngles, over?: Partial<PoseAngles>): PoseAngles {
  return over ? ({ ...base, ...over } as PoseAngles) : base;
}

export const SCALE_ORIGIN: [number, number] = [120, 157];

function wrap(s: string, scale: number | undefined, origin = SCALE_ORIGIN): string {
  if (!scale || scale === 1 || !s) return s;
  const [x, y] = origin;
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(scale)}) translate(${f(-x)} ${f(-y)})">${s}</g>`;
}

/** Builds the PoseDef for one exercise entry. */
export function tier2Def(entry: PoseEntry, archetypes: Record<string, Archetype>): PoseDef | undefined {
  const a = archetypes[entry.a];
  if (!a) return undefined;
  const hold = entry.hold ?? a.hold ?? 'none';
  const cablePt = entry.cable === null ? undefined : (entry.cable ?? a.cable);
  const leverPt = entry.lever === null ? undefined : (entry.lever ?? a.lever);
  const parts = [...a.parts, ...(entry.parts ?? [])];
  const G = C.GHOST;
  return {
    anchor: a.anchor,
    start: merge(a.start, entry.start),
    end: merge(a.end, entry.end),
    draw(st: Joints, end: Joints, bg: string): Layers {
      let back = parts.map(partSvg).join('');
      if (cablePt) back += pulley(cablePt);
      const attach = (j: Joints, color: string, dark: string) => {
        let pre = '';
        if (cablePt) pre += cable(j.hand, cablePt, color === C.INK ? C.EQUIP_D : color);
        if (leverPt) pre += line(leverPt, j.hand, 5, dark);
        return pre;
      };
      const roller = (j: Joints, color: string) => {
        if (!a.roller) return '';
        const p = j[a.roller];
        return p ? `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="7" fill="${color}"/>` : '';
      };
      const ghost = attach(st, G, G) + figure(st, G, bg) + holdSvg(hold, st, G, null) + roller(st, G);
      const solid =
        attach(end, C.INK, C.EQUIP_D) +
        figure(end, C.INK, bg) +
        holdSvg(hold, end, C.INK, bg) +
        roller(end, C.EQUIP_D);
      return {
        back: wrap(back, a.scale, a.origin),
        ghost: wrap(ghost, a.scale, a.origin),
        solid: wrap(solid, a.scale, a.origin),
        arrow: a.arrow ? wrap(arrow(a.arrow[0], a.arrow[1], a.arrow[2]), a.scale, a.origin) : '',
      };
    },
  };
}

/** All Tier 2 PoseDefs keyed by exercise id (also the exercise's poseId). */
export function tier2Defs(data: PoseData): Record<string, PoseDef> {
  const out: Record<string, PoseDef> = {};
  for (const [id, e] of Object.entries(data.poses)) {
    const d = tier2Def(e, data.archetypes);
    if (d) out[id] = d;
  }
  return out;
}

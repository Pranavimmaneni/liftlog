/**
 * The 10 Tier 1 exercises from pictos.py (FR-ILL-2), ported 1:1. Each exercise is data (start/end
 * joint angles + anchor) plus a draw function for its equipment, so the same definition renders the
 * static "ghost start + solid finish" picture and the animated in-between frames (FR-ILL-4).
 */
import {
  add,
  arrow,
  C,
  cable,
  dumbbell,
  figure,
  floor,
  line,
  plate,
  poly,
  pose,
  pulley,
  stack,
  f,
  type JointName,
  type Joints,
  type PoseAngles,
  type Pt,
} from './rig';

export interface Layers {
  back: string;
  ghost: string;
  solid: string;
  arrow: string;
}

export interface PoseDef {
  anchor: [JointName, Pt];
  start: PoseAngles;
  end: PoseAngles;
  /** Draws every layer from the ghost (start) joints and the solid (current/end) joints. */
  draw(st: Joints, end: Joints, bg: string): Layers;
}

const G = C.GHOST;
const INK = C.INK;

export const TIER1: Record<string, PoseDef> = {
  'incline-db-press': {
    anchor: ['hip', [118, 118]],
    start: { torso: -135, th: 0, sh: 90, foot: 0, ua: 110, fa: -80 },
    end: { torso: -135, th: 0, sh: 90, foot: 0, ua: -74, fa: -80 },
    draw(st, end, bg) {
      let back = floor();
      back += line([104, 126.5], [72, 94.5], 9, C.EQUIP);
      back += line([100, 131], [140, 131], 8, C.EQUIP);
      back += line([108, 136], [100, 157], 5, C.EQUIP_D);
      back += line([136, 136], [144, 157], 5, C.EQUIP_D);
      back += line([84, 108], [88, 157], 5, C.EQUIP_D);
      return {
        back,
        ghost: figure(st, G, bg) + dumbbell(st.hand, G),
        solid: figure(end, INK, bg) + dumbbell(end.hand, INK, bg),
        arrow: arrow([122, 86], [124, 46], -5),
      };
    },
  },
  'seated-cable-row': {
    anchor: ['hip', [78, 122]],
    start: { torso: -72, th: -15, sh: 20, foot: -70, ua: 8, fa: 8 },
    end: { torso: -95, th: -15, sh: 20, foot: -70, ua: 120, fa: 0 },
    draw(st, end, bg) {
      let back = floor();
      back += `<rect x="170" y="26" width="16" height="131" rx="2" fill="none" stroke="${C.EQUIP}" stroke-width="3"/>`;
      back += stack(172, 60, 12, 88);
      back += line([44, 133], [128, 133], 8, C.EQUIP);
      back += line([52, 137], [52, 157], 5, C.EQUIP_D);
      back += line([120, 137], [120, 157], 5, C.EQUIP_D);
      back += line([152, 104], [152, 134], 6, C.EQUIP_D);
      back += line([152, 134], [170, 134], 4, C.EQUIP_D);
      back += pulley([164, 118]);
      const handle = (p: Pt, c: string) => line([p[0] + 4, p[1] - 6], [p[0] + 4, p[1] + 6], 5, c);
      return {
        back,
        ghost: cable(add(st.hand, [4, 0]), [164, 118], G) + figure(st, G, bg) + handle(st.hand, G),
        solid: cable(add(end.hand, [4, 0]), [164, 118]) + figure(end, INK, bg) + handle(end.hand, INK),
        arrow: arrow([136, 70], [104, 78], 6),
      };
    },
  },
  'machine-shoulder-press': {
    anchor: ['hip', [116, 120]],
    start: { torso: -90, th: 0, sh: 90, foot: 0, ua: 70, fa: -96 },
    end: { torso: -90, th: 0, sh: 90, foot: 0, ua: -62, fa: -84 },
    draw(st, end, bg) {
      let back = floor();
      back += stack(30, 50, 24, 100);
      back += line([42, 50], [42, 20], 4, C.EQUIP_D);
      back += line([42, 20], [78, 20], 4, C.EQUIP_D);
      back += line([78, 22], [78, 157], 5, C.EQUIP_D);
      back += line([98, 70], [98, 124], 9, C.EQUIP);
      back += line([100, 131], [138, 131], 8, C.EQUIP);
      back += line([116, 136], [116, 157], 5, C.EQUIP_D);
      let ghost = line([78, 26], st.hand, 5, G) + figure(st, G, bg);
      let solid = line([78, 26], end.hand, 5, C.EQUIP_D, 'round') + figure(end, INK, bg);
      solid += line(add(end.hand, [-7, 0]), add(end.hand, [7, 0]), 6, INK);
      ghost += line(add(st.hand, [-7, 0]), add(st.hand, [7, 0]), 6, G);
      return { back, ghost, solid, arrow: arrow([156, 80], [156, 36], -6) };
    },
  },
  'lat-pulldown': {
    anchor: ['hip', [100, 120]],
    start: { torso: -97, th: 0, sh: 95, foot: 0, ua: -82, fa: -80 },
    end: { torso: -97, th: 0, sh: 95, foot: 0, ua: 106, fa: -68 },
    draw(st, end, bg) {
      let back = floor();
      back += line([104, 12], [176, 12], 5, C.EQUIP_D);
      back += line([176, 12], [176, 157], 5, C.EQUIP_D);
      back += stack(182, 58, 20, 92);
      back += pulley([104, 12]) + pulley([176, 12]);
      back += line([80, 129], [120, 129], 8, C.EQUIP);
      back += line([100, 133], [100, 157], 5, C.EQUIP_D);
      back += line([126, 104], [176, 104], 4, C.EQUIP_D);
      back += `<circle cx="126" cy="102" r="6.5" fill="${C.EQUIP}"/>`;
      const bar = (p: Pt, c: string, halo?: string) =>
        poly(
          [
            [p[0] - 24, p[1] + 5],
            [p[0] - 18, p[1]],
            [p[0] + 18, p[1]],
            [p[0] + 24, p[1] + 5],
          ],
          4.5,
          c,
          halo,
        );
      return {
        back,
        ghost: cable(st.hand, [104, 12], G) + figure(st, G, bg) + bar(st.hand, G),
        solid: cable(end.hand, [104, 12]) + figure(end, INK, bg) + bar(end.hand, INK, bg),
        arrow: arrow([140, 30], [140, 70], -6),
      };
    },
  },
  'rope-pushdown': {
    anchor: ['ankle', [100, 150]],
    start: { torso: -84, th: 92, sh: 90, foot: 0, ua: 93, fa: -38 },
    end: { torso: -84, th: 92, sh: 90, foot: 0, ua: 93, fa: 82 },
    draw(st, end, bg) {
      let back = floor();
      back += `<rect x="160" y="10" width="16" height="147" rx="2" fill="none" stroke="${C.EQUIP}" stroke-width="3"/>`;
      back += stack(162, 70, 12, 80);
      back += pulley([154, 18]);
      const rope = (p: Pt, c: string) =>
        poly(
          [
            [p[0] + 1, p[1] - 4],
            [p[0] + 5, p[1] + 5],
          ],
          4,
          c,
        ) +
        poly(
          [
            [p[0] - 1, p[1] - 4],
            [p[0] - 5, p[1] + 5],
          ],
          4,
          c,
        );
      return {
        back,
        ghost: cable(st.hand, [154, 18], G) + figure(st, G, bg) + rope(st.hand, G),
        solid: cable(end.hand, [154, 18]) + figure(end, INK, bg) + rope(end.hand, INK),
        arrow: arrow([140, 58], [128, 96], -10),
      };
    },
  },
  'back-squat': {
    anchor: ['ankle', [112, 150]],
    start: { torso: -88, th: 90, sh: 90, foot: 0, ua: 128, fa: -40 },
    end: { torso: -52, th: 2, sh: 106, foot: 0, ua: 128, fa: -40 },
    draw(st, end, bg) {
      return {
        back: floor(),
        ghost: figure(st, G, bg) + plate(add(st.neck, [-2, 5]), 15, G, bg),
        solid: figure(end, INK, bg) + plate(add(end.neck, [-3, 6]), 15, INK, bg),
        arrow: arrow([66, 64], [60, 104], 8),
      };
    },
  },
  'romanian-deadlift': {
    anchor: ['ankle', [100, 150]],
    start: { torso: -90, th: 90, sh: 90, foot: 0, ua: 92, fa: 90 },
    end: { torso: -24, th: 66, sh: 86, foot: 0, ua: 98, fa: 98 },
    draw(st, end, bg) {
      return {
        back: floor(),
        ghost: figure(st, G, bg) + plate(st.hand, 17, G, bg),
        solid: figure(end, INK, bg) + plate(end.hand, 17, INK, bg),
        arrow: arrow([124, 22], [164, 56], -12),
      };
    },
  },
  'leg-press': {
    anchor: ['hip', [70, 124]],
    start: { torso: -150, th: -82, sh: -10, foot: -135, ua: 60, fa: 20 },
    end: { torso: -150, th: -40, sh: -50, foot: -135, ua: 60, fa: 20 },
    draw(st, end, bg) {
      let back = floor();
      back += line([58, 136], [24, 116], 9, C.EQUIP);
      back += line([58, 137], [84, 137], 8, C.EQUIP);
      back += line([64, 142], [64, 157], 5, C.EQUIP_D);
      back += line([32, 124], [32, 157], 5, C.EQUIP_D);
      back += line([96, 128], [180, 44], 5, C.EQUIP_D);
      back += line([150, 74], [176, 157], 4, C.EQUIP_D);
      back += line([96, 128], [96, 157], 4, C.EQUIP_D);
      const sled = (a: Pt, c: string) => {
        const [ux, uy] = [0.707, -0.707];
        const [px, py] = [0.707, 0.707];
        const [cx, cy] = [a[0] + ux * 7, a[1] + uy * 7];
        let s = line([cx - px * 17, cy - py * 17], [cx + px * 17, cy + py * 17], 6, c);
        s += line(
          [cx + ux * 6 + px * 4, cy + uy * 6 + py * 4],
          [cx + ux * 6 + px * 16, cy + uy * 6 + py * 16],
          9,
          c,
        );
        return s;
      };
      return {
        back,
        ghost: sled(st.ankle, G) + figure(st, G, bg),
        solid: sled(end.ankle, C.EQUIP_D) + figure(end, INK, bg),
        arrow: arrow([92, 62], [118, 38], 0),
      };
    },
  },
  'seated-leg-curl': {
    anchor: ['hip', [96, 112]],
    start: { torso: -96, th: 0, foot: -70, ua: 80, fa: 10, sh: 16 },
    end: { torso: -96, th: 0, foot: 30, ua: 80, fa: 10, sh: 122 },
    draw(st, end, bg) {
      let back = floor();
      back += line([78, 64], [78, 118], 9, C.EQUIP);
      back += line([80, 123], [132, 123], 8, C.EQUIP);
      back += line([100, 128], [100, 157], 5, C.EQUIP_D);
      back += line([112, 100], [134, 100], 8, C.EQUIP);
      back += line([134, 100], [150, 86], 4, C.EQUIP_D);
      back += line([150, 86], [150, 157], 5, C.EQUIP_D);
      const knee = end.knee;
      const roller = (a: Pt, c: string, off: Pt) => {
        const p = add(a, off);
        return line(knee, p, 4, c) + `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="7" fill="${c}"/>`;
      };
      let solid = figure(end, INK, bg) + roller(end.ankle, C.EQUIP_D, [-9, 5]);
      solid += `<circle cx="${f(knee[0])}" cy="${f(knee[1])}" r="3.5" fill="${C.PANEL_BG}" stroke="${C.EQUIP_D}" stroke-width="2"/>`;
      return {
        back,
        ghost: roller(st.ankle, G, [-1, 10]) + figure(st, G, bg),
        solid,
        arrow: arrow([176, 132], [138, 156], 10),
      };
    },
  },
  'pull-up': {
    anchor: ['hand', [112, 32]],
    start: { torso: -90, th: 108, sh: 196, foot: 100, ua: -90, fa: -90 },
    end: { torso: -90, th: 108, sh: 196, foot: 100, ua: 100, fa: -80 },
    draw(st, end, bg) {
      let back = line([30, 12], [210, 12], 5, C.EQUIP_D);
      back += line([112, 12], [112, 32], 3, C.EQUIP_D);
      let solid = figure(end, INK, bg);
      solid += `<circle cx="112" cy="32" r="5" fill="${C.EQUIP_D}"/>`;
      return { back, ghost: figure(st, G, bg), solid, arrow: arrow([158, 110], [158, 60], 0) };
    },
  },
};

/** Muscles per Tier 1 exercise (pictos.py MUSCLES). */
export const TIER1_MUSCLES: Record<string, [string[], string[]]> = {
  'incline-db-press': [['chest'], ['shoulders', 'triceps']],
  'seated-cable-row': [
    ['upper back', 'lats'],
    ['biceps', 'shoulders'],
  ],
  'machine-shoulder-press': [['shoulders'], ['triceps', 'upper back']],
  'lat-pulldown': [['lats'], ['biceps', 'upper back']],
  'rope-pushdown': [['triceps'], []],
  'back-squat': [
    ['quads', 'glutes'],
    ['hamstrings', 'lower back', 'abs'],
  ],
  'romanian-deadlift': [
    ['hamstrings', 'glutes'],
    ['lower back', 'forearms'],
  ],
  'leg-press': [['quads'], ['glutes', 'hamstrings']],
  'seated-leg-curl': [['hamstrings'], ['calves']],
  'pull-up': [['lats'], ['biceps', 'upper back', 'forearms']],
};

export function layersFor(def: PoseDef, bg: string = C.PANEL_BG, t: number | null = null): Layers {
  const st = pose(def.start, def.anchor);
  const endAngles = t === null ? def.end : lerpPose(def.start, def.end, t);
  return def.draw(st, pose(endAngles, def.anchor), bg);
}

/**
 * FR-ILL-4: interpolates every joint angle linearly between the authored values. Not "shortest way
 * round": a pulldown arm going −82° → 106° must sweep forward through 0°, not behind the head.
 */
export function lerpPose(a: PoseAngles, b: PoseAngles, t: number): PoseAngles {
  const out: Record<string, number> = {};
  for (const k of Object.keys(b) as (keyof PoseAngles)[]) {
    const from = a[k] ?? b[k]!;
    out[k] = from + (b[k]! - from) * t;
  }
  return out as unknown as PoseAngles;
}

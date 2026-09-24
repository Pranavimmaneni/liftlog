/**
 * 1:1 TypeScript port of design/illustrations/pictos.py (FR-ILL-1): the pictogram rig and
 * equipment parts. Same segment lengths, stroke widths, halos and number formatting, so the
 * output is string-identical to the Python reference (see port.test.ts). Colours are token
 * CSS variables (FR-THM-1), which is what makes both themes work.
 */

export type Pt = readonly [number, number];

export const C = {
  INK: 'var(--ll-ink)',
  EQUIP: 'var(--ll-equip)',
  EQUIP_D: 'var(--ll-equipDark)',
  GHOST: 'var(--ll-ghost)',
  RED: 'var(--ll-accent)',
  FLOOR: 'var(--ll-floor)',
  FAR: 'var(--ll-farLimb)',
  PANEL_BG: 'var(--ll-panel)',
  IDLE: 'var(--ll-muscleIdle)',
  BODY: 'var(--ll-muscleBody)',
  PRIM: 'var(--ll-musclePrimary)',
  SEC: 'var(--ll-muscleSecondary)',
} as const;

export const L = { torso: 46, ua: 27, fa: 25, th: 34, sh: 33, foot: 10 } as const;
export const W = { torso: 19, ua: 11, fa: 10, th: 14, sh: 12, foot: 8 } as const;
export const HEAD_R = 10.5;
export const HEAD_GAP = 17;
export const SHOULDER_AT = 42;

const DEG = Math.PI / 180; // same constant as CPython's math.radians

export function v(a: number, n: number): Pt {
  const r = a * DEG;
  return [n * Math.cos(r), n * Math.sin(r)];
}

export function add(p: Pt, q: Pt): Pt {
  return [p[0] + q[0], p[1] + q[1]];
}

export interface PoseAngles {
  torso: number;
  ua: number;
  fa: number;
  th: number;
  sh: number;
  foot?: number;
  ua2?: number;
  fa2?: number;
  th2?: number;
  sh2?: number;
  foot2?: number;
}

export type JointName =
  | 'hip'
  | 'neck'
  | 'head'
  | 'shoulder'
  | 'elbow'
  | 'hand'
  | 'knee'
  | 'ankle'
  | 'toe'
  | 'elbow2'
  | 'hand2'
  | 'knee2'
  | 'ankle2'
  | 'toe2';

export type Joints = Partial<Record<JointName, Pt>> &
  Record<'hip' | 'neck' | 'head' | 'shoulder' | 'elbow' | 'hand' | 'knee' | 'ankle' | 'toe', Pt>;

/** Absolute segment directions in degrees (0 = right, 90 = down), anchored at a joint. */
export function pose(p: PoseAngles, anchor: [JointName, Pt] = ['hip', [0, 0]]): Joints {
  const j: Partial<Record<JointName, Pt>> = {};
  j.hip = [0, 0];
  j.neck = add(j.hip, v(p.torso, L.torso));
  j.head = add(j.neck, v(p.torso, HEAD_GAP));
  j.shoulder = add(j.hip, v(p.torso, SHOULDER_AT));
  j.elbow = add(j.shoulder, v(p.ua, L.ua));
  j.hand = add(j.elbow, v(p.fa, L.fa));
  j.knee = add(j.hip, v(p.th, L.th));
  j.ankle = add(j.knee, v(p.sh, L.sh));
  j.toe = add(j.ankle, v(p.foot ?? 0, L.foot));
  if (p.ua2 !== undefined) {
    j.elbow2 = add(j.shoulder, v(p.ua2, L.ua));
    j.hand2 = add(j.elbow2, v(p.fa2 ?? 0, L.fa));
  }
  if (p.th2 !== undefined) {
    j.knee2 = add(j.hip, v(p.th2, L.th));
    j.ankle2 = add(j.knee2, v(p.sh2 ?? 0, L.sh));
    j.toe2 = add(j.ankle2, v(p.foot2 ?? 0, L.foot));
  }
  const [name, target] = anchor;
  const at = j[name]!;
  const off: Pt = [target[0] - at[0], target[1] - at[1]];
  const out: Partial<Record<JointName, Pt>> = {};
  for (const k of Object.keys(j) as JointName[]) out[k] = add(j[k]!, off);
  return out as Joints;
}

/**
 * Python's f"{n:.1f}".rstrip("0").rstrip("."). Python rounds exact binary ties (x.25, x.75) half-to-even;
 * JS toFixed rounds them away from zero, so ties are handled explicitly.
 */
export function f(n: number): string {
  let s: string;
  const a = Math.abs(n);
  if (Number.isInteger(a * 4) && !Number.isInteger(a * 2)) {
    const lo = Math.floor(a * 10);
    const r = lo % 2 === 0 ? lo : lo + 1;
    s = (n < 0 ? '-' : '') + (r / 10).toFixed(1);
  } else {
    s = n.toFixed(1);
  }
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

/** Python str() for the few raw numbers pictos.py interpolates without f(). */
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

export function seg(a: Pt, b: Pt, w: number, color: string, halo?: string | null): string {
  let out = '';
  const d = `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
  if (halo) out += `<path d="${d}" stroke="${halo}" stroke-width="${f(w + 5)}" stroke-linecap="round"/>`;
  out += `<path d="${d}" stroke="${color}" stroke-width="${num(w)}" stroke-linecap="round"/>`;
  return out;
}

export function poly(pts: Pt[], w: number, color: string, halo?: string | null): string {
  const d = 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
  let out = '';
  if (halo)
    out += `<path d="${d}" stroke="${halo}" stroke-width="${f(w + 5)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  out += `<path d="${d}" stroke="${color}" stroke-width="${num(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

export function figure(j: Joints, color: string, bg: string, feet = true, nearArmHalo = true): string {
  let s = '';
  const far = color === C.INK ? C.FAR : color;
  if (j.knee2) {
    s += poly([j.hip, j.knee2, j.ankle2!], W.sh, far);
    if (feet) s += seg(j.ankle2!, j.toe2!, W.foot, far);
  }
  if (j.elbow2) s += poly([j.shoulder, j.elbow2, j.hand2!], W.fa, far);
  s += seg(j.hip, j.neck, W.torso, color);
  s += `<circle cx="${f(j.head[0])}" cy="${f(j.head[1])}" r="${HEAD_R}" fill="${color}"/>`;
  s += seg(j.hip, j.knee, W.th, color);
  s += seg(j.knee, j.ankle, W.sh, color);
  if (feet) s += seg(j.ankle, j.toe, W.foot, color);
  s += poly([j.shoulder, j.elbow, j.hand], W.ua, color, nearArmHalo ? bg : null);
  return s;
}

// ---------- equipment parts ----------

export function line(a: Pt, b: Pt, w: number, color: string = C.EQUIP, cap = 'round'): string {
  return `<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" stroke="${color}" stroke-width="${num(w)}" stroke-linecap="${cap}"/>`;
}

export function dumbbell(c: Pt, color: string = C.INK, bg?: string | null, ang = 0): string {
  const [x, y] = c;
  const r = ang * DEG;
  const ux = Math.cos(r);
  const uy = Math.sin(r);
  let s = '';
  const a: Pt = [x - 11 * ux, y - 11 * uy];
  const b: Pt = [x + 11 * ux, y + 11 * uy];
  if (bg) s += line(a, b, 17, bg);
  s += line(a, b, 4, color);
  for (const k of [-10, 10]) {
    const p: Pt = [x + k * ux, y + k * uy];
    s += line([p[0] - 0.1 * ux, p[1] - 0.1 * uy], [p[0] + 0.1 * ux, p[1] + 0.1 * uy], 13, color, 'round');
    s += line([p[0] - 2.2 * ux, p[1] - 2.2 * uy], [p[0] + 2.2 * ux, p[1] + 2.2 * uy], 13, color, 'butt');
  }
  return s;
}

export function plate(c: Pt, r = 17, color: string = C.INK, bg: string = C.PANEL_BG): string {
  const [x, y] = c;
  return (
    `<circle cx="${f(x)}" cy="${f(y)}" r="${num(r + 2.5)}" fill="${bg}"/>` +
    `<circle cx="${f(x)}" cy="${f(y)}" r="${num(r)}" fill="${color}"/>` +
    `<circle cx="${f(x)}" cy="${f(y)}" r="${num(r - 5)}" fill="none" stroke="${bg}" stroke-width="1.4" opacity=".55"/>` +
    `<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="${bg}"/>`
  );
}

export function stack(x: number, y: number, w: number, h: number, color: string = C.EQUIP): string {
  let s = `<rect x="${f(x)}" y="${f(y)}" width="${num(w)}" height="${num(h)}" rx="2" fill="none" stroke="${color}" stroke-width="3"/>`;
  let yy = y + h - 7;
  let n = 0;
  while (yy > y + h * 0.45 && n < 12) {
    s += line([x + 4, yy], [x + w - 4, yy], 3.2, color, 'butt');
    yy -= 6;
    n += 1;
  }
  s += `<circle cx="${f(x + w - 6)}" cy="${f(y + h - 7 - 6 * 3)}" r="2.6" fill="${C.RED}"/>`;
  return s;
}

export function pulley(c: Pt, color: string = C.EQUIP_D): string {
  return `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="5.5" fill="${C.PANEL_BG}" stroke="${color}" stroke-width="3"/>`;
}

export function cable(a: Pt, b: Pt, color: string = C.EQUIP_D): string {
  return line(a, b, 1.8, color);
}

export function arrow(p0: Pt, p1: Pt, bulge = 0, color: string = C.RED, w = 3.2): string {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const ln = Math.hypot(dx, dy) || 1;
  const nx = -dy / ln;
  const ny = dx / ln;
  const cx = mx + nx * bulge;
  const cy = my + ny * bulge;
  let tx = x1 - cx;
  let ty = y1 - cy;
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl;
  ty /= tl;
  const hx = x1 + tx * 3;
  const hy = y1 + ty * 3;
  const a1: Pt = [hx - tx * 9 - ty * 5.5, hy - ty * 9 + tx * 5.5];
  const a2: Pt = [hx - tx * 9 + ty * 5.5, hy - ty * 9 - tx * 5.5];
  return (
    `<path d="M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}" stroke="${color}" stroke-width="${num(w)}" stroke-linecap="round" stroke-dasharray="1 6.5"/>` +
    `<path d="M${f(a1[0])} ${f(a1[1])}L${f(hx)} ${f(hy)}L${f(a2[0])} ${f(a2[1])}Z" fill="${color}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`
  );
}

export function floor(y = 157, x0 = 14, x1 = 226): string {
  return line([x0, y], [x1, y], 2.2, C.FLOOR, 'butt');
}

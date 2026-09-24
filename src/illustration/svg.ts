/** String renderers matching pictos.illustration() (FR-ILL-1). Pose data for Tier 2 joins in M3. */
import { C } from './rig';
import { layersFor, TIER1, type PoseDef } from './tier1';

const registry: Record<string, PoseDef> = { ...TIER1 };

/** Adds Tier 2 poses (M3). */
export function registerPoses(defs: Record<string, PoseDef>): void {
  Object.assign(registry, defs);
}

export function poseDef(id: string | undefined): PoseDef | undefined {
  return id ? registry[id] : undefined;
}

export function poseIds(): string[] {
  return Object.keys(registry);
}

export interface IllustrationOpts {
  bg?: string;
  ghost?: boolean;
  arrow?: boolean;
  /** 0…1 animation phase for the solid figure; null = finish pose. */
  t?: number | null;
}

/** Inner SVG markup (no <svg> wrapper) in pictos layer order: back, ghost, solid, arrow. */
export function illustrationBody(id: string, opts: IllustrationOpts = {}): string {
  const def = registry[id];
  if (!def) return '';
  const l = layersFor(def, opts.bg ?? C.PANEL_BG, opts.t ?? null);
  return l.back + (opts.ghost === false ? '' : l.ghost) + l.solid + (opts.arrow === false ? '' : l.arrow);
}

/** Same string pictos.illustration(key, ghost, arrow_on) produces (used by the port test). */
export function illustrationSvg(id: string, opts: IllustrationOpts = {}): string {
  const aria = id.replace(/-/g, ' ');
  return `<svg viewBox="0 0 240 170" width="100%" fill="none" role="img" aria-label="${aria}">${illustrationBody(id, opts)}</svg>`;
}

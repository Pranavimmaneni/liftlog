import { describe, expect, it } from 'vitest';
import ref from './__ref__/pictos-ref.json';
import { illustrationSvg, poseIds } from './svg';
import { muscleMapSvg } from './muscles';
import { f, pose, L } from './rig';
import { lerpPose, TIER1, TIER1_MUSCLES } from './tier1';

const REF = ref as Record<string, { full: string; thumb: string; muscles: string }>;

describe('pictos.py port (FR-ILL-1)', () => {
  it('ports all 10 Tier 1 poses (FR-ILL-2)', () => {
    expect(Object.keys(TIER1).sort()).toEqual(Object.keys(REF).sort());
    expect(poseIds()).toHaveLength(10);
  });

  it.each(Object.keys(REF))('FR-ILL-1: %s full illustration is identical to pictos.py', (id) => {
    expect(illustrationSvg(id)).toBe(REF[id]!.full);
  });

  it.each(Object.keys(REF))('FR-ILL-1: %s thumbnail (finish pose only) is identical', (id) => {
    expect(illustrationSvg(id, { ghost: false, arrow: false })).toBe(REF[id]!.thumb);
  });

  it.each(Object.keys(REF))('FR-ILL-1: %s muscle map is identical', (id) => {
    const [p, s] = TIER1_MUSCLES[id]!;
    expect(muscleMapSvg(p, s)).toBe(REF[id]!.muscles);
  });

  it('matches Python number formatting, including half-even ties', () => {
    expect(f(1.25)).toBe('1.2');
    expect(f(1.35)).toBe('1.4');
    expect(f(1.75)).toBe('1.8');
    expect(f(-2.25)).toBe('-2.2');
    expect(f(10)).toBe('10');
    expect(f(-0.04)).toBe('-0');
    expect(f(157)).toBe('157');
  });

  it('keeps the rig lengths from poses-readme.json', () => {
    expect(L).toEqual({ torso: 46, ua: 27, fa: 25, th: 34, sh: 33, foot: 10 });
    const j = pose({ torso: -90, ua: 90, fa: 90, th: 90, sh: 90 });
    expect(j.neck[1]).toBeCloseTo(-46, 9);
  });

  it('FR-ILL-4: interpolation hits start at t=0, end at t=1, and sweeps through the authored path', () => {
    const def = TIER1['lat-pulldown']!;
    expect(lerpPose(def.start, def.end, 0)).toEqual({ ...def.start });
    expect(lerpPose(def.start, def.end, 1)).toEqual({ ...def.end });
    // −82° (up) → 106° (down): halfway is 12°, in front of the body, not behind the head.
    expect(lerpPose(def.start, def.end, 0.5).ua).toBeCloseTo(12, 9);
    expect(illustrationSvg('lat-pulldown', { t: 1 })).toBe(REF['lat-pulldown']!.full);
  });

  it('unknown pose ids render nothing', () => {
    expect(illustrationSvg('nope')).toContain('aria-label="nope"></svg>');
  });
});

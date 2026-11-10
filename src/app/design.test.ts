import { beforeEach, describe, expect, it } from 'vitest';
import { applyLook, applySection, hasSun, parseDesign, sectionFor, useLook } from './design';

describe('look (FR-DSN-1, FR-DSN-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    applyLook({ design: 'classic', glass: true });
  });

  it('FR-DSN-1: classic is the default and anything unknown falls back to it', () => {
    expect(parseDesign(undefined)).toBe('classic');
    expect(parseDesign('paper')).toBe('classic');
    expect(parseDesign('sun')).toBe('sun');
  });

  it('FR-DSN-1: applying a look sets <html data-design> and the pre-paint mirror', () => {
    applyLook({ design: 'sun' });
    expect(document.documentElement.getAttribute('data-design')).toBe('sun');
    expect(localStorage.getItem('ll-design')).toBe('sun');
    expect(useLook.getState().design).toBe('sun');
    applyLook({ design: 'classic' });
    expect(document.documentElement.getAttribute('data-design')).toBe('classic');
    expect(localStorage.getItem('ll-design')).toBe('classic');
  });

  it('FR-DSN-3: frosted glass can be switched off and is mirrored too', () => {
    applyLook({ design: 'sun', glass: false });
    expect(document.documentElement.getAttribute('data-glass')).toBe('off');
    expect(localStorage.getItem('ll-glass')).toBe('off');
    applyLook({ glass: true });
    expect(document.documentElement.getAttribute('data-glass')).toBe('on');
    expect(useLook.getState().design).toBe('sun');
  });

  it('FR-DSN-3: the sun shows only behind the rebuilt screens', () => {
    expect(hasSun('/')).toBe(true);
    expect(hasSun('/workout')).toBe(true);
    expect(hasSun('/workout/bench-press')).toBe(true);
    expect(hasSun('/settings')).toBe(false);
    expect(hasSun('/food')).toBe(false);
  });

  it('FR-DSN-2: every /food route is the Food section, the rest is LiftLog', () => {
    expect(sectionFor('/')).toBe('workout');
    expect(sectionFor('/workout/bench-press')).toBe('workout');
    expect(sectionFor('/food')).toBe('food');
    expect(sectionFor('/food/add')).toBe('food');
    expect(sectionFor('/foodish')).toBe('workout');
  });

  it('FR-DSN-2: the section is put on <html data-section>', () => {
    applySection('food');
    expect(document.documentElement.getAttribute('data-section')).toBe('food');
    applySection('workout');
    expect(document.documentElement.getAttribute('data-section')).toBe('workout');
  });
});

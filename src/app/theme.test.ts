import { describe, expect, it } from 'vitest';
import { applyTheme, resolveTheme } from './theme';

describe('theme (FR-SET-1, FR-PLT-9)', () => {
  it('FR-SET-1: System follows the OS, Paper and Iron are forced', () => {
    expect(resolveTheme('system', true)).toBe('iron');
    expect(resolveTheme('system', false)).toBe('paper');
    expect(resolveTheme('paper', true)).toBe('paper');
    expect(resolveTheme('iron', false)).toBe('iron');
  });

  it('FR-SET-1 / FR-PLT-9: applies instantly, persists a pre-paint mirror, sets the status bar', () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="x" media="(prefers-color-scheme: dark)">' +
      '<meta name="theme-color" content="x">' +
      '<meta name="apple-mobile-web-app-status-bar-style" content="default">';
    applyTheme('iron');
    expect(document.documentElement.getAttribute('data-theme')).toBe('iron');
    expect(localStorage.getItem('ll-theme')).toBe('iron');
    const apple = () =>
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content');
    expect(apple()).toBe('black');
    applyTheme('paper');
    expect(document.documentElement.getAttribute('data-theme')).toBe('paper');
    expect(apple()).toBe('default');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { applyLook } from '@/app/design';
import { celebrate, celebrateOnce, dismissCelebration, ripple, useEcho } from '@/app/echo';
import { useToast } from '@/components/Toast';
import { EchoLayer } from './Echo';

function reducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: on && q.includes('prefers-reduced-motion'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('Echo motion (FR-DSN-8)', () => {
  beforeEach(() => {
    localStorage.clear();
    reducedMotion(false);
    applyLook({ design: 'sun' });
    useEcho.setState({ ripples: 0, celebration: null });
    useToast.getState().clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    applyLook({ design: 'classic' });
  });

  it('FR-DSN-8: a ripple draws three rings once and then clears', () => {
    vi.useFakeTimers();
    render(<EchoLayer />);
    expect(screen.queryByTestId('echo-ripple')).toBeNull();
    act(() => ripple());
    expect(screen.getByTestId('echo-ripple').querySelectorAll('circle')).toHaveLength(3);
    act(() => void vi.advanceTimersByTime(1600));
    expect(screen.queryByTestId('echo-ripple')).toBeNull();
  });

  it('FR-DSN-8: a celebration shows the title and lines, ends by itself, and a tap ends it early', () => {
    vi.useFakeTimers();
    render(<EchoLayer />);
    act(() => celebrate({ title: 'New record', lines: ['Bench Press · 67.5 kg × 10'] }));
    const overlay = screen.getByTestId('echo-celebration');
    expect(overlay.querySelectorAll('circle')).toHaveLength(6);
    expect(screen.getByRole('status')).toHaveTextContent('New record. Bench Press · 67.5 kg × 10');
    act(() => void vi.advanceTimersByTime(3100));
    expect(screen.queryByTestId('echo-celebration')).toBeNull();

    act(() => celebrate({ title: 'Goal reached', lines: ['Protein for today'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('echo-celebration')).toBeNull();
  });

  it('FR-DSN-8: several at once show as one celebration listing the lines', () => {
    render(<EchoLayer />);
    act(() => {
      celebrate({ title: 'Goal reached', lines: ['Calories for today'] });
      celebrate({ title: 'Goal reached', lines: ['Protein for today'] });
    });
    expect(screen.getAllByTestId('echo-celebration')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Calories for today. Protein for today');
    act(() => dismissCelebration());
  });

  it('FR-DSN-8: each goal celebrates once per day', () => {
    expect(celebrateOnce('Goal reached', { protein: 'Protein for today' })).toEqual(['protein']);
    act(() => dismissCelebration());
    expect(celebrateOnce('Goal reached', { protein: 'Protein for today', fat: 'Fat for today' })).toEqual([
      'fat',
    ]);
    expect(useEcho.getState().celebration?.lines).toEqual(['Fat for today']);
    const tomorrow = Date.now() + 86_400_000;
    expect(celebrateOnce('Goal reached', { protein: 'Protein for today' }, tomorrow)).toEqual(['protein']);
  });

  it('FR-DSN-8: with reduced motion there are no rings; the message is a 2 s toast', () => {
    reducedMotion(true);
    render(<EchoLayer />);
    act(() => ripple());
    expect(screen.queryByTestId('echo-ripple')).toBeNull();
    act(() => celebrate({ title: 'New record', lines: ['Bench Press · 67.5 kg × 10'] }));
    expect(screen.queryByTestId('echo-celebration')).toBeNull();
    expect(useToast.getState().message).toBe('New record · Bench Press · 67.5 kg × 10');
  });

  it('FR-DSN-1: the classic look has no Echo', () => {
    applyLook({ design: 'classic' });
    ripple();
    celebrate({ title: 'New record', lines: [] });
    expect(useEcho.getState()).toMatchObject({ ripples: 0, celebration: null });
  });
});

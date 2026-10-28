import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from '@/db/schema';
import { elapsedText, leftText } from './Fasting';

const W = { timeout: 8000 };
const HOUR = 3_600_000;

describe('F07 Fasting (FR-FAST-1)', () => {
  beforeEach(resetDb);

  it('FR-FAST-1: time text from timestamps', () => {
    expect(elapsedText(14 * HOUR + 20 * 60_000)).toBe('14:20');
    expect(leftText(HOUR + 40 * 60_000)).toBe('1 h 40 m');
    expect(leftText(35 * 60_000)).toBe('35 m');
  });

  it('FR-FAST-1: start a 16 h fast; the ring, time left and eat-from show', async () => {
    await seedOnboarded();
    renderRoute('/food/fasting');
    expect(await screen.findByText('No fast running.', {}, W)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '16:8' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '18:6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start fast' }));
    expect(await screen.findByTestId('fast-elapsed', {}, W)).toHaveTextContent('0:00');
    expect(screen.getByRole('meter', { name: 'Fast progress' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/18 h 0 m left/)).toBeInTheDocument();
    expect(screen.getByText(/^eat from/i)).toBeInTheDocument();
    const fasts = await db.fasts.toArray();
    expect(fasts).toHaveLength(1);
    expect(fasts[0]!.planHours).toBe(18);
    expect(screen.getByRole('navigation', { name: 'Section' })).toBeInTheDocument();
  });

  it('FR-FAST-1: ending a 17 h fast counts it in the week strip', async () => {
    await seedOnboarded();
    await db.fasts.add({ id: 'f1', startedAt: Date.now() - 17 * HOUR, planHours: 16 });
    renderRoute('/food/fasting');
    expect(await screen.findByText('Done · eat any time', {}, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'End fast' }));
    await waitFor(async () => expect((await db.fasts.get('f1'))!.endedAt).toBeDefined(), W);
    const week = await screen.findByTestId('fast-week', {}, W);
    await waitFor(
      () =>
        expect(
          within(week)
            .getAllByRole('listitem')
            .some((li) => /: 17 h$/.test(li.getAttribute('aria-label') ?? '')),
        ).toBe(true),
      W,
    );
    expect(screen.getByText(/1 in a row/)).toBeInTheDocument();
  });

  it('FR-FAST-1: editing refuses an end before the start', async () => {
    await seedOnboarded();
    const start = Date.now() - 20 * HOUR;
    await db.fasts.add({ id: 'f2', startedAt: start, endedAt: start + 16 * HOUR, planHours: 16 });
    renderRoute('/food/fasting');
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }, W));
    const sheet = await screen.findByRole('dialog', { name: 'Change fast' }, W);
    const ended = within(sheet).getByLabelText('Ended');
    const before = new Date(start - HOUR);
    const p = (x: number) => String(x).padStart(2, '0');
    fireEvent.change(ended, {
      target: {
        value: `${before.getFullYear()}-${p(before.getMonth() + 1)}-${p(before.getDate())}T${p(before.getHours())}:${p(before.getMinutes())}`,
      },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByRole('alert', {}, W)).toHaveTextContent(
      'The end must be after the start.',
    );
    expect((await db.fasts.get('f2'))!.endedAt).toBe(start + 16 * HOUR);
  });
});

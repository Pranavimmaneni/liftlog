import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { applyLook } from '@/app/design';
import { db } from '@/db/schema';
import { startSession } from '@/db/workout';

const W = { timeout: 8000 };

/** Rising Sun layouts of the Plan and Library screens (M16, FR-DSN-10). Behaviour is the classic one. */
describe('M16 Plan and Library in the Rising Sun look', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
    applyLook({ design: 'sun', glass: true });
  });
  afterEach(() => {
    applyLook({ design: 'classic', glass: true });
  });

  it('FR-DSN-10 (S15): Plan lists the queue on glass with edit, skip, reorder, Library and Change split', async () => {
    await seedOnboarded();
    const { router } = renderRoute('/plan');
    const title = await screen.findByRole('heading', { name: 'Plan', level: 1 }, W);
    expect(title).toHaveClass('sun-title');
    expect(screen.getByRole('img', { name: /sessions done this week/i })).toBeInTheDocument();
    const rows = await screen.findAllByTestId('plan-session', {}, W);
    expect(rows.length).toBeGreaterThan(1);
    expect(within(rows[0]!).getByText(/\d+ lifts · \d+ sets/)).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change split' })).toHaveAttribute('href', '/plan/split');
    expect(screen.getByRole('link', { name: /exercise library/i })).toHaveAttribute('href', '/library');

    // Keyboard reorder still works (FR-RTN-4).
    const first = within(rows[0]!).getByRole('link').textContent;
    const handle = within(rows[0]!).getByRole('button', { name: /^Reorder/ });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await waitFor(
      () =>
        expect(within(screen.getAllByTestId('plan-session')[1]!).getByRole('link').textContent).toBe(first),
      W,
    );

    // Skip to (FR-RTN-5) and tap a name to edit.
    fireEvent.click(screen.getAllByRole('button', { name: 'Skip to' })[0]!);
    await waitFor(async () => expect(await db.queue.count()).toBeGreaterThan(0), W);
    fireEvent.click(within(screen.getAllByTestId('plan-session')[0]!).getByRole('link'));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/plan\/edit\/\d$/), W);
  });

  it('FR-DSN-10 (S04): the routine editor keeps tabs, reorder, swap, remove, add and coverage', async () => {
    await seedOnboarded();
    renderRoute('/plan/edit/0');
    expect(await screen.findByRole('heading', { name: 'Edit routine' }, W)).toBeInTheDocument();
    // The host's bar names the screen, so the wide display title is not repeated here.
    expect(screen.queryByRole('heading', { name: 'Your routine' })).toBeNull();
    const tabs = within(screen.getByRole('tablist', { name: 'Sessions' })).getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    const before = within(panel).getAllByRole('listitem').length;
    const handles = within(panel).getAllByRole('button', { name: /^Reorder/ });
    const firstName = handles[0]!.getAttribute('aria-label');
    fireEvent.keyDown(handles[0]!, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(
        within(panel)
          .getAllByRole('button', { name: /^Reorder/ })[1]!
          .getAttribute('aria-label'),
      ).toBe(firstName),
    );
    expect(screen.getByRole('heading', { name: 'Weekly sets per muscle' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /add exercise/i })).toBeInTheDocument();

    // Swap sheet (S23) with Remove.
    fireEvent.click(within(panel).getAllByRole('button', { name: /^Swap / })[0]!);
    const sheet = await screen.findByRole('dialog', {}, W);
    expect(within(sheet).getByRole('button', { name: 'Browse the library' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove from session' }));
    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(before - 1));
  });

  it('FR-DSN-10 (S04): "Your routine" uses the display title and may wrap', async () => {
    await seedOnboarded();
    renderRoute('/plan/split');
    fireEvent.click(await screen.findByRole('button', { name: /build my routine/i }, W));
    const title = await screen.findByRole('heading', { name: 'Your routine' }, W);
    expect(title).toHaveClass('sun-title');
    expect(title.className).not.toMatch(/whitespace-nowrap|t-display/);
  });

  it('FR-DSN-10 (S13): Library keeps search, filters and the way to a custom exercise', async () => {
    await seedOnboarded();
    renderRoute('/library');
    expect(await screen.findByRole('heading', { name: 'Library' }, W)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Create custom exercise' })[0]).toHaveAttribute(
      'href',
      '/library/new',
    );
    expect(screen.getByRole('button', { name: 'In my gym' })).toHaveAttribute('aria-pressed', 'true');
    for (const f of ['Muscle', 'Equipment', 'Level'])
      expect(screen.getByRole('combobox', { name: f })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search exercises' }), {
      target: { value: 'barbell curl' },
    });
    await waitFor(() => expect(document.querySelector('a[href="/library/barbell-curl"]')).not.toBeNull(), W);
    fireEvent.change(screen.getByRole('combobox', { name: 'Muscle' }), { target: { value: 'chest' } });
    await waitFor(() => expect(document.querySelector('a[href="/library/barbell-curl"]')).toBeNull(), W);
  });

  it('FR-DSN-10 (S16): exercise detail keeps the picture, muscles, how-to and adding to a session', async () => {
    await seedOnboarded();
    renderRoute('/library/barbell-curl');
    expect(await screen.findByRole('heading', { name: 'Barbell Curl' }, W)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Barbell Curl' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /muscles worked/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to do it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your history' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap into…' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to a session' }));
    const sheet = await screen.findByRole('dialog', {}, W);
    expect(within(sheet).getAllByRole('button').length).toBeGreaterThan(2);
  });

  it('FR-DSN-10 (S17): the custom exercise form validates inline', async () => {
    await seedOnboarded();
    renderRoute('/library/new');
    expect(await screen.findByRole('heading', { name: 'New exercise' }, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save exercise' }));
    expect(await screen.findByText('Give it a name.', {}, W)).toBeInTheDocument();
    expect(screen.getByText('Pick the main muscle.')).toBeInTheDocument();
    const chest = screen.getAllByRole('button', { name: 'Chest' })[0]!;
    fireEvent.click(chest);
    expect(chest).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.queryByText('Pick the main muscle.')).toBeNull());
  });

  it('FR-DSN-10 (S24): the target sheet saves a changed target', async () => {
    const sessions = await seedOnboarded();
    const r = (await db.routines.where('active').equals(1).first())!;
    await startSession({
      routineId: r.id,
      routineSessionId: sessions[0]!.id,
      name: 'Upper A',
      exerciseIds: ['lat-pulldown'],
    });
    renderRoute('/workout/lat-pulldown');
    fireEvent.click(await screen.findByRole('button', { name: /^change target/i }, W));
    const d = await screen.findByRole('dialog', {}, W);
    expect(within(d).getByTestId('override-reason')).toHaveTextContent('Coach’s pick:');
    fireEvent.click(
      within(within(d).getByRole('group', { name: 'Sets' })).getByRole('button', { name: /increase/ }),
    );
    fireEvent.click(within(d).getByRole('button', { name: 'Use my target' }));
    await waitFor(async () => expect((await db.goals.get('lat-pulldown'))?.override?.sets).toBe(4), W);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { db } from '@/db/schema';
import { startSession } from '@/db/workout';
import { startOfWeek } from '@/engine/week';

const W = { timeout: 8000 };
const DAY = 86_400_000;

describe('M3 screens', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
  });

  it('S16: exercise detail shows the pictogram, muscles and adds the exercise to a session', async () => {
    await seedOnboarded();
    renderRoute('/library/barbell-curl');
    expect(await screen.findByRole('heading', { name: 'Barbell Curl' }, W)).toBeInTheDocument();
    // Tier 2 pictogram + muscle map.
    expect(screen.getAllByRole('img', { name: 'Barbell Curl' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /muscles worked/i })).toBeInTheDocument();
    expect(screen.getByText('Main:')).toBeInTheDocument();
    expect(screen.getByText(/no sets logged yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add to a session' }));
    const d = await screen.findByRole('dialog', {}, W);
    fireEvent.click(
      within(d)
        .getAllByRole('button')
        .find((b) => /upper/i.test(b.textContent ?? ''))!,
    );
    await waitFor(async () => {
      const r = (await db.routines.where('active').equals(1).first())!;
      expect(r.sessions.some((s) => s.items.some((i) => i.exerciseId === 'barbell-curl'))).toBe(true);
    }, W);
  });

  it('S16: history lists finished sessions with the best set and the e1RM chart table', async () => {
    const sessions = await seedOnboarded();
    const upper = sessions[0]!;
    const first = [...upper.items].sort((a, b) => a.order - b.order)[0]!.exerciseId;
    await seedSession({ routineSession: upper, startedAt: Date.now() - 3 * DAY, loadKg: 60, reps: 8 });
    await seedSession({ routineSession: upper, startedAt: Date.now() - DAY, loadKg: 62.5, reps: 8 });
    renderRoute(`/library/${first}`);
    expect(await screen.findByText('Best set', {}, W)).toBeInTheDocument();
    expect(screen.getAllByText(/62\.5 kg/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /show as table/i }));
    expect(await screen.findByRole('table', {}, W)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /upper/i }).length).toBe(2);
  });

  it('S17: custom exercise validates inline, saves, edits and deletes with history kept', async () => {
    await seedOnboarded();
    renderRoute('/library/new');
    fireEvent.click(await screen.findByRole('button', { name: 'Save exercise' }, W));
    expect(await screen.findByText('Give it a name.', {}, W)).toBeInTheDocument();
    expect(screen.getByText('Pick the main muscle.')).toBeInTheDocument();
    expect(screen.getByText('Pick how it’s loaded.')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'barbell curl' } });
    expect(await screen.findByText(/already exists/i, {}, W)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Kneeling Landmine Press' },
    });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Main muscle' })).getByRole('button', { name: 'Chest' }),
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'How is it loaded?' }), {
      target: { value: 'plate_loaded' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save exercise' }));
    expect(await screen.findByRole('heading', { name: 'Kneeling Landmine Press' }, W)).toBeInTheDocument();
    const row = (await db.exercises.filter((e) => e.name === 'Kneeling Landmine Press').first())!;
    expect(row.isCustom).toBe(1);
    expect(row.loadType).toBe('plate_loaded');
    expect(row.primary).toEqual(['chest']);

    fireEvent.click(screen.getByRole('link', { name: 'Edit' }));
    const name = await screen.findByRole('textbox', { name: 'Name' }, W);
    await waitFor(() => expect(name).toHaveValue('Kneeling Landmine Press'));
    fireEvent.change(name, { target: { value: 'Kneeling Landmine Press (1 arm)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save exercise' }));
    expect(
      await screen.findByRole('heading', { name: 'Kneeling Landmine Press (1 arm)' }, W),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const d = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(d).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect((await db.exercises.get(row.id))!.deletedAt).toBeDefined(), W);
  }, 30_000);

  it('S24: override sticks, shows "Your target", and "Reset to coach’s pick" undoes it', async () => {
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
    let d = await screen.findByRole('dialog', {}, W);
    expect(within(d).getByText('Coach’s pick:')).toBeInTheDocument();
    fireEvent.click(
      within(within(d).getByRole('group', { name: 'Sets' })).getByRole('button', { name: /increase/ }),
    );
    fireEvent.click(within(d).getByRole('button', { name: 'Use my target' }));
    await waitFor(async () => expect((await db.goals.get('lat-pulldown'))?.override?.sets).toBe(4), W);
    expect(await screen.findByText('Your target', {}, W)).toBeInTheDocument();
    expect((await db.goalChanges.toArray()).some((c) => c.overridden)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /^change target/i }));
    d = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(d).getByRole('button', { name: 'Reset to coach’s pick' }));
    await waitFor(async () => expect((await db.goals.get('lat-pulldown'))?.override).toBeUndefined(), W);
  });

  it('S15: keyboard reorder moves a session, "Skip to" changes what is next, strip shows the week', async () => {
    await seedOnboarded();
    renderRoute('/plan');
    const handles = await screen.findAllByRole('button', { name: /^reorder/i }, W);
    expect(handles.length).toBe(4);
    expect(screen.getByRole('img', { name: /0 of 4 sessions done this week/i })).toBeInTheDocument();
    const names = () =>
      screen.getAllByTestId('plan-session').map((li) => within(li).getAllByRole('link')[0]!.textContent);
    const before = names();
    fireEvent.keyDown(handles[0]!, { key: 'ArrowDown' });
    await waitFor(() => expect(names()).toEqual([before[1], before[0], ...before.slice(2)]), W);
    const q = (await db.queue.get('me'))!;
    expect(q.order).toBeDefined();

    fireEvent.click(screen.getAllByRole('button', { name: 'Skip to' })[1]!);
    await waitFor(
      async () => expect((await db.queue.get('me'))!.nextSessionIndex).not.toBe(q.nextSessionIndex),
      W,
    );
    expect(screen.getByRole('link', { name: 'Change split' })).toHaveAttribute('href', '/plan/split');
  });

  it('S15 change split: re-runs S03 → S04, archives the old routine, keeps history', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: Date.now() - DAY });
    const old = (await db.routines.where('active').equals(1).first())!;
    renderRoute('/plan/split');
    fireEvent.click(await screen.findByRole('radio', { name: /full body/i }, W));
    fireEvent.click(screen.getByRole('button', { name: 'Build my routine' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save routine' }, W));
    await waitFor(async () => {
      const now = (await db.routines.where('active').equals(1).first())!;
      expect(now.splitId).toBe('full-body');
      expect(now.id).not.toBe(old.id);
    }, W);
    expect((await db.routines.get(old.id))!.active).toBe(0);
    expect(await db.sessions.count()).toBe(1);
  });

  it('FR-PRG-7: the Plan tab announces the scheduled deload week', async () => {
    const sessions = await seedOnboarded();
    // Intermediate = deload every 6 weeks, so week 7 is a deload: first session six calendar weeks back.
    await seedSession({
      routineSession: sessions[0]!,
      startedAt: startOfWeek(Date.now(), 1) - 42 * DAY + 3_600_000,
    });
    renderRoute('/plan');
    expect(await screen.findByText(/deload week/i, {}, W)).toBeInTheDocument();
  });

  it('/dev/poses lists every pictogram', async () => {
    renderRoute('/dev/poses');
    expect(await screen.findByTestId('pose-count', {}, W)).toHaveTextContent(/\d{3} pictograms · 10 Tier 1/);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter poses' }), {
      target: { value: 'hip-thrust' },
    });
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeLessThan(5));
  });
});

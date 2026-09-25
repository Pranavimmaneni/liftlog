import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { db } from '@/db/schema';
import { saveProfile, saveWeighIn } from '@/db/repo';
import { addDays, dateKey, startOfWeek } from '@/engine/week';

const W = { timeout: 8000 };
const DAY = 86_400_000;
const LAST_WEEK = addDays(startOfWeek(Date.now(), 1), -7);

describe('M4 screens', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
  });

  it('S10: weekly review shows stats, "Going well", "Needs work" with a fix, and next week’s changes', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: LAST_WEEK + DAY, loadKg: 50 });
    await seedSession({ routineSession: sessions[0]!, startedAt: LAST_WEEK + 3 * DAY, loadKg: 55 });
    renderRoute('/progress/review');
    expect(await screen.findByRole('heading', { name: /week 1 review/i }, W)).toBeInTheDocument();
    expect(screen.getByText('2/4')).toBeInTheDocument();
    expect(screen.getByText('Going well')).toBeInTheDocument();
    expect(screen.getByText('Needs work')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /next week and why/i })).toBeInTheDocument();
    // One-tap fix adds an exercise for the weak muscle to the routine.
    const fix = await screen.findByRole('button', { name: /^\+ / }, W);
    const before = (await db.routines.where('active').equals(1).first())!.sessions.flatMap(
      (s) => s.items,
    ).length;
    fireEvent.click(fix);
    await waitFor(async () => {
      const r = (await db.routines.where('active').equals(1).first())!;
      expect(r.sessions.flatMap((s) => s.items).length).toBe(before + 1);
    }, W);
    // Monthly view.
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(await screen.findByRole('heading', { name: /review$/i }, W)).not.toHaveTextContent(/week/i);
    // Previous period navigation.
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    expect(await screen.findByText(/no sessions in this period/i, {}, W)).toBeInTheDocument();
  });

  it('S11: opens S19 body stats first, then shows levels with "Guideline values"', async () => {
    const sessions = await seedOnboarded();
    const r = (await db.routines.where('active').equals(1).first())!;
    const s0 = { ...sessions[0]!, items: [{ exerciseId: 'back-squat', order: 0 }] };
    await db.routines.put({ ...r, sessions: [s0, ...r.sessions.slice(1)] });
    await seedSession({ routineSession: s0, startedAt: Date.now() - 2 * DAY, loadKg: 100, reps: 5 });
    renderRoute('/progress/strength');
    expect(await screen.findByRole('heading', { name: 'Body stats' }, W)).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Sex' })).getByRole('button', { name: 'Female' }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Birth year' }), { target: { value: '1990' } });
    const bw = within(screen.getByRole('group', { name: 'Bodyweight' }));
    fireEvent.click(bw.getByRole('spinbutton'));
    const input = await screen.findByRole('textbox', { name: /bodyweight/i }, W);
    fireEvent.change(input, { target: { value: '65' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Strength levels' }, W)).toBeInTheDocument();
    expect(screen.getByText('Guideline values')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Legs' })).toBeInTheDocument();
    expect(screen.getByText(/general guidelines, not medical advice/i)).toBeInTheDocument();
    expect(screen.getByText(/^Next: /)).toBeInTheDocument();
    const p = (await db.profile.get('me'))!;
    expect(p).toMatchObject({ sex: 'female', birthYear: 1990 });
    expect((await db.bodyweights.toArray())[0]!.kg).toBe(65);
  });

  it('S19 skip records "prefer not to say" so S11 doesn’t ask again', async () => {
    await seedOnboarded();
    renderRoute('/progress/strength');
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }, W));
    expect(await screen.findByRole('heading', { name: 'Strength levels' }, W)).toBeInTheDocument();
    expect(screen.getByText(/add your bodyweight/i)).toBeInTheDocument();
    expect((await db.profile.get('me'))!.sex).toBe('unspecified');
  });

  it('S12: Lifts shows the e1RM chart and PRs; Body shows weigh-ins and recomp; History opens S18', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: Date.now() - 8 * DAY, loadKg: 50 });
    await seedSession({ routineSession: sessions[0]!, startedAt: Date.now() - DAY, loadKg: 55 });
    renderRoute('/progress');
    expect(await screen.findByRole('combobox', { name: 'Exercise' }, W)).toBeInTheDocument();
    expect(screen.getByText('Personal records')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show as table/i }));
    expect(await screen.findByRole('table', {}, W)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    expect(await screen.findByText(/log 3 more weigh-ins/i, {}, W)).toBeInTheDocument();
    for (const d of [20, 10, 2]) await saveWeighIn(dateKey(Date.now() - d * DAY), 80 + d / 10);
    expect(await screen.findByText(/recomp check/i, {}, W)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/more weigh-in/i)).not.toBeInTheDocument(), W);
    expect(screen.getAllByRole('button', { name: /delete weigh-in/i })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    const links = await screen.findAllByRole('link', { name: /upper a/i }, W);
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^\/progress\/session\//));
  });

  it('S18: edit a set and delete the session', async () => {
    const sessions = await seedOnboarded();
    const id = await seedSession({
      routineSession: sessions[0]!,
      startedAt: Date.now() - DAY,
      loadKg: 50,
      reps: 10,
    });
    renderRoute(`/progress/session/${id}`);
    const edit = (await screen.findAllByRole('button', { name: /^edit set 1:/i }, W))[0]!;
    fireEvent.click(edit);
    const d = await screen.findByRole('dialog', {}, W);
    fireEvent.click(
      within(within(d).getByRole('group', { name: 'Reps' })).getByRole('button', { name: /decrease/ }),
    );
    fireEvent.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      const sets = await db.sets.where('sessionId').equals(id).toArray();
      expect(sets.some((s) => s.reps === 9)).toBe(true);
    }, W);

    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    const confirm = await screen.findByRole('dialog', {}, W);
    expect(within(confirm).getByText(/can’t be undone/i)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete session' }));
    await waitFor(async () => expect(await db.sessions.get(id)).toBeUndefined(), W);
  });

  it('S11 machine-only groups say which benchmark unlocks them (FR-STR-2)', async () => {
    const sessions = await seedOnboarded();
    await saveProfile({ sex: 'male', birthYear: 1995 });
    await saveWeighIn(dateKey(Date.now() - DAY), 80);
    const r = (await db.routines.where('active').equals(1).first())!;
    const s0 = {
      ...sessions[0]!,
      items: [
        { exerciseId: 'back-squat', order: 0 },
        { exerciseId: 'machine-shoulder-press', order: 1 },
      ],
    };
    await db.routines.put({ ...r, sessions: [s0, ...r.sessions.slice(1)] });
    await seedSession({ routineSession: s0, startedAt: Date.now() - DAY, loadKg: 60, reps: 8 });
    renderRoute('/progress/strength');
    expect(await screen.findByRole('heading', { name: 'Shoulders' }, W)).toBeInTheDocument();
    expect(screen.getByText(/machine-only right now/i)).toHaveTextContent(/overhead press/i);
  });
});

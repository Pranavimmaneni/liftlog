import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { applyLook } from '@/app/design';
import { dismissCelebration, useEcho } from '@/app/echo';
import { db } from '@/db/schema';
import { saveProfile, saveWeighIn } from '@/db/repo';
import { dateKey } from '@/engine/week';
import { setsLine } from './S09-summary/view';

const W = { timeout: 8000 };
const HOUR = 3_600_000;

/** One finished session two hours ago, plus two weigh-ins. Returns the session id. */
async function seed(): Promise<string> {
  const sessions = await seedOnboarded();
  const id = await seedSession({ routineSession: sessions[0]!, startedAt: Date.now() - 2 * HOUR });
  await saveWeighIn(dateKey(Date.now() - 24 * HOUR), 80);
  await saveWeighIn(dateKey(Date.now()), 79.5);
  return id;
}

/** Rising Sun layouts of the Progress screens (M16, FR-DSN-10). */
describe('M16 Rising Sun Progress screens', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
    dismissCelebration();
    applyLook({ design: 'sun', glass: true });
  });
  afterEach(() => {
    dismissCelebration();
    applyLook({ design: 'classic', glass: true });
  });

  it('FR-DSN-10 (S12): hero card with the estimated 1-rep max and a chart with a table view', async () => {
    await seed();
    renderRoute('/progress');
    expect(await screen.findByRole('heading', { name: 'Progress' }, W)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Section' })).toBeInTheDocument();
    const hero = await screen.findByRole('region', { name: 'Estimated 1-rep max' }, W);
    expect(within(hero).getByRole('combobox', { name: 'Exercise' })).toBeInTheDocument();
    expect(within(hero).getByRole('img', { name: /estimated 1-rep max, .+: from/i })).toBeInTheDocument();
    fireEvent.click(within(hero).getByRole('button', { name: 'Show as table' }));
    expect(within(hero).getByRole('table')).toBeInTheDocument();
  });

  it('FR-DSN-10 (S12): the glass list has body weight, level and XP, streak, strength and records', async () => {
    await seed();
    renderRoute('/progress');
    const list = await screen.findByRole('region', { name: 'Your numbers' }, W);
    expect(await within(list).findByText(/^Level \d+$/, {}, W)).toBeInTheDocument();
    expect(within(list).getByText(/\d XP$/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /streak/i })).toHaveAttribute('href', '/progress/review');
    expect(within(list).getByRole('link', { name: /strength level/i })).toHaveAttribute(
      'href',
      '/progress/strength',
    );
    expect(within(list).getByText('Records')).toBeInTheDocument();
    // Body weight shows the latest weigh-in and the change, and opens the Body view.
    const bw = within(list).getByRole('button', { name: /body weight/i });
    expect(bw).toHaveTextContent('79.5 kg');
    expect(bw).toHaveTextContent('−0.5');
    fireEvent.click(bw);
    expect(await screen.findByRole('button', { name: 'Add weigh-in' }, W)).toBeInTheDocument();
  });

  it('FR-DSN-10 (S12): Lifts, Body and History stay, with everything they show', async () => {
    const id = await seed();
    renderRoute('/progress');
    const views = await screen.findByRole('group', { name: 'Progress sections' }, W);
    expect(within(views).getByRole('button', { name: 'Lifts' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(views).getByRole('button', { name: 'Body' }));
    expect(await screen.findByRole('heading', { name: 'Weigh-ins' }, W)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /delete weigh-in from/i })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Body stats' })).toHaveAttribute('href', '/progress/body-stats');

    fireEvent.click(within(views).getByRole('button', { name: 'History' }));
    const link = await screen.findByRole('link', { name: /upper a/i }, W);
    expect(link).toHaveAttribute('href', `/progress/session/${id}`);
  });

  it('FR-DSN-10 (S20) / FR-DSN-8: saving a weigh-in ripples', async () => {
    await seed();
    renderRoute('/progress?tab=body');
    fireEvent.click(await screen.findByRole('button', { name: 'Add weigh-in' }, W));
    const sheet = await screen.findByRole('dialog', { name: /weigh-in/i }, W);
    expect(within(sheet).getByText('kg · steps of 0.1')).toBeInTheDocument();
    const before = useEcho.getState().ripples;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save weigh-in' }));
    await waitFor(() => expect(useEcho.getState().ripples).toBe(before + 1), W);
  });

  it('FR-DSN-10 (S09): the summary shows goal sets hit, the lifts and keeps Share and Done', async () => {
    const id = await seed();
    renderRoute(`/summary/${id}`);
    expect(await screen.findByRole('heading', { name: 'Workout done' }, W)).toBeInTheDocument();
    const ticket = screen.getByRole('article', { name: 'Upper A ticket' });
    expect(within(ticket).getByText(/goal sets hit/)).toBeInTheDocument();
    expect(within(ticket).getByText('lifted')).toBeInTheDocument();
    const lifts = screen.getByRole('region', { name: 'Lifts' });
    expect(within(lifts).getAllByText(/× 10, 10, 10/).length).toBeGreaterThan(0);
    const more = within(lifts).queryByRole('button', { name: /more lifts?/ });
    if (more) {
      const shown = within(lifts).getAllByRole('listitem').length;
      fireEvent.click(more);
      expect(within(lifts).getAllByRole('listitem').length).toBeGreaterThan(shown);
    }
    expect(screen.getByText('Bonus reps')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    // Finished two hours ago: no celebration on reopening it.
    expect(useEcho.getState().celebration).toBeNull();
  });

  it('FR-DSN-8 (S09): a workout finished within the last minute celebrates once', async () => {
    const id = await seed();
    await db.sessions.update(id, { endedAt: Date.now() - 5000 });
    const first = renderRoute(`/summary/${id}`);
    await screen.findByRole('heading', { name: 'Workout done' }, W);
    await waitFor(() => expect(useEcho.getState().celebration?.title).toBe('Workout finished'), W);
    expect(useEcho.getState().celebration!.lines[0]).toMatch(/^Upper A · \d+ sets$/);

    dismissCelebration();
    first.unmount();
    renderRoute(`/summary/${id}`);
    await screen.findByRole('heading', { name: 'Workout done' }, W);
    await screen.findByRole('region', { name: 'Lifts' }, W);
    expect(useEcho.getState().celebration).toBeNull();
  });

  it('FR-DSN-10 (S09): sets of one lift read as one line, grouped by load', () => {
    const set = (loadKg: number, reps: number) => ({ loadKg, reps });
    expect(setsLine([set(60, 10), set(60, 9), set(62.5, 8)], 'barbell', 'kg')).toBe(
      '60 kg × 10, 9 · 62.5 kg × 8',
    );
    expect(setsLine([set(0, 8), set(0, 7)], 'bodyweight', 'kg')).toBe('BW × 8, 7');
    expect(setsLine([set(0, 45)], 'timed', 'kg')).toBe('45');
  });

  it('FR-DSN-10 (S10): the review has Week / Month pills, the period stepper and the three numbers', async () => {
    await seed();
    renderRoute(`/progress/review?t=${Date.now()}`);
    expect(await screen.findByRole('heading', { name: 'Review' }, W)).toBeInTheDocument();
    const kind = screen.getByRole('group', { name: 'Review period' });
    expect(within(kind).getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Previous period' })).toBeInTheDocument();
    for (const label of ['sessions', 'goal sets', 'records'])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Going well' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Needs work' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next week and why' })).toBeInTheDocument();
    fireEvent.click(within(kind).getByRole('button', { name: 'Month' }));
    await waitFor(
      () =>
        expect(within(kind).getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true'),
      W,
    );
  });

  it('FR-DSN-10 (S11): strength levels show the overall band, a bar per group and the way to body stats', async () => {
    await seed();
    await saveProfile({ sex: 'male', birthYear: new Date().getFullYear() - 30 });
    renderRoute('/progress/strength');
    expect(await screen.findByRole('heading', { name: 'Strength levels' }, W)).toBeInTheDocument();
    const overall = screen.getByRole('region', { name: 'Overall' });
    expect(within(overall).getByText('Male')).toBeInTheDocument();
    expect(within(overall).getByText('Age 30')).toBeInTheDocument();
    expect(
      screen.getAllByRole('img', { name: /^(Chest|Back|Legs|Hinge|Shoulders): / }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Edit body stats' })).toHaveAttribute(
      'href',
      '/progress/body-stats?next=/progress/strength',
    );
  });

  it('FR-DSN-10 (S18): a past session lists every set as an editable chip and keeps delete', async () => {
    const id = await seed();
    renderRoute(`/progress/session/${id}`);
    expect(await screen.findByRole('heading', { name: 'Upper A' }, W)).toBeInTheDocument();
    const sets = screen.getAllByRole('button', { name: /^Edit set 1: 50 kg/ });
    expect(sets.length).toBeGreaterThan(0);
    fireEvent.click(sets[0]!);
    expect(await screen.findByRole('dialog', {}, W)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete session' })).toBeInTheDocument();
  });

  it('FR-DSN-10 (S19): body stats keep sex, birth year, bodyweight, Save and Skip', async () => {
    await seed();
    renderRoute('/progress/body-stats');
    const sex = await screen.findByRole('group', { name: 'Sex' }, W);
    fireEvent.click(within(sex).getByRole('button', { name: 'Female' }));
    expect(within(sex).getByRole('button', { name: 'Female' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Birth year' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await db.profile.get('me'))?.sex).toBe('female'), W);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { db } from '@/db/schema';
import { getProfile } from '@/db/repo';
import { startSession } from '@/db/workout';

const W = { timeout: 8000 };
const T0 = new Date(2026, 8, 1, 9).getTime();

async function activeRoutine() {
  return (await db.routines.where('active').equals(1).first())!;
}

describe('M1 screens', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
  });

  it('FR-ONB-1…5: onboarding S01 → S04 saves profile, gym and routine', async () => {
    renderRoute('/onboarding/about');
    fireEvent.click(await screen.findByRole('radio', { name: /advanced/i }, W));
    fireEvent.click(screen.getByRole('button', { name: 'Get stronger' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByRole('button', { name: 'Harder' })).toBeDisabled(); // advanced can't go harder
    fireEvent.click(screen.getByRole('button', { name: 'Easier' }));
    expect(screen.getByText(/3–4 sets/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next: your gym/i }));

    expect(await screen.findByRole('heading', { name: /what’s in your gym/i }, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Home DBs' }));
    expect(screen.getByRole('button', { name: /dumbbells/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /barbell/i })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /more machines/i }));
    fireEvent.click(screen.getByRole('button', { name: /more equipment/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Knees' }));
    fireEvent.click(screen.getByRole('button', { name: 'lb' }));
    fireEvent.click(screen.getByRole('button', { name: /next: pick a split/i }));

    expect(await screen.findByRole('heading', { name: /pick your split/i }, W)).toBeInTheDocument();
    expect(screen.getByText(/so full body fits best/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /push \/ pull \/ legs/i }));
    fireEvent.click(screen.getByRole('button', { name: /build my routine/i }));

    expect(await screen.findByRole('heading', { name: /your routine/i }, W)).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Push', 'Pull', 'Legs']);
    // FR-RTN-2 keyboard reorder.
    const handles = screen.getAllByRole('button', { name: /reorder/i });
    const firstName = handles[0]!.getAttribute('aria-label');
    fireEvent.keyDown(handles[0]!, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /reorder/i })[1]!.getAttribute('aria-label')).toBe(
        firstName,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /save routine/i }));

    await waitFor(async () => expect((await getProfile())?.experience).toBe('advanced'), W);
    const p = await getProfile();
    expect(p).toMatchObject({
      goal: 'get_stronger',
      daysPerWeek: 3,
      nudge: -1,
      units: 'lb',
      limitations: ['knees'],
    });
    expect((await db.gym.get('me'))!.presetId).toBe('home-dumbbells');
    expect((await activeRoutine()).splitId).toBe('ppl');
  });

  it('FR-ONB-5: unfinished onboarding resumes at the saved step', async () => {
    await db.meta.put({ key: 'onboardingStep', value: 'gym' });
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: /what’s in your gym/i }, W)).toBeInTheDocument();
  });

  it('S05 → S06 → S07: start, log a set with effort, edit it (FR-WRK-1/5/6/11)', async () => {
    await seedOnboarded();
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Upper A' }, W)).toBeInTheDocument();
    expect(screen.getByText(/up next · session 1 of 4/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /start workout/i }, W));
    expect(await screen.findByRole('meter', {}, W)).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/0 of \d+/),
    );
    fireEvent.click(screen.getByRole('link', { name: /lat pulldown/i }));

    expect(await screen.findByRole('heading', { name: 'Lat Pulldown' }, W)).toBeInTheDocument();
    expect(screen.getByTestId('goal-reason')).toHaveTextContent('First time: find your weight');
    const load = screen.getByRole('group', { name: 'Load' });
    fireEvent.click(within(load).getByRole('button', { name: /increase/ }));
    fireEvent.click(screen.getByRole('button', { name: /^log set 1/i }));
    expect(await screen.findByRole('button', { name: /^log set 2/i }, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    await waitFor(async () => expect((await db.sets.toArray())[0]!.effort).toBe('easy'));
    expect(localStorage.getItem('ll-rest')).toContain('durationMs');

    fireEvent.click(screen.getByRole('button', { name: /edit set: set 1/i }));
    const dialog = await screen.findByRole('dialog', {}, W);
    fireEvent.click(
      within(within(dialog).getByRole('group', { name: 'Reps' })).getByRole('button', { name: /increase/ }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await db.sets.toArray())[0]!.reps).toBe(11));

    fireEvent.click(screen.getByRole('button', { name: /edit set: set 1/i }));
    const d2 = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(d2).getByRole('button', { name: /delete set/i }));
    fireEvent.click(
      within(d2)
        .getAllByRole('button', { name: /delete set/i })
        .at(-1)!,
    );
    await waitFor(async () => expect(await db.sets.count()).toBe(0));
  });

  it('S06: finishing with no sets asks before discarding (FR-WRK-12)', async () => {
    const sessions = await seedOnboarded();
    await startSession({
      routineId: (await activeRoutine()).id,
      routineSessionId: sessions[0]!.id,
      name: 'Upper A',
      exerciseIds: ['lat-pulldown'],
    });
    renderRoute('/workout');
    fireEvent.click(await screen.findByRole('button', { name: /finish workout/i }, W));
    const dialog = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(dialog).getByRole('button', { name: /discard workout/i }));
    await waitFor(async () => expect(await db.sessions.count()).toBe(0));
  });

  it('S09: the ticket shows totals, goal sets and the vs-last line (FR-SUM-1)', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: T0, loadKg: 50 });
    const id = await seedSession({
      routineSession: sessions[0]!,
      startedAt: T0 + 7 * 86_400_000,
      loadKg: 52.5,
    });
    renderRoute(`/summary/${id}`);
    expect(await screen.findByText('Workout complete', {}, W)).toBeInTheDocument();
    expect(screen.getByText(/ticket no\. 002/i)).toBeInTheDocument();
    expect(screen.getByText('Goal sets')).toBeInTheDocument();
    expect(screen.getByText(/vs last upper a/i)).toBeInTheDocument();
    expect(screen.getAllByText('PR').length).toBeGreaterThan(0);
    expect(screen.getByText(/next upper a:/i)).toBeInTheDocument();
  });

  it('S13: search by alias and filter by muscle (FR-LIB-3/4)', async () => {
    await seedOnboarded();
    renderRoute('/library');
    const input = await screen.findByRole('searchbox', { name: /search exercises/i }, W);
    fireEvent.change(input, { target: { value: 'rdl' } });
    expect(await screen.findByText('Romanian Deadlift', {}, W)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Muscle' }), { target: { value: 'calves' } });
    expect(await screen.findByText('Standing Calf Raise', {}, W)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'zzzzqq' } });
    expect(await screen.findByText(/no results for/i, {}, W)).toBeInTheDocument();
  });

  it('S14: units, rest, invalid restore file and typed delete (FR-SET-2/3, FR-DATA-3/4)', async () => {
    await seedOnboarded();
    renderRoute('/settings');
    fireEvent.click(await screen.findByRole('button', { name: /units/i }, W));
    const dlg = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(dlg).getByRole('button', { name: 'lb' }));
    await waitFor(async () => expect((await getProfile())!.units).toBe('lb'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: /rest timer/i }));
    const rest = await screen.findByRole('dialog', {}, W);
    fireEvent.click(
      within(within(rest).getByRole('group', { name: 'Big lifts' })).getByRole('button', {
        name: /increase/,
      }),
    );
    await waitFor(async () => expect((await db.settings.get('restCompoundSec'))!.value).toBe(135));
    fireEvent.click(within(rest).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('switch', { name: /warm-up sets/i }));
    await waitFor(async () => expect((await db.settings.get('warmups'))!.value).toBe(false));

    const file = new File(['{"not":"liftlog"}'], 'x.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('restore-input'), { target: { files: [file] } });
    expect(await screen.findByRole('alert', {}, W)).toHaveTextContent(/isn’t a liftlog backup/i);

    fireEvent.click(screen.getByRole('button', { name: /delete all data/i }));
    const del = await screen.findByRole('dialog', {}, W);
    const btn = within(del).getByRole('button', { name: /delete everything/i });
    expect(btn).toBeDisabled();
    fireEvent.change(within(del).getByRole('textbox'), { target: { value: 'DELETE' } });
    fireEvent.click(btn);
    await waitFor(async () => expect(await db.profile.count()).toBe(0), W);
  });

  it('S14: profile and gym editors save as you tap (FR-SET-4, FR-GYM-1)', async () => {
    await seedOnboarded();
    renderRoute('/settings/profile');
    fireEvent.click(await screen.findByRole('button', { name: 'Beginner' }, W));
    await waitFor(async () => expect((await getProfile())!.experience).toBe('beginner'));
    fireEvent.click(screen.getByRole('button', { name: 'Recomp' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Harder' }));
    await waitFor(async () =>
      expect(await getProfile()).toMatchObject({ goal: 'recomp', daysPerWeek: 5, nudge: 1 }),
    );
  });

  it('S14 gym editor', async () => {
    await seedOnboarded();
    renderRoute('/settings/gym');
    fireEvent.click(await screen.findByRole('button', { name: /lat pulldown/i }, W));
    await waitFor(async () => expect((await db.gym.get('me'))!.machineIds).not.toContain('lat-pulldown'));
    fireEvent.click(screen.getByRole('button', { name: 'Wrists' }));
    await waitFor(async () => expect((await getProfile())!.limitations).toContain('wrists'));
  });

  it('S15 plan: skip to a session and edit a session (FR-RTN-2/4)', async () => {
    await seedOnboarded();
    renderRoute('/plan');
    const skips = await screen.findAllByRole('button', { name: /skip to/i }, W);
    fireEvent.click(skips[1]!);
    await waitFor(async () => expect((await db.queue.get('me'))!.nextSessionIndex).toBe(2));
    fireEvent.click(screen.getAllByRole('link', { name: /edit session/i })[0]!);
    fireEvent.click(await screen.findByRole('button', { name: /save routine/i }, W));
    expect(await screen.findByText('Routine saved', {}, W)).toBeInTheDocument();
  });

  it('S12 progress lists finished sessions; empty state before any', async () => {
    const sessions = await seedOnboarded();
    const { unmount } = renderRoute('/progress');
    expect(await screen.findByText(/no sessions yet/i, {}, W)).toBeInTheDocument();
    unmount();
    await seedSession({ routineSession: sessions[0]!, startedAt: T0 });
    renderRoute('/progress');
    expect(await screen.findByRole('link', { name: /upper a/i }, W)).toBeInTheDocument();
  });

  it('S20 weigh-in from home (FR-REV-3 input)', async () => {
    await seedOnboarded();
    renderRoute('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Log' }, W));
    const dlg = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(dlg).getByRole('button', { name: /save weigh-in/i }));
    await waitFor(async () => expect(await db.bodyweights.count()).toBe(1));
    expect(await screen.findByText('75', {}, W)).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded, seedSession } from '@/test/seed';
import { db } from '@/db/schema';
import { getRawSetting } from '@/db/settings';
import { logSet, startSession } from '@/db/workout';
import { platform } from '@/platform';

vi.mock('@/app/ticket-image', () => ({
  renderTicketPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

const W = { timeout: 8000 };
const DAY = 86_400_000;

describe('M5 screens', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('Home: level chip, weekly quest, backup nudge ("Not now" hides it) and install banner', async () => {
    const sessions = await seedOnboarded();
    await seedSession({ routineSession: sessions[0]!, startedAt: Date.now() - 9 * DAY });
    renderRoute('/');
    expect(await screen.findByRole('link', { name: /^level \d+, /i }, W)).toHaveTextContent(/lv \d+/i);
    expect(screen.getByRole('heading', { name: /this week’s quest/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /complete all 4 sessions/i })).toBeInTheDocument();
    expect(screen.getByText(/haven’t backed up yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText(/haven’t backed up yet/i)).not.toBeInTheDocument(), W);
    expect(screen.getByText(/add liftlog to your home screen/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(async () => expect(await getRawSetting('installBannerDismissed')).toBe(true), W);
  });

  it('Ticket: level card with XP, milestone card, and Share hands a PNG to the share sheet', async () => {
    const sessions = await seedOnboarded();
    const id = await seedSession({ routineSession: sessions[0]!, startedAt: Date.now() - DAY });
    const share = vi.spyOn(platform, 'share').mockResolvedValue('shared');
    renderRoute(`/summary/${id}`);
    expect(await screen.findByRole('heading', { name: /^level \d+$/i }, W)).toBeInTheDocument();
    expect(screen.getByText(/^\+\d+ XP$/)).toBeInTheDocument();
    expect(screen.getByText('Your first session is logged.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    await waitFor(() => expect(share).toHaveBeenCalled(), W);
    expect(share.mock.calls[0]![0]).toMatchObject({
      mime: 'image/png',
      name: expect.stringMatching(/\.png$/),
    });
  });

  it('S22 stickers: a QR sticker for every machine in My Gym', async () => {
    await seedOnboarded();
    const gym = (await db.gym.get('me'))!;
    renderRoute('/scan/stickers');
    expect(await screen.findByRole('heading', { name: 'Machine stickers' }, W)).toBeInTheDocument();
    const machines = gym.machineIds.filter((m) => m !== 'pullup-bar' && m !== 'dip-station');
    expect(screen.getAllByRole('img', { name: /^QR code for / })).toHaveLength(machines.length);
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('/m/<machineId>: opens the exercise detail, or the logger when a workout is open', async () => {
    const sessions = await seedOnboarded();
    const { router, unmount } = renderRoute('/m/lat-pulldown');
    await waitFor(() => expect(router.state.location.pathname).toBe('/library/lat-pulldown'), W);
    unmount();
    const r = (await db.routines.where('active').equals(1).first())!;
    const s = await startSession({
      routineId: r.id,
      routineSessionId: sessions[1]!.id,
      name: 'Lower A',
      exerciseIds: ['back-squat'],
    });
    const second = renderRoute('/m/leg-press');
    await waitFor(() => expect(second.router.state.location.pathname).toBe('/workout/leg-press'), W);
    expect((await db.sessions.get(s.id))!.plan.some((p) => p.exerciseId === 'leg-press')).toBe(true);
    second.unmount();
    renderRoute('/m/not-a-machine');
    expect(await screen.findByText(/isn’t in this app’s list/i, {}, W)).toBeInTheDocument();
  });

  it('S22 scan: without a camera it says so and links to the sticker sheet', async () => {
    await seedOnboarded();
    vi.spyOn(platform, 'openCamera').mockRejectedValue(new Error('NotAllowedError'));
    renderRoute('/scan');
    expect(await screen.findByText(/camera isn’t available/i, {}, W)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Print stickers' })).toHaveAttribute('href', '/scan/stickers');
    expect(screen.getByRole('button', { name: 'Close scanner' })).toBeInTheDocument();
  });

  it('S21 install help: three steps per platform and the data note', async () => {
    await seedOnboarded();
    renderRoute('/install');
    expect(await screen.findByRole('heading', { name: 'Install LiftLog' }, W)).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Phone' });
    fireEvent.click(within(group).getByRole('button', { name: 'iPhone (Safari)' }));
    expect(screen.getByText(/add to home screen”, then add/i)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: 'Android (Chrome)' }));
    expect(screen.getByText(/install app/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Step \d$/)).toHaveLength(3);
    expect(screen.getByText(/each keep their own data/i)).toBeInTheDocument();
  });

  it('FR-XP-3: a new best e1RM gets a PR stamp on its set row', async () => {
    const sessions = await seedOnboarded();
    await seedSession({
      routineSession: sessions[0]!,
      startedAt: Date.now() - 3 * DAY,
      loadKg: 50,
      reps: 10,
    });
    const r = (await db.routines.where('active').equals(1).first())!;
    const first = [...sessions[0]!.items].sort((a, b) => a.order - b.order)[0]!.exerciseId;
    const s = await startSession({
      routineId: r.id,
      routineSessionId: sessions[0]!.id,
      name: 'Upper A',
      exerciseIds: [first],
    });
    await logSet({
      sessionId: s.id,
      exerciseId: first,
      idx: 1,
      kind: 'work',
      loadKg: 60,
      reps: 10,
      goalMet: true,
      bonusReps: 0,
    });
    await logSet({
      sessionId: s.id,
      exerciseId: first,
      idx: 2,
      kind: 'work',
      loadKg: 50,
      reps: 8,
      goalMet: true,
      bonusReps: 0,
    });
    renderRoute(`/workout/${first}`);
    const stamps = await screen.findAllByLabelText('New personal record', {}, W);
    expect(stamps).toHaveLength(1);
  });

  it('S26: a storage failure shows the banner with "Export backup"', async () => {
    await seedOnboarded();
    renderRoute('/settings');
    await screen.findByRole('heading', { name: /settings/i }, W);
    act(() => {
      const e = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(e, 'reason', { value: { name: 'QuotaExceededError' } });
      window.dispatchEvent(e);
    });
    const banner = await screen.findByRole('alert', {}, W);
    expect(banner).toHaveTextContent(/couldn’t save/i);
    expect(within(banner).getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
  });
});

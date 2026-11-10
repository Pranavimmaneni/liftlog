import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { applyLook } from '@/app/design';
import { CrashScreen } from '@/app/CrashScreen';
import { db } from '@/db/schema';
import { getProfile } from '@/db/repo';
import { startSession } from '@/db/workout';

const W = { timeout: 8000 };

/** Rising Sun layouts of the Setup screens (M16, FR-DSN-10): same behaviour as the classic look. */
describe('M16 Setup screens in the Rising Sun look', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
    applyLook({ design: 'sun', glass: true });
  });
  afterEach(() => {
    applyLook({ design: 'classic', glass: true });
  });

  it('FR-DSN-10 (S01–S03): onboarding keeps every choice and saves profile, gym and routine', async () => {
    renderRoute('/onboarding/about');
    expect(await screen.findByRole('heading', { name: 'About you' }, W)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /advanced/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Get stronger' }));
    const days = screen.getByRole('group', { name: /days per week/i });
    fireEvent.click(within(days).getByRole('button', { name: /decrease/ }));
    expect(screen.getByRole('button', { name: 'Harder' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Easier' }));
    expect(screen.getByRole('button', { name: 'Easier' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /next: your gym/i }));

    expect(await screen.findByRole('heading', { name: 'Your gym' }, W)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /what’s in your gym/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Home DBs' }));
    expect(screen.getByRole('button', { name: /dumbbells/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /barbell/i })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /more machines/i }));
    fireEvent.click(screen.getByRole('button', { name: /more equipment/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Knees' }));
    fireEvent.click(screen.getByRole('button', { name: 'lb' }));
    fireEvent.click(screen.getByRole('button', { name: /next: pick a split/i }));

    expect(await screen.findByRole('heading', { name: 'Your split' }, W)).toBeInTheDocument();
    expect(screen.getByText(/so full body fits best/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /build your own/i }));
    expect(await screen.findByRole('heading', { name: 'Your days' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /push \/ pull \/ legs/i }));
    expect(screen.getByRole('radio', { name: /push \/ pull \/ legs/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /build my routine/i }));

    fireEvent.click(await screen.findByRole('button', { name: /save routine/i }, W));
    await waitFor(async () => expect((await getProfile())?.experience).toBe('advanced'), W);
    expect(await getProfile()).toMatchObject({
      goal: 'get_stronger',
      daysPerWeek: 3,
      nudge: -1,
      units: 'lb',
      limitations: ['knees'],
    });
    expect((await db.gym.get('me'))!.presetId).toBe('home-dumbbells');
  });

  it('FR-DSN-10 (S14): every Settings row is still there, on glass groups', async () => {
    await seedOnboarded();
    renderRoute('/settings');
    expect(await screen.findByRole('group', { name: 'Look' }, W)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Frosted glass' })).toBeInTheDocument();
    const training = screen.getByRole('region', { name: 'Training' });
    expect(await within(training).findByRole('button', { name: /units/i }, W)).toBeInTheDocument();
    expect(within(training).getByRole('button', { name: /rest timer/i })).toBeInTheDocument();
    expect(within(training).getByRole('switch', { name: /warm-up sets/i })).toBeInTheDocument();
    expect(within(training).getByRole('switch', { name: /alert when rest ends/i })).toBeInTheDocument();
    expect(within(training).getByRole('combobox', { name: /week starts on/i })).toBeInTheDocument();
    const you = screen.getByRole('region', { name: 'You' });
    for (const [name, href] of [
      [/profile/i, '/settings/profile'],
      [/my gym/i, '/settings/gym'],
      [/body stats/i, '/progress/body-stats'],
      [/library/i, '/library'],
    ] as const)
      expect(within(you).getByRole('link', { name })).toHaveAttribute('href', href);
    for (const name of [/back up now/i, /restore from backup/i, /export sets as csv/i, /delete all data/i])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Install help' })).toHaveAttribute('href', '/install');
    expect(screen.getByText(/No account, no tracking/)).toBeInTheDocument();

    fireEvent.click(within(training).getByRole('switch', { name: /warm-up sets/i }));
    await waitFor(async () => expect((await db.settings.get('warmups'))!.value).toBe(false));
  });

  it('FR-DSN-10 (S26b): delete all data still needs the typed word, and offers a way out', async () => {
    await seedOnboarded();
    renderRoute('/settings');
    fireEvent.click(await screen.findByRole('button', { name: /delete all data/i }, W));
    const del = await screen.findByRole('dialog', {}, W);
    expect(within(del).getByRole('button', { name: /delete everything/i })).toBeDisabled();
    fireEvent.click(within(del).getByRole('button', { name: 'Keep my data' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await db.profile.count()).toBe(1);
  });

  it('FR-DSN-10 (S14 profile): pills and the days stepper save as you tap', async () => {
    await seedOnboarded();
    renderRoute('/settings/profile');
    fireEvent.click(await screen.findByRole('button', { name: 'Beginner' }, W));
    await waitFor(async () => expect((await getProfile())!.experience).toBe('beginner'));
    fireEvent.click(screen.getByRole('button', { name: 'Recomp' }));
    const before = (await getProfile())!.daysPerWeek;
    fireEvent.click(
      within(screen.getByRole('group', { name: /days per week/i })).getByRole('button', { name: /increase/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Harder' }));
    await waitFor(async () =>
      expect(await getProfile()).toMatchObject({ goal: 'recomp', daysPerWeek: before + 1, nudge: 1 }),
    );
  });

  it('FR-DSN-10 (S14 gym): toggles save, own machines and the sticker sheet stay reachable', async () => {
    await seedOnboarded();
    renderRoute('/settings/gym');
    fireEvent.click(await screen.findByRole('button', { name: /lat pulldown/i }, W));
    await waitFor(async () => expect((await db.gym.get('me'))!.machineIds).not.toContain('lat-pulldown'));
    fireEvent.click(screen.getByRole('button', { name: 'Wrists' }));
    await waitFor(async () => expect((await getProfile())!.limitations).toContain('wrists'));
    expect(screen.getByRole('button', { name: /add a machine/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /print machine stickers/i })).toHaveAttribute(
      'href',
      '/scan/stickers',
    );
  });

  it('FR-DSN-10 (S21): install help lists three steps per phone and the data note', async () => {
    await seedOnboarded();
    renderRoute('/install');
    expect(await screen.findByRole('heading', { name: 'Install LiftLog' }, W)).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Phone' });
    fireEvent.click(within(group).getByRole('button', { name: 'iPhone (Safari)' }));
    expect(screen.getByRole('heading', { name: 'On iPhone, in Safari' })).toBeInTheDocument();
    expect(screen.getByText(/add to home screen”, then add/i)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: 'Android (Chrome)' }));
    expect(screen.getByRole('heading', { name: 'On Android, in Chrome' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/each keep their own data/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to backup' })).toHaveAttribute('href', '/settings');
  });

  it('FR-DSN-10 (S22): stickers keep a QR per machine and Print; an unknown machine links to the scanner', async () => {
    await seedOnboarded();
    const gym = (await db.gym.get('me'))!;
    const first = renderRoute('/scan/stickers');
    expect(await screen.findByRole('heading', { name: 'Machine stickers' }, W)).toBeInTheDocument();
    const machines = gym.machineIds.filter((m) => m !== 'pullup-bar' && m !== 'dip-station');
    expect(screen.getAllByRole('img', { name: /^QR code for / })).toHaveLength(machines.length);
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    first.unmount();

    renderRoute('/m/not-a-machine');
    expect(await screen.findByText(/isn’t in this app’s list/i, {}, W)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scan a machine' })).toHaveAttribute('href', '/scan');
  });

  it('FR-DSN-10 (S08): the machine card names the machine and keeps settings, stack and photo', async () => {
    const sessions = await seedOnboarded();
    const r = (await db.routines.where('active').equals(1).first())!;
    await startSession({
      routineId: r.id,
      routineSessionId: sessions[0]!.id,
      name: 'Upper A',
      exerciseIds: ['lat-pulldown'],
    });
    renderRoute('/workout/lat-pulldown');
    const card = (await screen.findByRole('heading', { name: /your machine/i }, W)).closest('section')!;
    expect(within(card).getByText(/lat pulldown/i)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: /\+ setting/i }));
    const d = await screen.findByRole('dialog', {}, W);
    fireEvent.change(within(d).getByRole('textbox', { name: 'Name' }), { target: { value: 'Seat' } });
    fireEvent.change(within(d).getByRole('textbox', { name: 'Value' }), { target: { value: '4' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /seat: 4/i }, W)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /stack/i })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /add photo/i })).toBeInTheDocument();
  });

  it('FR-DSN-10 (S26): not-found and crash screens keep their message and actions', async () => {
    await seedOnboarded();
    const nf = renderRoute('/nope/here');
    expect(await screen.findByRole('heading', { name: 'That page doesn’t exist.' }, W)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to today' })).toHaveAttribute('href', '/');
    nf.unmount();

    render(<CrashScreen error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke.');
    expect(screen.getByText('Your logged sets are saved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
  });
});

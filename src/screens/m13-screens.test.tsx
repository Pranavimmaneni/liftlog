import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { applyLook } from '@/app/design';
import { useRest } from '@/app/rest-store';
import { db } from '@/db/schema';
import { saveWeighIn } from '@/db/repo';
import { dateKey } from '@/engine/week';

const W = { timeout: 8000 };

/** Rising Sun look (M13, docs/new-design-handoff): look switch, sun, Today, workout, logger, rest. */
describe('M13 Rising Sun screens', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
    useRest.getState().skip();
    applyLook({ design: 'sun', glass: true });
  });
  afterEach(() => {
    useRest.getState().skip();
    applyLook({ design: 'classic', glass: true });
  });

  it('FR-DSN-1: Settings switches the look, saves it and classic comes back unchanged', async () => {
    applyLook({ design: 'classic' });
    await seedOnboarded();
    renderRoute('/settings');
    const look = await screen.findByRole('group', { name: 'Look' }, W);
    expect(within(look).getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('sun-backdrop')).toBeNull();

    fireEvent.click(within(look).getByRole('button', { name: 'Rising Sun' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-design')).toBe('sun'));
    await waitFor(async () => expect((await db.settings.get('design'))?.value).toBe('sun'));
    expect(localStorage.getItem('ll-design')).toBe('sun');
    // FR-DSN-3: the glass switch appears (the sun itself is checked on Today below).
    fireEvent.click(screen.getByRole('switch', { name: 'Frosted glass' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-glass')).toBe('off'));
    await waitFor(async () => expect((await db.settings.get('sunGlass'))?.value).toBe(false));

    fireEvent.click(within(look).getByRole('button', { name: 'Classic' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-design')).toBe('classic'));
    expect(screen.queryByTestId('sun-backdrop')).toBeNull();
  });

  it('FR-DSN-2: the section follows the route', async () => {
    await seedOnboarded();
    renderRoute('/food');
    await waitFor(() => expect(document.documentElement.getAttribute('data-section')).toBe('food'));
  });

  it('FR-DSN-4: Today is a workout card and a Food card, with the rest kept in a quiet list', async () => {
    await seedOnboarded();
    await saveWeighIn(dateKey(Date.now()), 80);
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Today' }, W)).toBeInTheDocument();
    expect(screen.getByTestId('sun-backdrop')).toBeInTheDocument(); // FR-DSN-3
    expect(await screen.findByRole('heading', { name: 'Upper A' }, W)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start workout/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /muscles this session covers/i })).toBeInTheDocument();
    // The LiftLog | Food switch stays on Today (handoff §8.1).
    expect(screen.getByRole('navigation', { name: 'Section' })).toBeInTheDocument();

    // Month as dots; dates show on tap.
    const cal = screen.getByRole('button', { name: /days? trained/i });
    expect(cal).toHaveAttribute('aria-pressed', 'false');
    expect(within(cal).queryByText(String(new Date().getDate()))).toBeNull();
    fireEvent.click(cal);
    expect(cal).toHaveAttribute('aria-pressed', 'true');
    expect(within(cal).getByText(String(new Date().getDate()))).toBeInTheDocument();

    // Food card: calories left, Log food, four rings (FR-NUT-1).
    expect(await screen.findByText(/kcal left/i, {}, W)).toBeInTheDocument();
    const food = screen.getByRole('region', { name: 'Food' });
    expect(within(food).getByRole('link', { name: /log food/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/food\/add\?meal=/),
    );
    for (const m of ['Protein', 'Carbs', 'Fat', 'Fibre'])
      expect(within(food).getByText(new RegExp(`^${m}: 0 of \\d+ grams$`))).toBeInTheDocument();

    // Kept features: this week (FR-RTN-5), quest (FR-XP-6), weigh-in (S20), level (FR-XP-2).
    const more = screen.getByRole('region', { name: 'This week' });
    expect(within(more).getByText(/session 1 of 4 is next/i)).toBeInTheDocument();
    expect(within(more).getByText('Weekly quest')).toBeInTheDocument();
    expect(within(more).getByRole('link', { name: /level 1/i })).toBeInTheDocument();
    fireEvent.click(within(more).getByRole('button', { name: /weigh-in/i }));
    expect(await screen.findByRole('dialog', { name: /weigh-in/i }, W)).toBeInTheDocument();
  });

  it('FR-DSN-5: Active workout lists the lifts, shows the set bar and keeps add, finish and cancel', async () => {
    await seedOnboarded();
    renderRoute('/');
    fireEvent.click(await screen.findByRole('button', { name: /start workout/i }, W));
    expect(await screen.findByRole('meter', {}, W)).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/0 of \d+/),
    );
    expect(screen.getByRole('heading', { name: 'Upper A' })).toBeInTheDocument();
    const current = document.querySelector('a[aria-current="step"]')!;
    expect(current).toHaveTextContent(/now · set 1 next/i);
    const name = current.querySelector('span > span')!.textContent!;
    expect(screen.getByRole('link', { name: `Start ${name}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel workout' })).toBeInTheDocument();
    // FR-WRK-16: undo right after starting.
    expect(screen.getByRole('button', { name: /undo start workout/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add a lift' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add a lift' }, W);
    expect(within(sheet).getByRole('button', { name: /add from list/i })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /scan machine/i })).toBeInTheDocument();
  });

  it('FR-DSN-6 / FR-DSN-7: logging a set saves it at once, then the rest view takes over', async () => {
    await seedOnboarded();
    renderRoute('/');
    fireEvent.click(await screen.findByRole('button', { name: /start workout/i }, W));
    await screen.findByRole('meter', {}, W);
    fireEvent.click(screen.getAllByRole('link', { name: /lat pulldown/i })[0]!);

    // Logging: title, set list, steppers, the two tiles, the reason (FR-GOAL-5), one Log button.
    expect(await screen.findByRole('heading', { name: 'Lat Pulldown' }, W)).toBeInTheDocument();
    expect(screen.getByText('Set 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Last session')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change target/i })).toHaveTextContent(/today’s goal/i);
    expect(screen.getByTestId('goal-reason')).toHaveTextContent('First time: find your weight');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Load' })).getByRole('button', { name: /increase/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^log set 1/i }));

    // Written to Dexie the moment it is logged; the rest timer starts (FR-TMR-1).
    await waitFor(async () => expect(await db.sets.count()).toBe(1), W);
    expect(await screen.findByRole('timer', {}, W)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^log set/i })).toBeNull();
    expect(localStorage.getItem('ll-rest')).toContain('durationMs');

    // FR-WRK-6: one-tap effort for the set just logged.
    const feel = await screen.findByRole('group', { name: 'How did set 1 feel?' }, W);
    fireEvent.click(within(feel).getByRole('button', { name: 'Easy' }));
    await waitFor(async () => expect((await db.sets.toArray())[0]!.effort).toBe('easy'));

    // Handoff §8.1: −15 s / +15 s and "Hurts" live in the options sheet (FR-TMR-3).
    const before = useRest.getState().timer!.durationMs;
    fireEvent.click(screen.getByRole('button', { name: /options for lat pulldown/i }));
    const sheet = await screen.findByRole('dialog', { name: 'Options' }, W);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Plus 15 seconds' }));
    expect(useRest.getState().timer!.durationMs).toBe(before + 15_000);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Minus 15 seconds' }));
    expect(useRest.getState().timer!.durationMs).toBe(before);
    expect(within(sheet).getByRole('button', { name: 'Hurts' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /swap exercise/i })).toBeInTheDocument();
    expect(within(sheet).getByText('Form tips')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));

    // "Start set 2 now" ends the rest and brings the logger back.
    fireEvent.click(screen.getByRole('button', { name: 'Start set 2 now' }));
    expect(await screen.findByRole('button', { name: /^log set 2/i }, W)).toBeInTheDocument();
    expect(screen.queryByRole('timer')).toBeNull();
    expect(useRest.getState().timer).toBeNull();
    // The logged set is in the list and opens the edit sheet (FR-WRK-11).
    fireEvent.click(screen.getByRole('button', { name: /edit set: set 1/i }));
    expect(await screen.findByRole('dialog', {}, W)).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from '@/db/schema';
import { getExerciseMap } from '@/db/catalog';

const W = { timeout: 8000 };
const pick = (day: number, groups: string[]) => {
  const g = screen.getByRole('group', { name: `Muscle groups for day ${day}` });
  for (const name of groups) fireEvent.click(within(g).getByRole('button', { name }));
};
const activeRoutine = async () => (await db.routines.where('active').equals(1).first())!;

describe('Build your own split: combine muscle groups per day (D79)', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
  });

  it('onboarding: Chest + Biceps / Shoulders + Triceps / Legs + Back → suggested exercises → saved routine', async () => {
    renderRoute('/');
    fireEvent.click(await screen.findByRole('button', { name: /next: your gym/i }, W));
    fireEvent.click(await screen.findByRole('button', { name: /next: pick a split/i }, W));
    fireEvent.click(await screen.findByRole('radio', { name: /build your own/i }, W));

    // One day card per training day (4 by default); remove the 4th.
    expect(await screen.findAllByRole('group', { name: /^muscle groups for day \d$/i }, W)).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Remove day 4' }));
    expect(screen.getAllByRole('group', { name: /^muscle groups for day \d$/i })).toHaveLength(3);

    pick(1, ['Chest', 'Biceps']);
    pick(2, ['Shoulders', 'Triceps']);
    pick(3, ['Legs', 'Back']);
    expect(screen.getByRole('heading', { name: 'Chest + Biceps' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Legs + Back' })).toBeInTheDocument();
    // Tapping again removes a group.
    pick(1, ['Biceps']);
    expect(screen.getByRole('heading', { name: 'Chest' })).toBeInTheDocument();
    pick(1, ['Biceps']);

    fireEvent.click(screen.getByRole('button', { name: /build my routine/i }));
    expect(await screen.findByRole('heading', { name: /your routine/i }, W)).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Chest + Biceps',
      'Shoulders + Triceps',
      'Legs + Back',
    ]);
    // Regression: during onboarding (profile not saved yet) the swap sheet still offers alternatives.
    fireEvent.click(screen.getAllByRole('button', { name: /^swap /i })[0]!);
    const sheet = await screen.findByRole('dialog', {}, W);
    await waitFor(() => expect(sheet.querySelector('[aria-busy="false"]')).not.toBeNull(), W);
    expect(within(sheet).queryByText(/no alternatives/i)).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: /save routine/i }));

    await waitFor(async () => expect((await activeRoutine()).splitId).toBe('custom'), W);
    const r = await activeRoutine();
    const map = await getExerciseMap();
    const muscles = r.sessions.map((s) => new Set(s.items.flatMap((i) => map.get(i.exerciseId)!.primary)));
    expect(r.sessions.map((s) => s.items.length).every((n) => n >= 3)).toBe(true);
    expect(muscles[0]!.has('chest') && muscles[0]!.has('biceps')).toBe(true);
    expect(muscles[1]!.has('shoulders') && muscles[1]!.has('triceps')).toBe(true);
    expect(muscles[2]!.has('quads') && (muscles[2]!.has('lats') || muscles[2]!.has('upper back'))).toBe(true);
  });

  it('Plan → Change split: build your own days, then edit on S04', async () => {
    await seedOnboarded();
    renderRoute('/plan/split');
    fireEvent.click(await screen.findByRole('radio', { name: /build your own/i }, W));
    const days = await screen.findAllByRole('group', { name: /^muscle groups for day \d$/i }, W);
    for (let i = days.length; i > 2; i--)
      fireEvent.click(screen.getByRole('button', { name: `Remove day ${i}` }));
    pick(1, ['Chest', 'Triceps']);
    pick(2, ['Back', 'Biceps']);
    fireEvent.click(screen.getByRole('button', { name: '+ Add a day' }));
    pick(3, ['Legs']);
    fireEvent.click(screen.getByRole('button', { name: /build my routine/i }));
    expect(await screen.findByRole('tab', { name: 'Chest + Triceps' }, W)).toBeInTheDocument();
    // S04 lets you remove / replace / add: remove the first exercise via its swap sheet.
    const before = screen.getAllByRole('button', { name: /^reorder/i }).length;
    fireEvent.click(screen.getAllByRole('button', { name: /^swap /i })[0]!);
    const sheet = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(sheet).getByRole('button', { name: /remove/i }));
    await waitFor(
      () => expect(screen.getAllByRole('button', { name: /^reorder/i })).toHaveLength(before - 1),
      W,
    );
    fireEvent.click(screen.getByRole('button', { name: /save routine/i }));
    await waitFor(async () => expect((await activeRoutine()).splitId).toBe('custom'), W);
    expect((await activeRoutine()).sessions.map((s) => s.name)).toEqual([
      'Chest + Triceps',
      'Back + Biceps',
      'Legs',
    ]);
  });
});

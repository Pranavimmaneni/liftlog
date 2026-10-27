import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from '@/db/schema';
import { saveCustomExercise } from '@/db/custom';
import { getActiveSession, logSet, startSession } from '@/db/workout';
import type { RoutineSession } from '@/db/types';

const W = { timeout: 8000 };

async function openWorkout(sessions: RoutineSession[], now = Date.now()) {
  const r = (await db.routines.where('active').equals(1).first())!;
  return startSession({
    routineId: r.id,
    routineSessionId: sessions[0]!.id,
    name: sessions[0]!.name,
    exerciseIds: sessions[0]!.items.map((i) => i.exerciseId),
    now,
  });
}

async function search(text: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Add from list' }, W));
  const sheet = await screen.findByRole('dialog', {}, W);
  fireEvent.change(within(sheet).getByRole('searchbox', { name: 'Search exercises' }), {
    target: { value: text },
  });
  return sheet;
}

describe('M7 screens', () => {
  beforeEach(resetDb);

  it('FR-LIB-8: the add sheet lists matches outside the gym after the gym ones', async () => {
    const sessions = await seedOnboarded();
    const gym = (await db.gym.get('me'))!;
    await db.gym.put({
      ...gym,
      machineIds: gym.machineIds.filter((m) => m !== 'triceps-extension-machine'),
    });
    await openWorkout(sessions);
    renderRoute('/workout');
    const sheet = await search('machine triceps');
    const outside = await within(sheet).findByRole('list', { name: 'Not in your gym' }, W);
    expect(within(outside).getByText('Machine Triceps Extension')).toBeInTheDocument();
  });

  it('FR-LIB-8: a custom exercise is always listed, even when its machine is not in My Gym', async () => {
    const sessions = await seedOnboarded();
    const gym = (await db.gym.get('me'))!;
    await db.gym.put({ ...gym, machineIds: [] });
    await saveCustomExercise({
      name: 'Gym Tricep Press',
      primary: 'triceps',
      secondary: [],
      gear: 'triceps-extension-machine',
      machine: true,
      loadType: 'machine_stack',
      role: 'isolation',
      unilateral: false,
      incrementKg: 5,
      notes: '',
    });
    await openWorkout(sessions);
    renderRoute('/workout');
    const sheet = await search('gym tricep press');
    expect(await within(sheet).findByText('Gym Tricep Press', {}, W)).toBeInTheDocument();
    expect(within(sheet).queryByRole('list', { name: 'Not in your gym' })).toBeNull();
  });

  it('FR-LIB-8: "Create custom exercise" opens the form named after the search', async () => {
    const sessions = await seedOnboarded();
    await openWorkout(sessions);
    const { router } = renderRoute('/workout');
    const sheet = await search('zzz qqq');
    // Looked up again on each try: the sheet re-renders when the library chunk finishes loading.
    await waitFor(() => expect(within(sheet).getByText(/no results for “zzz qqq”/i)).toBeInTheDocument(), W);
    fireEvent.click(within(sheet).getByRole('button', { name: /create custom exercise/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/library/new'), W);
    expect(await screen.findByDisplayValue('zzz qqq', {}, W)).toBeInTheDocument();
  });

  it('FR-WRK-16: Undo right after Start workout removes the workout and returns home', async () => {
    const sessions = await seedOnboarded();
    const queue = await db.queue.get('me');
    await openWorkout(sessions);
    const { router } = renderRoute('/workout');
    expect(await screen.findByText('Workout started.', {}, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo start workout' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'), W);
    expect(await getActiveSession()).toBeUndefined();
    expect(await db.queue.get('me')).toEqual(queue);
  });

  it('FR-WRK-16: no Undo once 10 s have passed; Cancel workout confirms and names the logged sets', async () => {
    const sessions = await seedOnboarded();
    const s = await openWorkout(sessions, Date.now() - 60_000);
    await logSet({
      sessionId: s.id,
      exerciseId: s.plan[0]!.exerciseId,
      idx: 1,
      kind: 'work',
      loadKg: 40,
      reps: 10,
      goalMet: true,
      bonusReps: 0,
    });
    const { router } = renderRoute('/workout');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel workout' }, W));
    expect(screen.queryByText('Workout started.')).toBeNull();
    const sheet = await screen.findByRole('dialog', { name: 'Cancel this workout?' }, W);
    expect(within(sheet).getByText(/its 1 logged set\. up next stays/i)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel workout' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'), W);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });

  it('FR-NAV-1: tabs are Today, Plan, Progress; the Library opens from Plan and Settings', async () => {
    await seedOnboarded();
    const plan = renderRoute('/plan');
    const nav = await screen.findByRole('navigation', { name: 'Main' }, W);
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Today', 'Plan', 'Progress']);
    expect(await screen.findAllByRole('link', { name: /exercise library/i }, W)).toHaveLength(2);
    plan.unmount();
    renderRoute('/settings');
    expect(await screen.findByRole('link', { name: /exercise library/i }, W)).toHaveAttribute(
      'href',
      '/library',
    );
  });
});

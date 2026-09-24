import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from '@/db/schema';
import { startSession } from '@/db/workout';

const W = { timeout: 8000 };

describe('M2 screens', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
  });

  it('FR-RTN-3: the coverage card flags gaps and "+ Fix" adds an exercise', async () => {
    await seedOnboarded({ limitations: [] });
    // Strip the routine down so gaps are certain.
    const r = (await db.routines.where('active').equals(1).first())!;
    await db.routines.put({ ...r, sessions: r.sessions.map((s) => ({ ...s, items: s.items.slice(0, 1) })) });
    renderRoute('/plan/edit/0');
    expect(await screen.findByRole('heading', { name: /hard sets per week/i }, W)).toBeInTheDocument();
    expect(screen.getByText(/\d+ gaps/)).toBeInTheDocument();
    const before = screen.getAllByRole('button', { name: /reorder/i }).length;
    const fixCalves = screen.getByRole('button', { name: /^fix calves/i });
    fireEvent.click(fixCalves);
    expect(await screen.findByText(/^Added .+ to /, {}, W)).toBeInTheDocument();
    // The fix went to the lightest session; open each tab until the count grows.
    const tabs = screen.getAllByRole('tab');
    let grew = false;
    for (const t of tabs) {
      fireEvent.click(t);
      if (screen.getAllByRole('button', { name: /reorder/i }).length > before) grew = true;
    }
    expect(grew).toBe(true);
  });

  it('FR-GYM-2/3: the machine panel stores settings, increment and a photo', async () => {
    const sessions = await seedOnboarded();
    const r = (await db.routines.where('active').equals(1).first())!;
    await startSession({
      routineId: r.id,
      routineSessionId: sessions[0]!.id,
      name: 'Upper A',
      exerciseIds: ['lat-pulldown'],
    });
    renderRoute('/workout/lat-pulldown');
    expect(await screen.findByRole('heading', { name: /your machine/i }, W)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ setting/i }));
    let d = await screen.findByRole('dialog', {}, W);
    fireEvent.change(within(d).getByRole('textbox', { name: 'Name' }), { target: { value: 'Seat' } });
    fireEvent.change(within(d).getByRole('textbox', { name: 'Value' }), { target: { value: '4' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /seat: 4/i }, W)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /seat: 4/i }));
    d = await screen.findByRole('dialog', {}, W);
    fireEvent.change(within(d).getByRole('textbox', { name: 'Value' }), { target: { value: '5' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /seat: 5/i }, W)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /stack/i }));
    d = await screen.findByRole('dialog', {}, W);
    fireEvent.click(
      within(within(d).getByRole('group', { name: 'Stack' })).getByRole('button', { name: /decrease/ }),
    );
    fireEvent.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await db.machineNotes.get('lat-pulldown'))!.incrementKg).toBe(4.5));

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'm.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('machine-photo-input'), { target: { files: [file] } });
    await waitFor(async () => {
      const n = await db.machineNotes.get('lat-pulldown');
      expect(n!.photoBlob ?? n!.photoDataUrl).toBeTruthy();
    }, W);
  });

  it('FR-GYM-4: custom machines can be added and removed in Settings → My gym', async () => {
    await seedOnboarded();
    renderRoute('/settings/gym');
    fireEvent.click(await screen.findByRole('button', { name: /add a machine/i }, W));
    const d = await screen.findByRole('dialog', {}, W);
    fireEvent.change(within(d).getByRole('textbox', { name: /machine name/i }), {
      target: { value: 'Viking press' },
    });
    fireEvent.click(within(d).getByRole('button', { name: /add machine/i }));
    expect(await screen.findByText('Viking press', { exact: true }, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete viking press/i }));
    await waitFor(() => expect(screen.queryByText('Viking press', { exact: true })).not.toBeInTheDocument());
  });
});

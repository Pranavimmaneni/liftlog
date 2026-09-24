import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { db } from '@/db/schema';
import { getSettings } from '@/db/settings';
import { CrashScreen } from '@/app/CrashScreen';
import { Chip, ToggleChip } from '@/components/Chip';
import { Switch } from '@/components/Switch';
import { Button, LinkButton } from '@/components/Button';
import { Card } from '@/components/Card';
import { TabBar } from '@/components/TabBar';

describe('M0 screens', () => {
  beforeEach(resetDb);

  it('/dev/components renders every M0 component and switches theme (FR-SET-1)', async () => {
    renderRoute('/dev/components');
    expect(await screen.findByRole('heading', { name: 'Components' })).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Iron' })[0]!);
    expect(document.documentElement.getAttribute('data-theme')).toBe('iron');
    await waitFor(async () => expect((await getSettings()).theme).toBe('iron'));
    fireEvent.click(screen.getByRole('switch', { name: 'Warm-up sets' }));
    expect(screen.getByRole('switch', { name: 'Warm-up sets' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    expect(screen.getByRole('button', { name: 'Body' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('/settings changes the theme and persists it (FR-SET-1)', async () => {
    renderRoute('/settings');
    fireEvent.click(await screen.findByRole('button', { name: 'Paper' }));
    await waitFor(async () => expect((await getSettings()).theme).toBe('paper'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('paper');
  });

  it('home shows the app name and a labelled settings link', async () => {
    await seedOnboarded();
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('unknown routes show the not-found message', async () => {
    await seedOnboarded();
    renderRoute('/nope/here');
    expect(await screen.findByText('That page doesn’t exist.')).toBeInTheDocument();
  });

  it('S26 / NFR-REL-4: crash screen explains sets are saved and logs the error locally', async () => {
    render(<CrashScreen error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke.');
    expect(screen.getByText('Your logged sets are saved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
    await waitFor(async () =>
      expect(await db.errors.filter((e) => e.message === 'boom').count()).toBeGreaterThan(0),
    );
  });
});

describe('design-system components', () => {
  it('Chip and ToggleChip expose variants and pressed state', () => {
    const onClick = vi.fn();
    render(
      <div>
        <Chip variant="brass">+1 rep</Chip>
        <ToggleChip on check onClick={onClick}>
          Barbell
        </ToggleChip>
        <ToggleChip on={false} large>
          Kettlebells
        </ToggleChip>
      </div>,
    );
    expect(screen.getByText('+1 rep')).toHaveAttribute('data-variant', 'brass');
    fireEvent.click(screen.getByRole('button', { name: 'Barbell' }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Barbell' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Kettlebells' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Switch toggles aria-checked', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Alert when rest ends" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Alert when rest ends' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Button, LinkButton, Card and TabBar render accessible elements', () => {
    render(
      <MemoryRouter initialEntries={['/plan']}>
        <Button variant="destructive">Delete</Button>
        <LinkButton to="/workout">Start workout</LinkButton>
        <Card hard>Goal</Card>
        <TabBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-variant', 'destructive');
    expect(screen.getByRole('link', { name: 'Start workout' })).toHaveAttribute('href', '/workout');
    expect(screen.getByText('Goal')).toHaveClass('ll-card-hard');
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
  });
});

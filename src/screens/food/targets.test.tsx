import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute, resetDb } from '@/test/render';
import { seedOnboarded } from '@/test/seed';
import { saveProfile, saveWeighIn } from '@/db/repo';
import { getRawSetting, setRawSetting } from '@/db/settings';
import { dateKey } from '@/engine/week';
import { FOOD_KEYS } from './hooks';

const W = { timeout: 8000 };

/** The F05 mockup's sample person: 78.4 kg, 178 cm, born 1997, light activity, 4 lifts a week, slow gain. */
async function seedSample() {
  await seedOnboarded();
  await saveProfile({
    sex: 'male',
    birthYear: 1997,
    heightCm: 178,
    activity: 'light',
    diet: { phase: 'gain', rateKgPerWeek: 0.25 },
  });
  await saveWeighIn(dateKey(Date.now()), 78.4);
}

describe('F05 Targets (FR-TGT-1..4, FR-TGT-6)', () => {
  beforeEach(resetDb);

  it('FR-TGT-2/3: the sample person sees 2,950 kcal with its reason and 140 / 440 / 70 g', async () => {
    await seedSample();
    renderRoute('/food/targets');
    expect(await screen.findByText('2,950', {}, W)).toBeInTheDocument();
    expect(screen.getByTestId('target-reason')).toHaveTextContent(
      'You burn about 2,700. Plus 250 to gain slowly.',
    );
    expect(screen.getByRole('button', { name: 'Protein 140 g' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carbs 440 g' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fat 70 g' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /weight\s*78\.4 kg/i })).toBeInTheDocument();
    expect(screen.queryByText(/typical values/i)).toBeNull();
  });

  it('FR-TGT-1: changing the goal to lose lowers the target', async () => {
    await seedSample();
    renderRoute('/food/targets');
    await screen.findByText('2,950', {}, W);
    fireEvent.click(screen.getByRole('button', { name: /^goal/i }));
    const sheet = await screen.findByRole('dialog', { name: 'Goal' }, W);
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Lose' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('target-kcal')).toHaveTextContent('2,400'), W);
    expect(screen.getByTestId('target-reason')).toHaveTextContent('Minus 300 to lose weight.'); // keeps 0.25 kg/week
  });

  it('FR-TGT-4: micronutrients list the 8 targets, sodium as a limit', async () => {
    await seedSample();
    renderRoute('/food/targets');
    fireEvent.click(await screen.findByRole('button', { name: /micronutrients/i }, W));
    const sheet = await screen.findByRole('dialog', { name: 'Micronutrients' }, W);
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(8);
    expect(within(sheet).getByText(/< 2,300 mg/)).toBeInTheDocument();
    expect(within(sheet).getByText('41 g')).toBeInTheDocument();
  });

  it('FR-TGT-6: the training-day carbs toggle persists; Reset clears overrides', async () => {
    await seedSample();
    await setRawSetting(FOOD_KEYS.overrides, { protein: 160 });
    renderRoute('/food/targets');
    expect(await screen.findByRole('button', { name: 'Protein 160 g' }, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /more carbs on training days/i }));
    await waitFor(async () => expect(await getRawSetting(FOOD_KEYS.carbCycling)).toBe(true), W);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByRole('button', { name: 'Protein 140 g' }, W)).toBeInTheDocument();
    expect(await getRawSetting(FOOD_KEYS.overrides)).toEqual({});
  });

  it('FR-TGT-6: a macro can be overridden and reset to the coach’s pick', async () => {
    await seedSample();
    renderRoute('/food/targets');
    fireEvent.click(await screen.findByRole('button', { name: 'Protein 140 g' }, W));
    let sheet = await screen.findByRole('dialog', { name: 'Protein target' }, W);
    fireEvent.click(within(sheet).getByRole('button', { name: /^more/i }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Protein 145 g' }, W)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Protein 145 g' }));
    sheet = await screen.findByRole('dialog', { name: 'Protein target' }, W);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reset to coach’s pick' }));
    expect(await screen.findByRole('button', { name: 'Protein 140 g' }, W)).toBeInTheDocument();
  });

  it('FR-TGT-1: without a weigh-in, asks for one; missing inputs are named', async () => {
    await seedOnboarded();
    const first = renderRoute('/food/targets');
    expect(await screen.findByText('Add a weigh-in to get your targets.', {}, W)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log a weigh-in' })).toBeInTheDocument();
    first.unmount();
    await saveWeighIn(dateKey(Date.now()), 80);
    renderRoute('/food/targets');
    expect(
      await screen.findByText(/typical values for age, height, activity, sex/i, {}, W),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sex and birth year/i })).toHaveAttribute(
      'href',
      '/progress/body-stats',
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { formatStepValue, nextStep, stepFontSize, Stepper } from './Stepper';

function Harness({ start = 26 as number | null, step = 2 }) {
  const [v, setV] = useState<number | null>(start);
  return (
    <Stepper
      value={v}
      onChange={setV}
      step={step}
      unitLabel="kg/hand"
      srLabel="Load"
      srUnit="kilograms per hand"
      emptyStart={20}
    />
  );
}

describe('Stepper (FR-WRK-5, NFR-A11Y-2)', () => {
  it('FR-WRK-5: steps up and down in the exercise increment', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /increase/ }));
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '28');
    fireEvent.click(screen.getByRole('button', { name: /decrease/ }));
    fireEvent.click(screen.getByRole('button', { name: /decrease/ }));
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '24');
  });

  it('NFR-A11Y-2: buttons read like "Load, 26 kilograms per hand, increase"', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Load, 26 kilograms per hand, increase' })).toBeInTheDocument();
  });

  it('FR-WRK-5: tapping the number opens a numeric keypad input', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('spinbutton'));
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(input, { target: { value: '31.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '31.5');
  });

  it('FR-WRK-5: long-press opens the keypad', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.pointerDown(screen.getByRole('spinbutton'), { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('keyboard arrows change the value', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '28');
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowDown' });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '26');
  });

  it('FR-GOAL-4: an empty (calibration) value starts at emptyStart on the first press', () => {
    render(<Harness start={null} />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuetext', 'empty');
    fireEvent.click(screen.getByRole('button', { name: /increase/ }));
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '20');
  });

  it('snaps off-grid values to the step grid', () => {
    expect(nextStep(26, 2, 1)).toBe(28);
    expect(nextStep(25.3, 2.5, 1)).toBe(27.5);
    expect(nextStep(25.3, 2.5, -1)).toBe(25);
    expect(nextStep(10, 0, 1)).toBe(10);
  });

  it('FR-WRK-5a: typing 122.5 keeps every digit; − and + step aside while typing', () => {
    render(<Harness start={22} step={2.5} />);
    fireEvent.click(screen.getByRole('spinbutton'));
    expect(screen.queryByRole('button', { name: /increase|decrease/ })).toBeNull();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '122.5' } });
    expect(input).toHaveValue('122.5');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '122.5');
    expect(screen.getByRole('button', { name: /increase/ })).toBeInTheDocument();
  });

  it('FR-WRK-5a: longer numbers use a smaller size so they fit between − and +', () => {
    expect(stepFontSize('22')).toBe(32);
    expect(stepFontSize('22.5')).toBe(28);
    expect(stepFontSize('122.5')).toBe(24);
    expect(stepFontSize('1122.5')).toBe(20);
  });

  it('formats values without trailing zeros', () => {
    expect(formatStepValue(26)).toBe('26');
    expect(formatStepValue(22.5)).toBe('22.5');
    expect(formatStepValue(null)).toBe('–');
  });
});

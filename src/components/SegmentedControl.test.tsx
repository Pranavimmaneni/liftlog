import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('marks the selected option pressed and reports changes', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Theme"
        value="paper"
        onChange={onChange}
        options={[
          { value: 'system', label: 'System' },
          { value: 'paper', label: 'Paper' },
          { value: 'iron', label: 'Iron' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Paper' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Iron' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Iron' }));
    expect(onChange).toHaveBeenCalledWith('iron');
  });
});

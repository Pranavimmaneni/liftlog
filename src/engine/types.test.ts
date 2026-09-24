import { describe, expect, it } from 'vitest';
import machines from '@/data/machines.json';
import { EXPERIENCES, GOAL_KINDS, MUSCLE_GROUPS } from './types';

describe('engine vocabulary (FR-LIB-2)', () => {
  it('uses exactly the 13 muscle groups from data/machines.json', () => {
    expect([...MUSCLE_GROUPS]).toEqual(machines.muscleGroups);
  });

  it('has three experience levels and four goals (FR-ONB-2)', () => {
    expect(EXPERIENCES).toEqual(['beginner', 'intermediate', 'advanced']);
    expect(GOAL_KINDS).toHaveLength(4);
  });
});

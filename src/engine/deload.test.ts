import { describe, expect, it } from 'vitest';
import { deloadStatus, isScheduledDeload } from './deload';

describe('deload (FR-PRG-7)', () => {
  it('FR-PRG-7: every N weeks by level (intermediate 6, advanced 5, beginner never)', () => {
    expect([6, 7, 14].map((w) => isScheduledDeload(w, 'intermediate'))).toEqual([false, true, true]);
    expect([5, 6, 12].map((w) => isScheduledDeload(w, 'advanced'))).toEqual([false, true, true]);
    expect([1, 7, 100].some((w) => isScheduledDeload(w, 'beginner'))).toBe(false);
    expect(isScheduledDeload(0, 'intermediate')).toBe(false);
  });

  it('FR-PRG-7: announced the week before a scheduled deload', () => {
    expect(deloadStatus({ level: 'intermediate', week: 6, stalledAtWeekStart: 0, stalledNow: 0 })).toEqual({
      thisWeek: false,
      nextWeek: true,
      reason: 'scheduled',
    });
    expect(deloadStatus({ level: 'intermediate', week: 7, stalledAtWeekStart: 0, stalledNow: 0 })).toEqual({
      thisWeek: true,
      nextWeek: false,
      reason: 'scheduled',
    });
  });

  it('FR-PRG-7: 3 or more stalled exercises trigger a deload the following week', () => {
    expect(deloadStatus({ level: 'beginner', week: 3, stalledAtWeekStart: 1, stalledNow: 3 })).toMatchObject({
      thisWeek: false,
      nextWeek: true,
      reason: 'stalls',
    });
    expect(deloadStatus({ level: 'beginner', week: 4, stalledAtWeekStart: 3, stalledNow: 3 })).toMatchObject({
      thisWeek: true,
      reason: 'stalls',
    });
    expect(deloadStatus({ level: 'beginner', week: 4, stalledAtWeekStart: 2, stalledNow: 2 })).toEqual({
      thisWeek: false,
      nextWeek: false,
      reason: null,
    });
  });

  it('D53: no stall deload within 3 weeks of the last one', () => {
    expect(
      deloadStatus({ level: 'beginner', week: 5, stalledAtWeekStart: 4, stalledNow: 4, lastDeloadWeek: 4 }),
    ).toMatchObject({ thisWeek: false, nextWeek: false });
    expect(
      deloadStatus({ level: 'beginner', week: 8, stalledAtWeekStart: 4, stalledNow: 4, lastDeloadWeek: 4 }),
    ).toMatchObject({ thisWeek: true });
  });
});

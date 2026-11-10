import { describe, expect, it } from 'vitest';
import { celebrateOncePerDay, goalsReached, mergeCelebrations, newlyReached } from './echo';

const targets = { kcal: 2000, protein: 140, carbs: 250, fat: 70 };

describe('Echo rules (FR-DSN-8)', () => {
  it('FR-DSN-8: calories and protein are reached from 90% of the target, carbs and fat at the target', () => {
    expect(goalsReached({ kcal: 1799, protein: 125, carbs: 249, fat: 69 }, targets)).toEqual([]);
    expect(goalsReached({ kcal: 1800, protein: 126, carbs: 250, fat: 70 }, targets)).toEqual([
      'kcal',
      'protein',
      'carbs',
      'fat',
    ]);
  });

  it('FR-DSN-8: a goal without a target is never reached', () => {
    expect(goalsReached({ kcal: 500, protein: 50 }, {})).toEqual([]);
    expect(goalsReached({ protein: 200 }, { protein: 0 })).toEqual([]);
  });

  it('FR-DSN-8: only goals crossed by this entry count as newly reached', () => {
    const before = { kcal: 1700, protein: 130, carbs: 100, fat: 30 };
    const after = { kcal: 1900, protein: 150, carbs: 120, fat: 40 };
    expect(newlyReached(before, after, targets)).toEqual(['kcal']);
    expect(newlyReached(after, after, targets)).toEqual([]);
  });

  it('FR-DSN-8: each goal celebrates once per day and again the next day', () => {
    const first = celebrateOncePerDay(null, '2026-11-10', ['kcal', 'protein']);
    expect(first.fresh).toEqual(['kcal', 'protein']);
    const second = celebrateOncePerDay(first.next, '2026-11-10', ['protein', 'fat']);
    expect(second.fresh).toEqual(['fat']);
    expect(second.next.keys).toEqual(['kcal', 'protein', 'fat']);
    const tomorrow = celebrateOncePerDay(second.next, '2026-11-11', ['protein']);
    expect(tomorrow.fresh).toEqual(['protein']);
    expect(tomorrow.next).toEqual({ date: '2026-11-11', keys: ['protein'] });
  });

  it('FR-DSN-8: celebrations that fire together show as one, listing every line once', () => {
    const one = mergeCelebrations(null, { title: 'New record', lines: ['Bench Press · 67.5 kg × 10'] });
    const two = mergeCelebrations(one, { title: 'Goal reached', lines: ['Protein for today'] });
    expect(two).toEqual({ title: 'New record', lines: ['Bench Press · 67.5 kg × 10', 'Protein for today'] });
    expect(mergeCelebrations(two, { title: 'x', lines: ['Protein for today'] }).lines).toHaveLength(2);
  });
});

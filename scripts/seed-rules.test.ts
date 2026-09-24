import { describe, expect, it } from 'vitest';
import exercises from '../src/data/exercises.json';
import machines from '../data/machines.json';
import aliases from '../data/aliases.json';
import {
  cleanText,
  DROP_RULES,
  isUnilateral,
  limitationAreasFor,
  loadTypeFor,
  mapMuscles,
  patternFor,
  requiresFor,
  roleFor,
  slug,
} from './seed-rules';
import type { Exercise } from '../src/engine/types';

const all = exercises as Exercise[];
const byName = new Map(all.map((e) => [e.name, e]));

describe('seed rules (FR-LIB-1, FR-LIB-2)', () => {
  it('FR-LIB-1: ships 400–600 exercises with unique ids', () => {
    expect(all.length).toBeGreaterThanOrEqual(400);
    expect(all.length).toBeLessThanOrEqual(600);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });

  it('FR-LIB-2: every exercise has the required fields', () => {
    for (const e of all) {
      expect(e.primary.length, e.name).toBeGreaterThan(0);
      expect(['compound', 'isolation']).toContain(e.role);
      expect(e.instructions.length, e.name).toBeGreaterThan(0);
      expect(Array.isArray(e.limitationAreas)).toBe(true);
      expect(['beginner', 'intermediate', 'advanced']).toContain(e.level);
    }
  });

  it('every machines.json exercise and aliases.json key resolves', () => {
    const find = (n: string) =>
      all.find((e) => e.name.toLowerCase() === n.toLowerCase() || e.aliases.includes(n.toLowerCase()));
    for (const m of machines.machines) for (const n of m.exercises) expect(find(n), n).toBeDefined();
    for (const n of Object.keys(aliases.aliases)) expect(find(n), n).toBeDefined();
  });

  it('the 10 Tier 1 poses are attached to their exercises', () => {
    expect(
      all
        .filter((e) => e.poseId)
        .map((e) => e.poseId)
        .sort(),
    ).toEqual([
      'back-squat',
      'incline-db-press',
      'lat-pulldown',
      'leg-press',
      'machine-shoulder-press',
      'pull-up',
      'romanian-deadlift',
      'rope-pushdown',
      'seated-cable-row',
      'seated-leg-curl',
    ]);
  });

  it('maps dataset muscles to the 13 groups', () => {
    expect(mapMuscles(['quadriceps', 'middle back', 'traps', 'neck', 'abdominals', 'adductors'])).toEqual([
      'quads',
      'upper back',
      'abs',
    ]);
  });

  it.each([
    ['Back Squat', 'squat'],
    ['Leg Press', 'leg_press_or_lunge'],
    ['Leg Press Calf Raise', 'calf_raise'],
    ['Bulgarian Split Squat', 'leg_press_or_lunge'],
    ['Incline Dumbbell Press', 'incline_press'],
    ['Incline Dumbbell Curl', 'elbow_flexion'],
    ['Seated Leg Curl', 'knee_flexion'],
    ['Lat Pulldown', 'vertical_pull'],
    ['Seated Cable Row', 'horizontal_pull'],
    ['Face Pull', 'rear_delt'],
    ['Rope Pushdown', 'elbow_extension'],
    ['Romanian Deadlift', 'hinge'],
    ['Hip Thrust', 'hip_extension'],
    ['Overhead Press', 'overhead_press'],
    ['Bench Press', 'horizontal_press'],
    ['Cable Fly', 'chest_fly'],
    ['Plank', 'core_antiextension'],
    ['Crunch', 'core_flexion'],
    ["Farmer's Carry", 'carry'],
    ['Hip Abduction', 'hip_abduction'],
    ['Barbell Shrug', null],
  ])('pattern: %s → %s', (name, pattern) => {
    expect(patternFor(name)).toBe(pattern);
  });

  it('roles: compounds for multi-joint patterns, isolation for raises and curls', () => {
    expect(roleFor('squat', 'compound', 'Back Squat')).toBe('compound');
    expect(roleFor('lateral_raise', 'compound', 'Dumbbell Lateral Raise')).toBe('isolation');
    expect(roleFor('elbow_extension', 'compound', 'Dip')).toBe('compound');
    expect(roleFor('hip_extension', 'compound', 'Hip Thrust')).toBe('compound');
    expect(roleFor(null, 'compound', 'Barbell Shrug')).toBe('compound');
    expect(roleFor(null, null, 'Something')).toBe('isolation');
  });

  it('§6.1 load types: dumbbell per hand, assisted, bodyweight stations, machines, timed', () => {
    expect(byName.get('Incline Dumbbell Press')!.loadType).toBe('dumbbell');
    expect(byName.get('Assisted Pull-Up')!.loadType).toBe('assisted');
    expect(byName.get('Pull-Up')!.loadType).toBe('bodyweight');
    expect(byName.get('Pull-Up')!.machineId).toBeUndefined();
    expect(byName.get('Lat Pulldown')!.loadType).toBe('machine_stack');
    expect(byName.get('Leg Press')!.loadType).toBe('plate_loaded');
    expect(byName.get('Plank')!.loadType).toBe('timed');
    expect(loadTypeFor('Kettlebell Row', 'kettlebells', undefined)).toBe('kettlebell');
    expect(loadTypeFor('Some Machine', 'machine', undefined)).toBe('machine_stack');
  });

  it('D11 requirements: AND of OR-groups', () => {
    expect(requiresFor('Incline Dumbbell Press', 'dumbbell', undefined)).toEqual([
      ['dumbbells'],
      ['adjustable-bench'],
    ]);
    expect(requiresFor('Cable Fly', 'cable', 'cable-tower')).toEqual([['cable-tower', 'functional-trainer']]);
    expect(requiresFor('Back Squat', 'barbell', undefined)).toEqual([['barbell'], ['squat-rack']]);
    expect(requiresFor('Pull-Up', 'body only', undefined)).toEqual([['pullup-bar']]);
    expect(requiresFor('Goblet Squat', 'kettlebells', undefined)).toEqual([['kettlebells', 'dumbbells']]);
    expect(requiresFor('Crunch', 'body only', undefined)).toEqual([]);
  });

  it('D18 limitation areas', () => {
    expect(limitationAreasFor('Back Squat', 'squat', 'barbell')).toEqual(['knees', 'lower back']);
    expect(limitationAreasFor('Overhead Press', 'overhead_press', 'barbell')).toEqual(['shoulders']);
    expect(limitationAreasFor('Push-Up', 'horizontal_press', 'body only')).toEqual(['wrists']);
    expect(limitationAreasFor('Chest-Supported T-Bar Row', 'horizontal_pull', 'machine')).toEqual([]);
    expect(limitationAreasFor('Bent-Over Barbell Row', 'horizontal_pull', 'barbell')).toEqual(['lower back']);
  });

  it('unilateral flags', () => {
    expect(isUnilateral('Single-Arm Dumbbell Row')).toBe(true);
    expect(isUnilateral('Bulgarian Split Squat')).toBe(true);
    expect(isUnilateral('Bench Press')).toBe(false);
  });

  it('drop rules catch ballistic lifts and banded variations', () => {
    const dropped = (n: string) => DROP_RULES.some((d) => d.re.test(n));
    expect(dropped('One-Arm Kettlebell Swings')).toBe(true);
    expect(dropped('Deadlift with Chains')).toBe(true);
    expect(dropped('Pin Presses')).toBe(true);
    expect(dropped('Romanian Deadlift')).toBe(false);
  });

  it('text helpers', () => {
    expect(slug("Farmer's Carry")).toBe('farmers-carry');
    expect(slug('45° Leg Press')).toBe('45-leg-press');
    expect(cleanText('  go  � of the way .')).toBe('go ¾ of the way.');
  });
});

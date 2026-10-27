import { describe, expect, it } from 'vitest';
import exercises from '../src/data/exercises.json';
import machines from '../data/machines.json';
import aliases from '../data/aliases.json';
import {
  cleanText,
  DROP_RULES,
  INCLUDE_ANYWAY,
  M8_INCLUDE,
  RENAMES,
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
import { M8_CUSTOM_SEEDS } from './seed-custom';

const all = exercises as Exercise[];
const byName = new Map(all.map((e) => [e.name, e]));

describe('seed rules (FR-LIB-1, FR-LIB-2)', () => {
  it('FR-LIB-9: ships 600 or more exercises with unique ids (FR-LIB-1 range raised)', () => {
    expect(all.length).toBeGreaterThanOrEqual(600);
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

  describe('FR-LIB-9: M8 additions', () => {
    it('every M8 dataset row and custom seed ships, once', () => {
      for (const n of Object.keys(M8_INCLUDE)) expect(byName.has(RENAMES[n] ?? n), n).toBe(true);
      for (const c of M8_CUSTOM_SEEDS) expect(byName.has(c.name), c.name).toBe(true);
      expect(INCLUDE_ANYWAY['Trap Bar Deadlift']).toBe('trap bar');
    });

    it.each([
      ['Power Clean', null],
      ['Kettlebell Swing', null],
      ['Barbell Thruster', null],
      ['Box Jump', null],
      ['Scapular Pull-Up', null],
      ['Clean Deadlift', 'hinge'],
      ['Snatch-Grip Deadlift', 'hinge'],
      ['Push Press', 'overhead_press'],
      ['Handstand Push-Up', 'overhead_press'],
      ['Z Press', 'overhead_press'],
      ['Landmine Press', 'overhead_press'],
      ['Weighted Dip', 'elbow_extension'],
      ['Barbell 21s', 'elbow_flexion'],
      ['Incline T-Raise', 'rear_delt'],
      ['Cable Y-Raise', 'lateral_raise'],
      ['Side-Lying Leg Raise', 'hip_abduction'],
      ['Cossack Squat', 'leg_press_or_lunge'],
      ['Reverse Nordic', 'knee_extension'],
      ['Bird Dog', 'core_antiextension'],
      ['Toes-to-Bar', 'core_flexion'],
      ['Kneeling High Pulley Row', 'horizontal_pull'],
    ])('pattern: %s → %s', (name, pattern) => {
      expect(patternFor(name)).toBe(pattern);
    });

    it('load types for holds, weighted bodyweight lifts and donkey calf raises', () => {
      expect(byName.get('Side Plank')!.loadType).toBe('timed');
      expect(byName.get('Dead Hang')!.loadType).toBe('timed');
      expect(byName.get('Plank Shoulder Tap')!.loadType).toBe('bodyweight');
      expect(byName.get('Weighted Pull-Up')!.loadType).toBe('bodyweight_plus');
      expect(byName.get('Weighted Dip')!.loadType).toBe('bodyweight_plus');
      expect(byName.get('Donkey Calf Raise')!.machineId).toBe('standing-calf');
    });

    it('requirements for the new bodyweight, landmine and machine lifts', () => {
      expect(requiresFor('Toes-to-Bar', 'body only', undefined)).toEqual([['pullup-bar']]);
      expect(requiresFor('Weighted Dip', 'body only', undefined)).toEqual([['dip-station']]);
      expect(requiresFor('Inverted Row', 'body only', undefined)).toEqual([['squat-rack', 'smith-machine']]);
      expect(requiresFor('Side-Lying Leg Raise', 'body only', undefined)).toEqual([]);
      expect(requiresFor('Landmine Squat', 'barbell', undefined)).toEqual([['barbell']]);
      expect(requiresFor('Pin Press', 'barbell', undefined)).toEqual([
        ['barbell'],
        ['flat-bench', 'adjustable-bench'],
        ['squat-rack'],
      ]);
      expect(requiresFor('Machine Pullover', 'machine', undefined)).toEqual([]);
    });

    it('limitation areas and unilateral flags', () => {
      expect(limitationAreasFor('Power Clean', null, 'barbell')).toEqual(['lower back', 'wrists']);
      expect(limitationAreasFor('Snatch', null, 'barbell')).toEqual(['lower back', 'shoulders']);
      expect(limitationAreasFor('Box Jump', null, 'body only')).toEqual(['knees']);
      expect(limitationAreasFor('Kneeling High Pulley Row', 'horizontal_pull', 'cable')).toEqual([]);
      expect(isUnilateral('Side Plank')).toBe(true);
      expect(isUnilateral('Push Up to Side Plank')).toBe(false);
      expect(isUnilateral('Pistol Squat')).toBe(true);
    });
  });
});

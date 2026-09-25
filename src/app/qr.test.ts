import { describe, expect, it } from 'vitest';
import { exerciseForMachine, parseMachineCode, stickerUrl } from './qr';
import type { Exercise } from '@/engine/types';

describe('S22 QR payloads', () => {
  it('sticker URLs point at the web fallback route', () => {
    expect(stickerUrl('lat-pulldown', 'https://liftlog-jade.vercel.app/')).toBe(
      'https://liftlog-jade.vercel.app/m/lat-pulldown',
    );
  });

  it('parses both payload forms and rejects anything else', () => {
    expect(parseMachineCode('liftlog://machine/leg-press')).toBe('leg-press');
    expect(parseMachineCode(' https://liftlog-jade.vercel.app/m/leg-press ')).toBe('leg-press');
    expect(parseMachineCode('http://localhost:4173/m/cable-tower', 'http://localhost:4173')).toBe(
      'cable-tower',
    );
    expect(parseMachineCode('https://example.com/m/leg-press', 'https://liftlog-jade.vercel.app')).toBeNull();
    expect(parseMachineCode('https://liftlog-jade.vercel.app/library/leg-press')).toBeNull();
    expect(parseMachineCode('liftlog://machine/../../etc')).toBeNull();
    expect(parseMachineCode('hello')).toBeNull();
    expect(parseMachineCode('liftlog://machine/Custom-ABC')).toBeNull();
  });

  it('opens a routine exercise on that machine first', () => {
    const ex = (id: string, machineId: string, extra: Partial<Exercise> = {}) =>
      ({ id, machineId, deleted: false, isCustom: false, ...extra }) as Exercise;
    const list = [
      ex('a', 'm1'),
      ex('b', 'm1'),
      ex('c', 'm1', { deleted: true }),
      ex('d', 'm2', { isCustom: true }),
    ];
    expect(exerciseForMachine('m1', list, ['b'])!.id).toBe('b');
    expect(exerciseForMachine('m1', list, [])!.id).toBe('a');
    expect(exerciseForMachine('m2', list, [])!.id).toBe('d');
    expect(exerciseForMachine('m3', list, [])).toBeUndefined();
  });
});

/**
 * S22 QR payloads (PRD §4.1): `liftlog://machine/<machineId>`, with the web fallback `/m/<machineId>`.
 * Stickers encode the web URL so a phone's own camera can open them too (DECISIONS D70); the in-app
 * scanner accepts both forms.
 */
import type { Exercise } from '@/engine/types';

const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function stickerUrl(machineId: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/m/${encodeURIComponent(machineId)}`;
}

/** Machine id from a scanned code, or null when it isn't a LiftLog sticker. */
export function parseMachineCode(raw: string, origin?: string): string | null {
  const s = raw.trim();
  let id: string | null = null;
  const app = /^liftlog:\/\/machine\/([^/?#]+)$/i.exec(s);
  if (app) id = decodeURIComponent(app[1]!);
  else {
    try {
      const u = new URL(s);
      const m = /^\/m\/([^/?#]+)\/?$/.exec(u.pathname);
      if (m && (!origin || u.origin === origin || /liftlog/i.test(u.hostname)))
        id = decodeURIComponent(m[1]!);
    } catch {
      return null;
    }
  }
  return id && ID.test(id) ? id : null;
}

/** The exercise a sticker opens: one in the routine first, then any library exercise on that machine. */
export function exerciseForMachine(
  machineId: string,
  exercises: Iterable<Exercise>,
  routineIds: string[],
): Exercise | undefined {
  const onMachine = [...exercises].filter((e) => !e.deleted && e.machineId === machineId);
  return (
    onMachine.find((e) => routineIds.includes(e.id)) ?? onMachine.find((e) => !e.isCustom) ?? onMachine[0]
  );
}

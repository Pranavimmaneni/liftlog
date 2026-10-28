import { z } from 'zod';
import { db, SCHEMA_VERSION, USER_TABLES } from './schema';

/**
 * FR-DATA-1/3, NFR-REL-2, NFR-SEC-2: full backup of every table to `liftlog-YYYY-MM-DD.liftlog.json`.
 * Blobs (machine photos) are stored as base64 data. Import validates with zod before touching the DB.
 * Schema v2 (PRD-1.2 FR-SHR-2): the Food tables are included; the food library (`foodLib`) is not,
 * because it is rebuilt from the bundled chunks.
 */

export const BACKUP_APP = 'liftlog';
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

type TableName = (typeof USER_TABLES)[number];

interface EncodedBlob {
  __blob: true;
  type: string;
  base64: string;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<TableName, Record<string, unknown>[]>>;
}

/** Duck-typed: blobs read back from IndexedDB aren't always instances of this realm's Blob. */
export function isBlob(v: unknown): v is Blob {
  if (typeof Blob !== 'undefined' && v instanceof Blob) return true;
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Blob).arrayBuffer === 'function' &&
    typeof (v as Blob).size === 'number' &&
    typeof (v as Blob).type === 'string'
  );
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(s);
}

export function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function encodeRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (isBlob(v))
      out[k] = { __blob: true, type: v.type, base64: await blobToBase64(v) } satisfies EncodedBlob;
    else out[k] = v;
  }
  return out;
}

function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'object' && (v as EncodedBlob).__blob === true) {
      const e = v as EncodedBlob;
      out[k] = base64ToBlob(e.base64, e.type);
    } else out[k] = v;
  }
  return out;
}

export function backupFileName(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `liftlog-${y}-${m}-${day}.liftlog.json`;
}

export async function buildBackup(now = new Date()): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  await db.transaction(
    'r',
    USER_TABLES.map((t) => db.table(t)),
    async () => {
      for (const t of USER_TABLES) {
        const rows = (await db.table(t).toArray()) as Record<string, unknown>[];
        tables[t] = rows;
      }
    },
  );
  for (const t of USER_TABLES) {
    tables[t] = await Promise.all((tables[t] ?? []).map(encodeRow));
  }
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), tables };
}

/** Serialises every table and records `lastBackupAt` (FR-DATA-1). */
export async function exportBackupBlob(now = new Date()): Promise<{ name: string; blob: Blob }> {
  // Written first so the file itself carries the backup time (round-trips byte-equal).
  await db.meta.put({ key: 'lastBackupAt', value: now.getTime() });
  const data = await buildBackup(now);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  return { name: backupFileName(now), blob };
}

// ---------- validation (zod) ----------

const num = z.number().finite();
const str = z.string();
const rowObj = z.record(z.string(), z.unknown());

const setSchema = z
  .object({
    id: str,
    sessionId: str,
    exerciseId: str,
    idx: num,
    kind: z.enum(['warmup', 'work', 'extra']),
    loadKg: num,
    reps: num,
    hurts: z.boolean(),
    goalMet: z.boolean(),
    bonusReps: num,
    loggedAt: num,
  })
  .passthrough();

const sessionSchema = z
  .object({ id: str, startedAt: num, routineSessionId: str, calibration: z.boolean(), deload: z.boolean() })
  .passthrough();

const bodyweightSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kg: num }).passthrough();

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nutrients = z.record(z.string(), num.nullable());
const portion = z.object({ label: str, grams: num }).passthrough();

const diarySchema = z
  .object({
    id: str,
    date,
    meal: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
    loggedAt: num,
    foodId: str,
    name: str,
    portion,
    servings: num,
    grams: num,
    per100g: nutrients,
  })
  .passthrough();

const foodSchema = z
  .object({
    id: str,
    name: str,
    per100g: nutrients,
    portions: z.array(portion),
    isRecipe: z.union([z.literal(0), z.literal(1)]),
  })
  .passthrough();

const fastSchema = z.object({ id: str, startedAt: num, planHours: num }).passthrough();

const TABLE_SCHEMAS: Partial<Record<TableName, z.ZodType>> = {
  sets: setSchema,
  sessions: sessionSchema,
  bodyweights: bodyweightSchema,
  diary: diarySchema,
  foods: foodSchema,
  fasts: fastSchema,
};

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(rowObj)),
});

export interface BackupPreview {
  schemaVersion: number;
  exportedAt: string;
  sessions: number;
  sets: number;
  firstSessionAt: number | null;
  lastSessionAt: number | null;
}

export type ParseResult =
  { ok: true; backup: BackupFile; preview: BackupPreview } | { ok: false; error: string };

/**
 * Migrates older backup files forward, one schema version at a time (FR-DATA-3).
 * v1 → v2 (NFR-REL-6): v2 only added the Food tables, so a v1 file gets empty ones and every v1 row
 * stays byte-equal.
 */
export function migrateBackup(b: BackupFile): BackupFile {
  let out: BackupFile = { ...b, tables: { ...b.tables } };
  for (let v = b.schemaVersion; v < SCHEMA_VERSION; v++) {
    switch (v) {
      case 1:
        out = {
          ...out,
          tables: { foods: [], diary: [], savedMeals: [], fasts: [], ...out.tables },
        };
        break;
    }
  }
  return { ...out, schemaVersion: SCHEMA_VERSION };
}

export function parseBackup(text: string, byteSize = text.length): ParseResult {
  if (byteSize > MAX_BACKUP_BYTES) return { ok: false, error: 'too-big' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: 'not-liftlog' };
  const b = parsed.data as BackupFile;
  if (b.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'newer-version' };
  for (const [t, rows] of Object.entries(b.tables)) {
    if (!(USER_TABLES as string[]).includes(t)) return { ok: false, error: 'unknown-table' };
    const schema = TABLE_SCHEMAS[t as TableName];
    if (schema) {
      for (const r of rows ?? [])
        if (!schema.safeParse(r).success) return { ok: false, error: `bad-row:${t}` };
    }
  }
  const migrated = migrateBackup(b);
  const sessions = (migrated.tables.sessions ?? []) as { startedAt: number }[];
  const starts = sessions.map((s) => s.startedAt).sort((a, b2) => a - b2);
  return {
    ok: true,
    backup: migrated,
    preview: {
      schemaVersion: b.schemaVersion,
      exportedAt: b.exportedAt,
      sessions: sessions.length,
      sets: (migrated.tables.sets ?? []).length,
      firstSessionAt: starts[0] ?? null,
      lastSessionAt: starts[starts.length - 1] ?? null,
    },
  };
}

/**
 * FR-DATA-3: replace wipes every table first; merge adds rows that don't exist locally
 * (by primary key; bodyweights de-duplicate by date).
 */
export async function restoreBackup(backup: BackupFile, mode: 'replace' | 'merge'): Promise<void> {
  const decoded: Partial<Record<TableName, Record<string, unknown>[]>> = {};
  for (const t of USER_TABLES) decoded[t] = (backup.tables[t] ?? []).map(decodeRow);

  await db.transaction(
    'rw',
    USER_TABLES.map((t) => db.table(t)),
    async () => {
      if (mode === 'replace') {
        for (const t of USER_TABLES) await db.table(t).clear();
        for (const t of USER_TABLES) {
          const rows = decoded[t] ?? [];
          if (rows.length) await db.table(t).bulkAdd(rows);
        }
        await db.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
        return;
      }
      for (const t of USER_TABLES) {
        const rows = decoded[t] ?? [];
        if (!rows.length || t === 'errors') continue;
        const table = db.table(t);
        if (t === 'bodyweights') {
          const have = new Set((await db.bodyweights.toArray()).map((r) => r.date));
          const add = rows.filter((r) => !have.has(r.date as string)).map(({ id: _id, ...r }) => r);
          if (add.length) await table.bulkAdd(add);
          continue;
        }
        if (t === 'goalChanges' || t === 'prs') {
          // auto-increment tables: rebuilt/appended without ids
          const pk = t === 'prs' ? 'setId' : 'at';
          const existing = new Set(
            (await table.toArray()).map((r: Record<string, unknown>) => `${r.exerciseId}|${r[pk]}`),
          );
          const add = rows
            .filter((r) => !existing.has(`${r.exerciseId}|${r[pk]}`))
            .map(({ id: _id, ...r }) => r);
          if (add.length) await table.bulkAdd(add);
          continue;
        }
        const keyPath = table.schema.primKey.keyPath as string;
        // Local rows win when the same key exists on both sides (profile, gym, settings, sessions…).
        for (const r of rows) {
          if (!(await table.get(r[keyPath] as string))) await table.add(r);
        }
      }
    },
  );
}

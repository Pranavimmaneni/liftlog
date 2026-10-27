import { beforeEach, describe, expect, it } from 'vitest';
import { db, SCHEMA_VERSION, USER_TABLES } from './schema';
import {
  backupFileName,
  base64ToBlob,
  blobToBase64,
  isBlob,
  buildBackup,
  exportBackupBlob,
  MAX_BACKUP_BYTES,
  parseBackup,
  restoreBackup,
} from './backup';
import { logError, MAX_ERRORS } from './errors';

async function clearAll() {
  for (const t of USER_TABLES) await db.table(t).clear();
}

async function seed() {
  await db.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  await db.profile.put({
    id: 'me',
    experience: 'intermediate',
    goal: 'build_muscle',
    daysPerWeek: 4,
    nudge: 0,
    units: 'kg',
    limitations: [],
  });
  await db.bodyweights.add({ date: '2026-09-20', kg: 78.4 });
  await db.sessions.put({
    id: 's1',
    startedAt: 1_000,
    endedAt: 2_000,
    routineSessionId: 'r1-0',
    name: 'Upper A',
    calibration: false,
    deload: false,
    plan: [],
  });
  await db.sets.put({
    id: 'x1',
    sessionId: 's1',
    exerciseId: 'lat-pulldown',
    idx: 1,
    kind: 'work',
    loadKg: 55,
    reps: 10,
    hurts: false,
    goalMet: true,
    bonusReps: 0,
    loggedAt: 1_500,
  });
  await db.machineNotes.put({
    machineId: 'lat-pulldown',
    settings: { Seat: '4' },
    photoBlob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }),
  });
  await db.goalChanges.add({
    exerciseId: 'lat-pulldown',
    from: { sets: 3, repMin: 8, repMax: 10, loadKg: 50 },
    to: { sets: 3, repMin: 8, repMax: 10, loadKg: 55 },
    reason: 'Up',
    at: 1_600,
    overridden: false,
  });
}

describe('backup (FR-DATA-1/3, NFR-REL-2, NFR-SEC-2)', () => {
  beforeEach(clearAll);

  it('FR-DATA-1: file name is liftlog-YYYY-MM-DD.liftlog.json', () => {
    expect(backupFileName(new Date(2026, 8, 4))).toBe('liftlog-2026-09-04.liftlog.json');
  });

  it('base64 round-trips binary blobs', async () => {
    const b = new Blob([new Uint8Array([0, 255, 17])], { type: 'image/jpeg' });
    const back = base64ToBlob(await blobToBase64(b), 'image/jpeg');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(new Uint8Array([0, 255, 17]));
  });

  it('NFR-REL-2: export → delete → import restores identical data', async () => {
    await seed();
    const { blob } = await exportBackupBlob(new Date(0));
    const before = await buildBackup(new Date(0));
    expect((await db.meta.get('lastBackupAt'))?.value).toBe(0);
    await clearAll();
    const parsed = parseBackup(await blob.text());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.preview.sessions).toBe(1);
    expect(parsed.preview.sets).toBe(1);
    expect(parsed.preview.firstSessionAt).toBe(1_000);
    await restoreBackup(parsed.backup, 'replace');
    const after = await buildBackup(new Date(0));
    expect(JSON.stringify(after.tables)).toBe(JSON.stringify(before.tables));
    const note = await db.machineNotes.get('lat-pulldown');
    expect(isBlob(note?.photoBlob)).toBe(true);
    expect(new Uint8Array(await note!.photoBlob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 250]));
    expect(JSON.stringify(before.tables.machineNotes)).toContain('base64');
  });

  it('FR-DATA-3: merge keeps local rows and adds the missing ones', async () => {
    await seed();
    const { blob } = await exportBackupBlob();
    await db.sets.clear();
    await db.bodyweights.clear();
    await db.bodyweights.add({ date: '2026-09-21', kg: 78 });
    const parsed = parseBackup(await blob.text());
    if (!parsed.ok) throw new Error(parsed.error);
    await restoreBackup(parsed.backup, 'merge');
    expect(await db.sets.count()).toBe(1);
    expect(await db.bodyweights.count()).toBe(2);
    await restoreBackup(parsed.backup, 'merge');
    expect(await db.bodyweights.count()).toBe(2);
    expect(await db.goalChanges.count()).toBe(1);
  });

  it('NFR-SEC-2: rejects non-JSON, foreign JSON, bad rows, newer versions and oversize files', () => {
    expect(parseBackup('nope')).toEqual({ ok: false, error: 'not-json' });
    expect(parseBackup('{"hello":1}')).toEqual({ ok: false, error: 'not-liftlog' });
    const good = { app: 'liftlog', schemaVersion: 1, exportedAt: 'x', tables: { sets: [{ id: 1 }] } };
    expect(parseBackup(JSON.stringify(good))).toEqual({ ok: false, error: 'bad-row:sets' });
    expect(parseBackup(JSON.stringify({ ...good, schemaVersion: 99, tables: {} }))).toEqual({
      ok: false,
      error: 'newer-version',
    });
    expect(parseBackup(JSON.stringify({ ...good, tables: { hackers: [] } }))).toEqual({
      ok: false,
      error: 'unknown-table',
    });
    expect(parseBackup('{}', MAX_BACKUP_BYTES + 1)).toEqual({ ok: false, error: 'too-big' });
  });
});

describe('error log (NFR-REL-4)', () => {
  it('caps the local error log at 200 rows', async () => {
    await db.errors.clear();
    for (let i = 0; i < MAX_ERRORS + 5; i++) await logError(new Error(`e${i}`), '/x');
    expect(await db.errors.count()).toBe(MAX_ERRORS);
  });

  it('NFR-REL-6: a v1 backup migrates to v2 with every row unchanged and empty Food tables', () => {
    const v1 = {
      app: 'liftlog',
      schemaVersion: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      tables: {
        bodyweights: [{ id: 1, date: '2026-10-01', kg: 78 }],
        settings: [{ key: 'theme', value: 'paper' }],
      },
    };
    const r = parseBackup(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.schemaVersion).toBe(1);
    expect(r.backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.backup.tables.bodyweights).toEqual(v1.tables.bodyweights);
    expect(r.backup.tables.settings).toEqual(v1.tables.settings);
    expect(r.backup.tables.diary).toEqual([]);
    expect(r.backup.tables.fasts).toEqual([]);
  });

  it('FR-SHR-2: Food rows round-trip; the food library is never in a backup', async () => {
    const per100g = {
      kcal: 193,
      protein: 12,
      carbs: 6,
      fat: 14,
      fibre: null,
      sugars: null,
      satFat: null,
      sodium: 300,
      potassium: null,
      calcium: 200,
      iron: 1,
      magnesium: null,
      vitD: null,
      b12: null,
    };
    await db.diary.add({
      id: 'd1',
      date: '2026-10-27',
      meal: 'dinner',
      loggedAt: 1,
      foodId: 'in:paneer-bhurji',
      name: 'Paneer bhurji',
      portion: { label: '1 katori', grams: 150 },
      servings: 1,
      grams: 150,
      per100g,
    });
    await db.fasts.add({ id: 'f1', startedAt: 1, endedAt: 2, planHours: 16 });
    await db.foodLib.add({
      id: 'g:1',
      name: 'Rice',
      aliases: [],
      source: 'generic',
      per100g,
      portions: [{ label: '1 cup', grams: 158 }],
    });
    const backup = await buildBackup(new Date('2026-10-27T12:00:00Z'));
    expect(backup.tables).not.toHaveProperty('foodLib');
    const text = JSON.stringify(backup);
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await db.diary.clear();
    await db.fasts.clear();
    await restoreBackup(parsed.backup, 'replace');
    expect(await db.diary.toArray()).toEqual(backup.tables.diary);
    expect(await db.fasts.get('f1')).toEqual({ id: 'f1', startedAt: 1, endedAt: 2, planHours: 16 });
    expect(await db.foodLib.count()).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { createDB, SCHEMA_VERSION, STORES_V1, TABLES } from './schema';

describe('Dexie schema v1 (PRD §7, NFR-REL-3)', () => {
  it('creates every PRD §7 table with its indexes', async () => {
    const d = createDB(`t-${Math.random()}`);
    await d.open();
    expect(d.verno).toBe(1);
    expect(TABLES).toHaveLength(15);
    for (const t of TABLES) expect(d.table(t)).toBeDefined();
    const sets = d.table('sets').schema;
    expect(sets.indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining(['sessionId', 'exerciseId', '[exerciseId+loggedAt]']),
    );
    expect(d.table('exercises').schema.indexes.find((i) => i.name === 'aliases')?.multi).toBe(true);
    d.close();
  });

  it('seeds meta.schemaVersion and installedAt on first open', async () => {
    const d = createDB(`t-${Math.random()}`);
    await d.open();
    expect((await d.meta.get('schemaVersion'))?.value).toBe(SCHEMA_VERSION);
    expect(typeof (await d.meta.get('installedAt'))?.value).toBe('number');
    d.close();
  });

  it('NFR-REL-3: v1 store definitions are frozen (any change needs db.version(2) + a migration test)', () => {
    expect(STORES_V1).toEqual({
      meta: 'key',
      profile: 'id',
      bodyweights: '++id, date',
      gym: 'id',
      machineNotes: 'machineId',
      exercises: 'id, name, *aliases, *primary, isCustom',
      routines: 'id, active',
      queue: 'id',
      sessions: 'id, startedAt, routineSessionId',
      sets: 'id, sessionId, exerciseId, [exerciseId+loggedAt]',
      goals: 'exerciseId',
      goalChanges: '++id, exerciseId, at',
      prs: '++id, exerciseId, at',
      settings: 'key',
      errors: '++id, at',
    });
  });
});

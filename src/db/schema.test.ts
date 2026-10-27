import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { createDB, SCHEMA_VERSION, STORES_V1, STORES_V2, TABLES, USER_TABLES } from './schema';

describe('Dexie schema (PRD §7, NFR-REL-3)', () => {
  it('creates every PRD §7 table and the v2 Food tables with their indexes', async () => {
    const d = createDB(`t-${Math.random()}`);
    await d.open();
    expect(d.verno).toBe(2);
    expect(TABLES).toHaveLength(20);
    expect(USER_TABLES).not.toContain('foodLib');
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

  it('NFR-REL-6: v2 adds only the Food tables to v1', () => {
    const { foodLib, foods, diary, savedMeals, fasts, ...rest } = STORES_V2;
    expect(rest).toEqual(STORES_V1);
    expect({ foodLib, foods, diary, savedMeals, fasts }).toEqual({
      foodLib: 'id, *terms, gtin',
      foods: 'id, *terms, gtin, isRecipe',
      diary: 'id, date, [date+meal], loggedAt, foodId',
      savedMeals: 'id',
      fasts: 'id, startedAt',
    });
  });

  it('NFR-REL-3 / NFR-REL-6: a v1 database upgrades to v2 with every v1 row unchanged', async () => {
    const name = `t-mig-${Math.random()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(STORES_V1);
    await v1.open();
    const fixture: Record<string, Record<string, unknown>[]> = {
      meta: [
        { key: 'schemaVersion', value: 1 },
        { key: 'installedAt', value: 1_700_000_000_000 },
      ],
      profile: [
        {
          id: 'me',
          experience: 'intermediate',
          goal: 'build_muscle',
          daysPerWeek: 4,
          nudge: 0,
          units: 'kg',
          limitations: [],
        },
      ],
      bodyweights: [{ id: 1, date: '2026-10-19', kg: 78.4 }],
      sessions: [
        {
          id: 's1',
          startedAt: 1_760_000_000_000,
          routineSessionId: 'r1',
          calibration: false,
          deload: false,
          plan: [],
        },
      ],
      sets: [
        {
          id: 'x1',
          sessionId: 's1',
          exerciseId: 'bench-press',
          idx: 1,
          kind: 'work',
          loadKg: 60,
          reps: 8,
          hurts: false,
          goalMet: true,
          bonusReps: 0,
          loggedAt: 1_760_000_100_000,
        },
      ],
      goals: [
        {
          exerciseId: 'bench-press',
          sets: 3,
          repMin: 6,
          repMax: 10,
          loadKg: 60,
          reason: 'x',
          frozen: false,
          missStreak: 0,
          updatedAt: 1,
        },
      ],
      settings: [{ key: 'theme', value: 'iron' }],
    };
    for (const [t, rows] of Object.entries(fixture)) await v1.table(t).bulkAdd(rows);
    v1.close();

    const v2 = createDB(name);
    await v2.open();
    expect(v2.verno).toBe(2);
    for (const [t, rows] of Object.entries(fixture)) {
      const got = await v2.table(t).toArray();
      if (t === 'meta') continue;
      expect(got).toEqual(rows);
    }
    expect((await v2.meta.get('schemaVersion'))?.value).toBe(2);
    expect((await v2.meta.get('installedAt'))?.value).toBe(1_700_000_000_000);
    for (const t of ['foodLib', 'foods', 'diary', 'savedMeals', 'fasts'] as const)
      expect(await v2.table(t).count()).toBe(0);
    v2.close();
  });
});

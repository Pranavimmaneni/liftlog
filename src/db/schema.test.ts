import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { createDB, SCHEMA_VERSION, STORES_V1, STORES_V2, STORES_V3, TABLES, USER_TABLES } from './schema';

describe('Dexie schema (PRD §7, NFR-REL-3)', () => {
  it('creates every PRD §7 table and the v2/v3 Food tables with their indexes', async () => {
    const d = createDB(`t-${Math.random()}`);
    await d.open();
    expect(d.verno).toBe(3);
    expect(TABLES).toHaveLength(21);
    expect(USER_TABLES).not.toContain('foodLib');
    expect(USER_TABLES).not.toContain('foodSearch');
    expect(USER_TABLES).toHaveLength(19);
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
      foodLib: 'id, gtin',
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
    expect(v2.verno).toBe(SCHEMA_VERSION);
    for (const [t, rows] of Object.entries(fixture)) {
      const got = await v2.table(t).toArray();
      if (t === 'meta') continue;
      expect(got).toEqual(rows);
    }
    expect((await v2.meta.get('schemaVersion'))?.value).toBe(SCHEMA_VERSION);
    expect((await v2.meta.get('installedAt'))?.value).toBe(1_700_000_000_000);
    for (const t of ['foodLib', 'foodSearch', 'foods', 'diary', 'savedMeals', 'fasts'] as const)
      expect(await v2.table(t).count()).toBe(0);
    v2.close();
  });

  it('NFR-REL-3 / FR-FOOD-8: v3 adds only foodSearch and keeps every v2 store definition', () => {
    const { foodSearch, ...rest } = STORES_V3;
    expect(rest).toEqual(STORES_V2);
    expect(foodSearch).toBe('file');
  });

  it('NFR-REL-3 / FR-FOOD-8: a v2 database upgrades to v3: user rows unchanged, the old library emptied', async () => {
    const name = `t-${Math.random()}`;
    const old = new Dexie(name);
    old.version(1).stores(STORES_V1);
    old.version(2).stores(STORES_V2);
    await old.open();
    const per100g = { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 };
    const fixture = {
      meta: [
        { key: 'schemaVersion', value: 2 },
        { key: 'installedAt', value: 1_700_000_000_000 },
        { key: 'foodLibVersion', value: '2026-10-27.1' },
      ],
      foods: [
        {
          id: 'c:1',
          name: 'My rice',
          aliases: [],
          source: 'custom',
          per100g,
          portions: [{ label: '1 cup', grams: 158 }],
          terms: ['my', 'rice'],
          isRecipe: 0,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      diary: [
        {
          id: 'd1',
          date: '2026-10-27',
          meal: 'lunch',
          loggedAt: 1,
          foodId: 'g:1',
          name: 'Rice',
          portion: { label: '1 cup', grams: 158 },
          servings: 1,
          grams: 158,
          per100g,
        },
      ],
      fasts: [{ id: 'f1', startedAt: 1, endedAt: 2, planHours: 16 }],
      settings: [{ key: 'lastSection', value: 'food' }],
    };
    for (const [t, rows] of Object.entries(fixture)) await old.table(t).bulkAdd(rows);
    // A v2 library row: a full FoodItem.
    await old
      .table('foodLib')
      .add({ id: 'g:1', name: 'Rice', aliases: [], source: 'generic', per100g, portions: [] });
    old.close();

    const v3 = createDB(name);
    await v3.open();
    expect(v3.verno).toBe(3);
    for (const [t, rows] of Object.entries(fixture)) {
      if (t === 'meta') continue;
      expect(await v3.table(t).toArray()).toEqual(rows);
    }
    expect((await v3.meta.get('schemaVersion'))?.value).toBe(3);
    expect((await v3.meta.get('installedAt'))?.value).toBe(1_700_000_000_000);
    // The library is rebuildable: emptied so the v3 library imports again.
    expect(await v3.foodLib.count()).toBe(0);
    expect(await v3.foodSearch.count()).toBe(0);
    expect(await v3.meta.get('foodLibVersion')).toBeUndefined();
    v3.close();
  });
});

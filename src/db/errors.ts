import { db } from './schema';

export const MAX_ERRORS = 200;

/** NFR-REL-4: local-only error log, capped at 200 rows. Never sent anywhere. */
export async function logError(err: unknown, route?: string): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  try {
    await db.errors.add({ at: Date.now(), message: e.message, stack: e.stack?.slice(0, 4000), route });
    const count = await db.errors.count();
    if (count > MAX_ERRORS) {
      const extra = await db.errors
        .orderBy('at')
        .limit(count - MAX_ERRORS)
        .primaryKeys();
      await db.errors.bulkDelete(extra);
    }
  } catch {
    /* the DB itself may be the thing that failed */
  }
}

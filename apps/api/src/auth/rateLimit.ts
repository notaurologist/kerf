import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { loginFailures } from '../db/schema.ts';

// Login rate limiting in Postgres, since function instances share no memory (decision 0007).
// Failures are counted in fixed windows twice: per client address, so a guesser at one address
// cannot lock the owner out from another, and for the whole app, so guessers with many
// addresses still meet a cap.

export const ADDRESS_LIMIT = { windowMinutes: 15, maxFailures: 10 } as const;
export const GLOBAL_LIMIT = { windowMinutes: 60, maxFailures: 100 } as const;
const MINUTE_MS = 60 * 1000;
const GLOBAL_SCOPE = 'all';

type Limit = { windowMinutes: number; maxFailures: number };

export type Attempt =
  | { allowed: true; release: () => Promise<void> }
  | { allowed: false; retryAfterSeconds: number };

interface Reservation {
  scope: string;
  start: Date;
  over: boolean;
  retryAfterSeconds: number;
}

async function reserve(db: Database, scope: string, limit: Limit, now: Date): Promise<Reservation> {
  const windowMs = limit.windowMinutes * MINUTE_MS;
  const start = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await db
    .insert(loginFailures)
    .values({ scope, windowStart: start, failures: 1 })
    .onConflictDoUpdate({
      target: [loginFailures.scope, loginFailures.windowStart],
      set: { failures: sql`${loginFailures.failures} + 1` },
    })
    .returning({ failures: loginFailures.failures });
  return {
    scope,
    start,
    over: (row?.failures ?? 0) > limit.maxFailures,
    retryAfterSeconds: Math.ceil((start.getTime() + windowMs - now.getTime()) / 1000),
  };
}

async function release(db: Database, { scope, start }: Reservation) {
  const at = and(eq(loginFailures.scope, scope), eq(loginFailures.windowStart, start));
  // A row keeps only windows with failures in them (its check constraint), so the last
  // reserved attempt is taken back by deleting the row.
  const decremented = await db
    .update(loginFailures)
    .set({ failures: sql`${loginFailures.failures} - 1` })
    .where(and(at, gt(loginFailures.failures, 1)))
    .returning({ failures: loginFailures.failures });
  if (decremented.length === 0) {
    await db.delete(loginFailures).where(and(at, eq(loginFailures.failures, 1)));
  }
}

/**
 * Reserves an attempt by counting it as a failure before the password is checked, so parallel
 * requests cannot all slip under the limits. A successful login calls `release` to take it back.
 * An attempt the address limit refuses does not count against the whole app, so one address
 * cannot use up the global cap.
 */
export async function beginAttempt(db: Database, address: string, now: Date): Promise<Attempt> {
  const longestWindow = Math.max(ADDRESS_LIMIT.windowMinutes, GLOBAL_LIMIT.windowMinutes);
  await db
    .delete(loginFailures)
    .where(lt(loginFailures.windowStart, new Date(now.getTime() - longestWindow * MINUTE_MS)));
  const perAddress = await reserve(db, `address:${address}`, ADDRESS_LIMIT, now);
  if (perAddress.over) return { allowed: false, retryAfterSeconds: perAddress.retryAfterSeconds };
  const global = await reserve(db, GLOBAL_SCOPE, GLOBAL_LIMIT, now);
  if (global.over) return { allowed: false, retryAfterSeconds: global.retryAfterSeconds };
  return {
    allowed: true,
    release: async () => {
      await release(db, perAddress);
      await release(db, global);
    },
  };
}

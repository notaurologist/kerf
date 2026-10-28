import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { loginAttempts } from '../db/schema.ts';

// Login rate limiting in Postgres, since function instances share no memory (decision 0007).
// Failures are counted per fixed window for the whole app: there is one user, and a limit per
// address would let anyone with many addresses keep guessing.

export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_WINDOW = 10;
const WINDOW_MS = LOGIN_WINDOW_MINUTES * 60 * 1000;

function windowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}

export type Attempt =
  | { allowed: true; release: () => Promise<void> }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Reserves an attempt by counting it as a failure before the password is checked, so parallel
 * requests cannot all slip under the limit. A successful login calls `release` to take it back.
 */
export async function beginAttempt(db: Database, now: Date): Promise<Attempt> {
  const start = windowStart(now);
  await db.delete(loginAttempts).where(lt(loginAttempts.windowStart, start));
  const [row] = await db
    .insert(loginAttempts)
    .values({ windowStart: start, failures: 1 })
    .onConflictDoUpdate({
      target: loginAttempts.windowStart,
      set: { failures: sql`${loginAttempts.failures} + 1` },
    })
    .returning({ failures: loginAttempts.failures });
  if ((row?.failures ?? 0) > MAX_FAILURES_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((start.getTime() + WINDOW_MS - now.getTime()) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return {
    allowed: true,
    release: async () => {
      // The row keeps only windows with failures in them (its check constraint), so the last
      // reserved attempt is taken back by deleting the row.
      const decremented = await db
        .update(loginAttempts)
        .set({ failures: sql`${loginAttempts.failures} - 1` })
        .where(and(eq(loginAttempts.windowStart, start), gt(loginAttempts.failures, 1)))
        .returning({ failures: loginAttempts.failures });
      if (decremented.length === 0) {
        await db
          .delete(loginAttempts)
          .where(and(eq(loginAttempts.windowStart, start), eq(loginAttempts.failures, 1)));
      }
    },
  };
}

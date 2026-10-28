import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { sessions } from '../db/schema.ts';

// Server-side sessions (decision 0007). The cookie carries a random 256-bit token; the database
// keeps only its SHA-256 hash, so the table alone cannot be used to log in.

export const SESSION_COOKIE = 'kerf_session';
export const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Database,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  // Expired sessions are cleared here rather than on a schedule; there is one user.
  await db.delete(sessions).where(lte(sessions.expiresAt, now));
  await db.insert(sessions).values({ tokenHash: tokenHash(token), createdAt: now, expiresAt });
  return { token, expiresAt };
}

/** The session's expiry, or null when the token is unknown or expired. */
export async function findSession(
  db: Database,
  token: string,
  now: Date,
): Promise<{ expiresAt: Date } | null> {
  const [row] = await db
    .select({ expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, now)));
  return row ?? null;
}

export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
}

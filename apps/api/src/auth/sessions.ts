import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { sessions } from '../db/schema.ts';

// Server-side sessions (decision 0007). The cookie carries a random 256-bit token; the database
// keeps only its SHA-256 hash, so the table alone cannot be used to log in. Each session also
// records a fingerprint of the password hash it was created under, and is valid only while that
// matches, so changing PASSWORD_HASH ends every session.

export const SESSION_COOKIE = 'kerf_session';
export const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// The shape createSession issues. Anything else is refused without a query, so made-up cookies
// cannot keep the database awake.
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 64 bits of a SHA-256 of PASSWORD_HASH: enough to tell one password hash from the next, and
 * nothing that helps anyone guess the password, since the hash's salt is not stored.
 */
export function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(`kerf-session:${passwordHash}`).digest('hex').slice(0, 16);
}

export async function createSession(
  db: Database,
  fingerprint: string,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  // Expired sessions are cleared here rather than on a schedule; there is one user.
  await db.delete(sessions).where(lte(sessions.expiresAt, now));
  await db.insert(sessions).values({
    tokenHash: tokenHash(token),
    passwordFingerprint: fingerprint,
    createdAt: now,
    expiresAt,
  });
  return { token, expiresAt };
}

/** The session's expiry, or null when the token is unknown, expired, or from another password. */
export async function findSession(
  db: Database,
  token: string,
  fingerprint: string,
  now: Date,
): Promise<{ expiresAt: Date } | null> {
  if (!TOKEN.test(token)) return null;
  const [row] = await db
    .select({ expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash(token)),
        eq(sessions.passwordFingerprint, fingerprint),
        gt(sessions.expiresAt, now),
      ),
    );
  return row ?? null;
}

export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
}

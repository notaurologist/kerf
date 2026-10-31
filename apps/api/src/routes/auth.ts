import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { clientAddress } from '../auth/clientAddress.ts';
import { verifyPassword } from '../auth/password.ts';
import { beginAttempt } from '../auth/rateLimit.ts';
import {
  createSession,
  deleteSession,
  findSession,
  passwordFingerprint,
  SESSION_COOKIE,
} from '../auth/sessions.ts';
import type { Database } from '../db/client.ts';
import { valid } from './validate.ts';

// Login, logout, and the current session (decision 0007).

const COOKIE = { httpOnly: true, secure: true, sameSite: 'Strict', path: '/' } as const;

const Login = z.object({ password: z.string().min(1).max(1024) });

export function authRoutes(deps: { db: Database; passwordHash: string; now: () => Date }) {
  const { db, passwordHash, now } = deps;
  const fingerprint = passwordFingerprint(passwordHash);
  return new Hono()
    .post('/login', valid('json', Login), async (c) => {
      const at = now();
      const address = clientAddress(c.req.header('x-forwarded-for'));
      const attempt = await beginAttempt(db, address, at);
      if (!attempt.allowed) {
        c.header('Retry-After', String(attempt.retryAfterSeconds));
        return c.json({ error: 'too-many-attempts' as const }, 429);
      }
      if (!(await verifyPassword(c.req.valid('json').password, passwordHash))) {
        return c.json({ error: 'wrong-password' as const }, 401);
      }
      await attempt.release();
      const session = await createSession(db, fingerprint, at);
      setCookie(c, SESSION_COOKIE, session.token, { ...COOKIE, expires: session.expiresAt });
      return c.json({ expiresAt: session.expiresAt.toISOString() });
    })
    .post('/logout', async (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      if (token) await deleteSession(db, token);
      deleteCookie(c, SESSION_COOKIE, COOKIE);
      return c.body(null, 204);
    })
    .get('/session', async (c) => {
      // The middleware already checked the session; this reports when it ends.
      const token = getCookie(c, SESSION_COOKIE) ?? '';
      const session = await findSession(db, token, fingerprint, now());
      if (!session) return c.json({ error: 'login-required' as const }, 401);
      return c.json({ expiresAt: session.expiresAt.toISOString() });
    });
}

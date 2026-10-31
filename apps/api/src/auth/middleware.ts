import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Database } from '../db/client.ts';
import { findSession, SESSION_COOKIE } from './sessions.ts';

// Every route needs a session except these two (decision 0007). Listed by method and full path,
// so a new route is protected unless it is added here on purpose.
const PUBLIC_ROUTES = new Set(['GET /api/health', 'POST /api/login']);

export function requireSession(db: Database, fingerprint: string, now: () => Date) {
  return createMiddleware(async (c, next) => {
    if (PUBLIC_ROUTES.has(`${c.req.method} ${c.req.path}`)) return next();
    const token = getCookie(c, SESSION_COOKIE);
    const session = token ? await findSession(db, token, fingerprint, now()) : null;
    if (!session) return c.json({ error: 'login-required' as const }, 401);
    return next();
  });
}

const CHANGES_STATE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * State-changing requests must send JSON (decision 0007). With SameSite=Strict cookies this
 * keeps other sites from submitting forms to the API, since a form cannot send JSON.
 */
export const jsonBodiesOnly = createMiddleware(async (c, next) => {
  if (CHANGES_STATE.has(c.req.method)) {
    const type = c.req.header('content-type') ?? '';
    if (!/^application\/json(;|$)/i.test(type)) {
      return c.json({ error: 'json-required' as const }, 415);
    }
  }
  return next();
});

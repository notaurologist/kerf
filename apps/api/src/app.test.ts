import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../test/app.ts';
import { createIsolatedTestDatabase } from '../test/database.ts';
import { BODY_LIMIT_BYTES, BUILD_HEADER, createApp } from './app.ts';
import type { Database } from './db/client.ts';

// Every route except login and the health check needs a session (decision 0007). The routes
// come from the app itself, so a new route is covered without editing this test.
const PUBLIC = ['GET /api/health', 'HEAD /api/health', 'POST /api/login'];

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * A request for each route the app registers, with parameters and wildcards filled in. An `ALL`
 * entry, from `.all()` or middleware, stands for every method, and Hono answers HEAD with a GET
 * route.
 */
function requests(app: { routes: { method: string; path: string }[] }) {
  const seen = new Set<string>();
  return app.routes.flatMap((r) => {
    const path = r.path.replace(/:[^/]+/g, 'x').replace(/\*/g, 'x');
    const methods =
      r.method === 'ALL' ? METHODS : r.method === 'GET' ? ['GET', 'HEAD'] : [r.method];
    return methods.flatMap((method) => {
      if (seen.has(`${method} ${path}`)) return [];
      seen.add(`${method} ${path}`);
      return [{ method, path }];
    });
  });
}

const hasBody = (method: string) => method !== 'GET' && method !== 'HEAD';

describe('api', () => {
  it('answers the health check without a session, with no data', async () => {
    const { app } = await createTestApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const head = await app.request('/api/health', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('rejects every other route without a session', async () => {
    const { app } = await createTestApp();
    const routes = requests(app);
    const protectedRoutes = routes.filter((r) => !PUBLIC.includes(`${r.method} ${r.path}`));
    expect(protectedRoutes.length).toBeGreaterThan(0);
    for (const { method, path } of protectedRoutes) {
      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(hasBody(method) ? { body: '{}' } : {}),
      });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  });

  it('rejects unknown routes without a session too, so they reveal nothing', async () => {
    const { app } = await createTestApp();
    expect((await app.request('/api/nope')).status).toBe(401);
  });

  it('returns 404 for unknown routes with a session', async () => {
    const { app, sessionCookie } = await createTestApp();
    const res = await app.request('/api/nope', { headers: { cookie: await sessionCookie() } });
    expect(res.status).toBe(404);
  });
});

describe('errors', () => {
  it('answers every failing request on every route with JSON', async () => {
    const { app, sessionCookie } = await createTestApp();
    const cookie = await sessionCookie();
    // A HEAD response has no body to check.
    const routes = requests(app).filter((r) => r.method !== 'HEAD');
    let failures = 0;
    for (const { method, path } of [...routes, { method: 'GET', path: '/api/nope' }]) {
      for (const body of hasBody(method) ? ['{}', 'not json', '[]'] : [undefined]) {
        const res = await app.request(path, {
          method,
          headers: { cookie, 'content-type': 'application/json' },
          ...(body === undefined ? {} : { body }),
        });
        if (res.ok) continue;
        failures++;
        const type = res.headers.get('content-type') ?? '';
        expect({ method, path, body, type }).toEqual({
          method,
          path,
          body,
          type: expect.stringContaining('application/json'),
        });
        expect(await res.json()).toHaveProperty('error');
      }
    }
    expect(failures).toBeGreaterThan(0);
  });

  it('answers a malformed JSON body with a JSON 400', async () => {
    const { app, sessionCookie } = await createTestApp();
    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: { cookie: await sessionCookie(), 'content-type': 'application/json' },
      body: '{"name":',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-request' });
  });

  it('answers a database failure with a JSON 500 and logs it', async () => {
    const failing = new Proxy({} as Database, {
      get: () => {
        throw new Error('the database is unreachable');
      },
    });
    const app = createApp({ db: failing, passwordHash: 'unused' });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'anything' }),
    });
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'the database is unreachable' }),
    );
    logged.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal' });
  });

  it('logs a failed query’s text and cause without its parameters', async () => {
    const { app, client } = await createTestApp({ database: await createIsolatedTestDatabase() });
    await client.exec('DROP TABLE sessions');
    // The session lookup's first parameter is the token's hash.
    const token = 'a'.repeat(43);
    const hash = createHash('sha256').update(token).digest('hex');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/api/projects', {
      headers: { cookie: `__Host-kerf_session=${token}` },
    });
    const text = logged.mock.calls.map((args) => inspect(args, { depth: 10 })).join('\n');
    logged.mockRestore();
    expect(res.status).toBe(500);
    expect(text).toContain('from "sessions"');
    expect(text).toContain('relation "sessions" does not exist');
    expect(text).not.toContain(hash);
  });
});

describe('body size', () => {
  it('refuses a body over the limit, before reading it into a route', async () => {
    const { app, sessionCookie } = await createTestApp();
    const res = await app.request('/api/tools', {
      method: 'PUT',
      headers: { cookie: await sessionCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ tools: [], revision: 1, padding: 'x'.repeat(BODY_LIMIT_BYTES) }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'request-refused' });
  });

  it('refuses an oversized login too', async () => {
    const { login } = await createTestApp();
    const res = await login('x'.repeat(BODY_LIMIT_BYTES));
    expect(res.status).toBe(413);
  });
});

describe('caching', () => {
  it('forbids storing any response, with or without a session', async () => {
    const { app, sessionCookie } = await createTestApp();
    const cookie = await sessionCookie();
    const routes = requests(app);
    for (const { method, path } of [...routes, { method: 'GET', path: '/api/nope' }]) {
      for (const headers of [{ cookie }, {}]) {
        const res = await app.request(path, {
          method,
          headers: { ...headers, 'content-type': 'application/json' },
          ...(hasBody(method) ? { body: '{}' } : {}),
        });
        expect({ method, path, cache: res.headers.get('cache-control') }).toEqual({
          method,
          path,
          cache: 'no-store',
        });
      }
    }
  });
});

describe('build header', () => {
  it('names the build on every response, with or without a session, including errors', async () => {
    const { app, sessionCookie } = await createTestApp({ build: 'fa1eade' });
    const cookie = await sessionCookie();
    const routes = requests(app);
    const statuses = new Set<number>();
    for (const { method, path } of [...routes, { method: 'GET', path: '/api/nope' }]) {
      for (const headers of [{ cookie }, {}]) {
        const res = await app.request(path, {
          method,
          headers: { ...headers, 'content-type': 'application/json' },
          ...(hasBody(method) ? { body: '{}' } : {}),
        });
        statuses.add(res.status);
        expect({ method, path, build: res.headers.get(BUILD_HEADER) }).toEqual({
          method,
          path,
          build: 'fa1eade',
        });
      }
    }
    expect([...statuses].some((s) => s >= 400)).toBe(true);
  });

  it('names the build on a server error', async () => {
    const failing = new Proxy({} as Database, {
      get: () => {
        throw new Error('the database is unreachable');
      },
    });
    const app = createApp({ db: failing, passwordHash: 'unused', build: 'fa1eade' });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'anything' }),
    });
    logged.mockRestore();
    expect(res.status).toBe(500);
    expect(res.headers.get(BUILD_HEADER)).toBe('fa1eade');
  });

  it('sends no build header without a build, as in development', async () => {
    const { app } = await createTestApp();
    expect((await app.request('/api/health')).headers.has(BUILD_HEADER)).toBe(false);
  });
});

describe('security headers', () => {
  it('forbid loading or framing anything from an API response, with or without a session', async () => {
    const { app, authed } = await createTestApp();
    for (const res of [await app.request('/api/health'), await authed('/api/projects')]) {
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    }
  });
});

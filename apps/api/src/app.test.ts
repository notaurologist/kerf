import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../test/app.ts';
import { createApp } from './app.ts';
import type { Database } from './db/client.ts';

// Every route except login and the health check needs a session (decision 0007). The routes
// come from the app itself, so a new route is covered without editing this test.
const PUBLIC = ['GET /api/health', 'POST /api/login'];

describe('api', () => {
  it('answers the health check without a session, with no data', async () => {
    const { app } = await createTestApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('rejects every other route without a session', async () => {
    const { app } = await createTestApp();
    const routes = app.routes
      .filter((r) => r.method !== 'ALL')
      .map((r) => ({ method: r.method, path: r.path.replace(/:[^/]+/g, 'x') }));
    const protectedRoutes = routes.filter((r) => !PUBLIC.includes(`${r.method} ${r.path}`));
    expect(protectedRoutes.length).toBeGreaterThan(0);
    for (const { method, path } of protectedRoutes) {
      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(method === 'GET' ? {} : { body: '{}' }),
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
    const routes = app.routes
      .filter((r) => r.method !== 'ALL')
      .map((r) => ({ method: r.method, path: r.path.replace(/:[^/]+/g, 'x') }));
    let failures = 0;
    for (const { method, path } of [...routes, { method: 'GET', path: '/api/nope' }]) {
      for (const body of method === 'GET' ? [undefined] : ['{}', 'not json', '[]']) {
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

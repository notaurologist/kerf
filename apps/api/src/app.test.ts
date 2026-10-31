import { describe, expect, it } from 'vitest';
import { createTestApp } from '../test/app.ts';

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

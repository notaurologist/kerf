import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { LOGIN_WINDOW_MINUTES, MAX_FAILURES_PER_WINDOW } from '../auth/rateLimit.ts';
import { SESSION_DAYS } from '../auth/sessions.ts';

const MINUTE = 60 * 1000;

describe('POST /api/login', () => {
  it('sets an HttpOnly, Secure, SameSite=Strict session cookie for the right password', async () => {
    const { login } = await createTestApp();
    const res = await login();
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^kerf_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
  });

  it('stores only a hash of the session token', async () => {
    const { login, client } = await createTestApp();
    const res = await login();
    const token = res.headers.get('set-cookie')?.split(';')[0]?.split('=')[1];
    const { rows } = await client.query<{ token_hash: string }>('select token_hash from sessions');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.token_hash).not.toBe(token);
  });

  it('rejects a wrong password with no cookie', async () => {
    const { login } = await createTestApp();
    const res = await login('wrong');
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a body that is not JSON', async () => {
    const { app } = await createTestApp();
    const res = await app.request('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'password=x',
    });
    expect(res.status).toBe(415);
  });
});

describe('login rate limiting', () => {
  it(`allows ${MAX_FAILURES_PER_WINDOW} failures per window, then refuses even the right password`, async () => {
    const { login, clock } = await createTestApp();
    for (let i = 0; i < MAX_FAILURES_PER_WINDOW; i++) {
      expect((await login('wrong')).status).toBe(401);
    }
    const limited = await login();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('set-cookie')).toBeNull();
    // The window started at 12:00 and lasts 15 minutes.
    expect(limited.headers.get('retry-after')).toBe(String(LOGIN_WINDOW_MINUTES * 60));

    clock.now = new Date(clock.now.getTime() + LOGIN_WINDOW_MINUTES * MINUTE);
    expect((await login()).status).toBe(200);
  });

  it('does not count successful logins', async () => {
    const { login } = await createTestApp();
    for (let i = 0; i < MAX_FAILURES_PER_WINDOW + 2; i++) {
      expect((await login()).status).toBe(200);
    }
  });

  it('counts parallel failures without letting any slip past the limit', async () => {
    const { login } = await createTestApp();
    const results = await Promise.all(
      Array.from({ length: MAX_FAILURES_PER_WINDOW + 5 }, () => login('wrong')),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(MAX_FAILURES_PER_WINDOW);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
  });
});

describe('sessions', () => {
  it('reports when the session ends', async () => {
    const { app, sessionCookie } = await createTestApp();
    const res = await app.request('/api/session', { headers: { cookie: await sessionCookie() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ expiresAt: '2026-11-27T12:00:00.000Z' });
  });

  it(`expire after ${SESSION_DAYS} days`, async () => {
    const { app, clock, sessionCookie } = await createTestApp();
    const cookie = await sessionCookie();
    clock.now = new Date(clock.now.getTime() + SESSION_DAYS * 24 * 60 * MINUTE);
    const res = await app.request('/api/session', { headers: { cookie } });
    expect(res.status).toBe(401);
  });

  it('end at logout', async () => {
    const { app, client, sessionCookie } = await createTestApp();
    const cookie = await sessionCookie();
    const res = await app.request('/api/logout', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toMatch(/^kerf_session=;/);
    expect((await app.request('/api/session', { headers: { cookie } })).status).toBe(401);
    expect((await client.query('select * from sessions')).rows).toEqual([]);
  });

  it('reject a made-up token', async () => {
    const { app } = await createTestApp();
    const res = await app.request('/api/session', {
      headers: { cookie: 'kerf_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    });
    expect(res.status).toBe(401);
  });
});

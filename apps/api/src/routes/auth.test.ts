import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { createTestDatabase } from '../../test/database.ts';
import { hashPassword } from '../auth/password.ts';
import { ADDRESS_LIMIT, GLOBAL_LIMIT } from '../auth/rateLimit.ts';
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
  const { maxFailures, windowMinutes } = ADDRESS_LIMIT;

  it(`allows ${maxFailures} failures per address per window, then refuses even the right password`, async () => {
    const { login, clock } = await createTestApp();
    for (let i = 0; i < maxFailures; i++) {
      expect((await login('wrong', '203.0.113.7')).status).toBe(401);
    }
    const limited = await login(undefined, '203.0.113.7');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('set-cookie')).toBeNull();
    // The window started at 12:00 and lasts 15 minutes.
    expect(limited.headers.get('retry-after')).toBe(String(windowMinutes * 60));

    clock.now = new Date(clock.now.getTime() + windowMinutes * MINUTE);
    expect((await login(undefined, '203.0.113.7')).status).toBe(200);
  });

  it('does not let failures from one address block another', async () => {
    const { login } = await createTestApp();
    for (let i = 0; i < maxFailures; i++) {
      expect((await login('wrong', '203.0.113.7')).status).toBe(401);
    }
    expect((await login(undefined, '203.0.113.7')).status).toBe(429);
    expect((await login(undefined, '198.51.100.20')).status).toBe(200);
    expect((await login('wrong', '198.51.100.20')).status).toBe(401);
  });

  it('counts the IPv6 addresses in one /64 together', async () => {
    const { login } = await createTestApp();
    for (let i = 0; i < maxFailures; i++) {
      expect((await login('wrong', `2001:db8:1:2::${i + 1}`)).status).toBe(401);
    }
    expect((await login(undefined, '2001:db8:1:2:ffff:ffff:ffff:ffff')).status).toBe(429);
    expect((await login(undefined, '2001:db8:1:3::1')).status).toBe(200);
  });

  it('counts logins without an address header together, as in local development', async () => {
    const { login } = await createTestApp();
    expect((await login()).status).toBe(200);
    for (let i = 0; i < maxFailures; i++) {
      expect((await login('wrong')).status).toBe(401);
    }
    expect((await login()).status).toBe(429);
  });

  it(`refuses every address after ${GLOBAL_LIMIT.maxFailures} failures in an hour`, async () => {
    const { login, clock } = await createTestApp();
    const addresses = GLOBAL_LIMIT.maxFailures / maxFailures;
    for (let a = 0; a < addresses; a++) {
      for (let i = 0; i < maxFailures; i++) {
        expect((await login('wrong', `192.0.2.${a}`)).status).toBe(401);
      }
    }
    const limited = await login(undefined, '198.51.100.20');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe(String(GLOBAL_LIMIT.windowMinutes * 60));

    // The address windows have passed but the hour has not.
    clock.now = new Date(clock.now.getTime() + 45 * MINUTE);
    expect((await login(undefined, '198.51.100.20')).status).toBe(429);
    clock.now = new Date(clock.now.getTime() + 15 * MINUTE);
    expect((await login(undefined, '198.51.100.20')).status).toBe(200);
  });

  it('does not count attempts an address was refused against the whole app', async () => {
    const { login } = await createTestApp();
    for (let i = 0; i < GLOBAL_LIMIT.maxFailures + 5; i++) {
      await login('wrong', '203.0.113.7');
    }
    expect((await login(undefined, '198.51.100.20')).status).toBe(200);
  });

  it('does not count successful logins, per address or for the whole app', async () => {
    const { login } = await createTestApp();
    for (let a = 0; a < GLOBAL_LIMIT.maxFailures / maxFailures; a++) {
      for (let i = 0; i < maxFailures - 1; i++) {
        expect((await login('wrong', `192.0.2.${a}`)).status).toBe(401);
      }
    }
    // 90 failures so far; ten more successes from one address would pass both limits if counted.
    for (let i = 0; i < maxFailures + 2; i++) {
      expect((await login(undefined, '198.51.100.20')).status).toBe(200);
    }
    for (let i = 0; i < GLOBAL_LIMIT.maxFailures / maxFailures; i++) {
      expect((await login('wrong', '198.51.100.21')).status).toBe(401);
    }
    expect((await login(undefined, '198.51.100.22')).status).toBe(429);
  });

  it('counts parallel failures without letting any slip past the limit', async () => {
    const { login } = await createTestApp();
    const results = await Promise.all(
      Array.from({ length: maxFailures + 5 }, () => login('wrong', '203.0.113.7')),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(maxFailures);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
  });

  it('keeps no addresses once their windows have passed', async () => {
    const { login, clock, client } = await createTestApp();
    await login('wrong', '203.0.113.7');
    clock.now = new Date(clock.now.getTime() + 2 * GLOBAL_LIMIT.windowMinutes * MINUTE);
    await login('wrong', '198.51.100.20');
    const { rows } = await client.query<{ scope: string }>(
      'select scope from login_failures order by scope',
    );
    expect(rows.map((r) => r.scope)).toEqual(['address:198.51.100.20', 'all']);
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

  it('end when the password changes', async () => {
    const database = await createTestDatabase();
    const before = await createTestApp({ database });
    const cookie = await before.sessionCookie();
    expect((await before.app.request('/api/session', { headers: { cookie } })).status).toBe(200);

    const newHash = await hashPassword('a different password', { N: 1024, r: 8, p: 1 });
    const after = await createTestApp({ database, passwordHash: newHash });
    expect((await after.app.request('/api/session', { headers: { cookie } })).status).toBe(401);
    expect((await after.app.request('/api/tools', { headers: { cookie } })).status).toBe(401);
    expect((await after.login('a different password')).status).toBe(200);
  });

  it('store a short fingerprint of the password hash, never the hash', async () => {
    const { client, sessionCookie } = await createTestApp();
    await sessionCookie();
    const { rows } = await client.query<Record<string, unknown>>('select * from sessions');
    expect(rows[0]?.password_fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(rows)).not.toContain('scrypt');
  });

  it('from before fingerprints are refused', async () => {
    const { app, client, sessionCookie } = await createTestApp();
    const cookie = await sessionCookie();
    await client.query('update sessions set password_fingerprint = null');
    expect((await app.request('/api/session', { headers: { cookie } })).status).toBe(401);
  });

  it('reject a made-up token', async () => {
    const { app } = await createTestApp();
    const res = await app.request('/api/session', {
      headers: { cookie: 'kerf_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    });
    expect(res.status).toBe(401);
  });

  it('reject a token that is not one Kerf makes without querying the database', async () => {
    const database = await createTestDatabase();
    let queries = 0;
    const counted = new Set(['select', 'selectDistinct', 'insert', 'update', 'delete', 'execute']);
    const db = new Proxy(database.db, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          if (counted.has(String(key))) queries++;
          return value.apply(target, args);
        };
      },
    });
    const { app } = await createTestApp({ database: { ...database, db } });
    const asking = (token: string) =>
      app.request('/api/session', { headers: { cookie: `kerf_session=${token}` } });

    for (const token of ['x', 'A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(42)}+`]) {
      expect((await asking(token)).status).toBe(401);
    }
    expect(queries).toBe(0);
    // A token of the right shape is looked up, so the count would have seen a query.
    expect((await asking('A'.repeat(43))).status).toBe(401);
    expect(queries).toBe(1);
  });
});

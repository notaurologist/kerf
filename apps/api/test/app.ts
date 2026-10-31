import { type AppDeps, createApp } from '../src/app.ts';
import { hashPassword } from '../src/auth/password.ts';
import { createTestDatabase } from './database.ts';

// The API on a fresh PGlite database, with a clock tests can move.

export const TEST_PASSWORD = 'correct horse battery staple';
/** A cheap scrypt cost so tests run fast; production uses the default. */
const passwordHash = await hashPassword(TEST_PASSWORD, { N: 1024, r: 8, p: 1 });

type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;

/**
 * Pass `database` to serve an existing test database, as a later deploy of the code would, and
 * `passwordHash` to configure another password.
 */
export async function createTestApp(
  options: Partial<Pick<AppDeps, 'templates' | 'passwordHash'>> & { database?: TestDatabase } = {},
) {
  const { database = await createTestDatabase(), ...deps } = options;
  const clock = { now: new Date('2026-10-28T12:00:00Z') };
  const app = createApp({ db: database.db, passwordHash, now: () => clock.now, ...deps });

  /** `address` is sent as `x-forwarded-for`, as Vercel sets it. */
  const login = (password = TEST_PASSWORD, address?: string) =>
    app.request('/api/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(address === undefined ? {} : { 'x-forwarded-for': address }),
      },
      body: JSON.stringify({ password }),
    });

  /** Logs in and returns the Cookie header for later requests. */
  const sessionCookie = async (): Promise<string> => {
    const res = await login();
    if (res.status !== 200) throw new Error(`Login failed: ${res.status}`);
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('No session cookie');
    return cookie;
  };

  /** A request with a session, sending `body` as JSON when given. */
  const authed = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    const cookie = await sessionCookie();
    return app.request(path, {
      method: init.method ?? 'GET',
      headers: { cookie, 'content-type': 'application/json' },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  };

  const { db, client, close } = database;
  return { app, clock, login, sessionCookie, authed, db, client, close };
}

import { Hono } from 'hono';
import { jsonBodiesOnly, requireSession } from './auth/middleware.ts';
import type { Database } from './db/client.ts';
import { authRoutes } from './routes/auth.ts';

export interface AppDeps {
  db: Database;
  /** From PASSWORD_HASH (scripts/hash-password.ts). */
  passwordHash: string;
  /** The clock, so tests can move it. */
  now?: () => Date;
}

// Routes live under /api in development and production, so the web app's paths match both.
export function createApp(deps: AppDeps) {
  const now = deps.now ?? (() => new Date());
  return (
    new Hono()
      .basePath('/api')
      .use(jsonBodiesOnly)
      .use(requireSession(deps.db, now))
      // Deploy and uptime check. Returns no data, so it stays outside the session requirement.
      .get('/health', (c) => c.json({ ok: true }))
      .route('/', authRoutes({ db: deps.db, passwordHash: deps.passwordHash, now }))
  );
}

export type AppType = ReturnType<typeof createApp>;

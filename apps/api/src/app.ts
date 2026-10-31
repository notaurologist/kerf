import { TEMPLATES, type TemplateDefinition } from '@kerf/core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { jsonBodiesOnly, requireSession } from './auth/middleware.ts';
import type { Database } from './db/client.ts';
import { authRoutes } from './routes/auth.ts';
import { projectRoutes } from './routes/projects.ts';
import { templateRoutes } from './routes/templates.ts';
import { toolRoutes } from './routes/tools.ts';
import { createProjectService } from './services/projects.ts';

export interface AppDeps {
  db: Database;
  /** From PASSWORD_HASH (scripts/hash-password.ts). */
  passwordHash: string;
  /** The clock, so tests can move it. */
  now?: () => Date;
  /** The templates offered; tests pass made-up versions. */
  templates?: readonly TemplateDefinition[];
}

// Routes live under /api in development and production, so the web app's paths match both.
export function createApp(deps: AppDeps) {
  const now = deps.now ?? (() => new Date());
  const templates = deps.templates ?? TEMPLATES;
  const projects = createProjectService({ db: deps.db, templates, now });
  return (
    new Hono()
      .basePath('/api')
      .use(
        secureHeaders({
          contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
          referrerPolicy: 'no-referrer',
        }),
      )
      .use(jsonBodiesOnly)
      .use(requireSession(deps.db, now))
      // Deploy and uptime check. Returns no data, so it stays outside the session requirement.
      .get('/health', (c) => c.json({ ok: true }))
      .route('/', authRoutes({ db: deps.db, passwordHash: deps.passwordHash, now }))
      .route('/', templateRoutes(templates))
      .route('/', toolRoutes({ db: deps.db, now }))
      .route('/', projectRoutes(projects))
      .notFound((c) => c.json({ error: 'not-found' as const }, 404))
      .onError((error, c) => {
        if (error instanceof HTTPException) {
          return error.status === 400
            ? c.json(
                {
                  error: 'invalid-request' as const,
                  issues: [{ path: [], message: error.message }],
                },
                400,
              )
            : c.json({ error: 'request-refused' as const }, error.status);
        }
        console.error(error);
        return c.json({ error: 'internal' as const }, 500);
      })
  );
}

export type AppType = ReturnType<typeof createApp>;

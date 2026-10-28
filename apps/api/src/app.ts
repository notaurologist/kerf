import { Hono } from 'hono';

// Routes live under /api in development and production, so the web app's paths match both.
export const app = new Hono()
  .basePath('/api')
  // Deploy and uptime check. Returns no data, so it stays outside the session requirement (0007).
  .get('/health', (c) => c.json({ ok: true }));

export type AppType = typeof app;

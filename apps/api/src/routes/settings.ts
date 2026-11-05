import { RevisedOwnerSettings } from '@kerf/core';
import { Hono } from 'hono';
import type { Database } from '../db/client.ts';
import { getSettings, replaceSettings } from '../services/settings.ts';
import { valid } from './validate.ts';

export function settingsRoutes(deps: { db: Database; now: () => Date }) {
  return new Hono()
    .get('/settings', async (c) => c.json(await getSettings(deps.db)))
    .put('/settings', valid('json', RevisedOwnerSettings), async (c) => {
      const { revision, ...settings } = c.req.valid('json');
      const result = await replaceSettings(deps.db, settings, revision, deps.now());
      if (!result.ok) return c.json({ error: result.error, revision: result.revision }, 409);
      return c.json(result.value);
    });
}

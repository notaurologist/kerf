import { RevisedInventory } from '@kerf/core';
import { Hono } from 'hono';
import type { Database } from '../db/client.ts';
import { getRevisedInventory, replaceInventory } from '../services/tools.ts';
import { valid } from './validate.ts';

export function toolRoutes(deps: { db: Database; now: () => Date }) {
  return new Hono()
    .get('/tools', async (c) => c.json(await getRevisedInventory(deps.db)))
    .put('/tools', valid('json', RevisedInventory), async (c) => {
      const { revision, ...inventory } = c.req.valid('json');
      const result = await replaceInventory(deps.db, inventory, revision, deps.now());
      if (!result.ok) return c.json({ error: result.error, revision: result.revision }, 409);
      return c.json(result.value);
    });
}

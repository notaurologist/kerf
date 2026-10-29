import { Inventory } from '@kerf/core';
import { Hono } from 'hono';
import type { Database } from '../db/client.ts';
import { getInventory, replaceInventory } from '../services/tools.ts';
import { valid } from './validate.ts';

export function toolRoutes(deps: { db: Database; now: () => Date }) {
  return new Hono()
    .get('/tools', async (c) => c.json(await getInventory(deps.db)))
    .put('/tools', valid('json', Inventory), async (c) => {
      await replaceInventory(deps.db, c.req.valid('json'), deps.now());
      return c.json(await getInventory(deps.db));
    });
}

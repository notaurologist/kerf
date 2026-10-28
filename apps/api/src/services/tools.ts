import { Inventory } from '@kerf/core';
import type { Database } from '../db/client.ts';
import { tools } from '../db/schema.ts';

// The tool inventory, stored as one row per tool. Its schema lives in core so the web app checks
// it the same way before saving.

export async function getInventory(db: Database): Promise<Inventory> {
  const rows = await db.select().from(tools).orderBy(tools.toolTypeId);
  return Inventory.parse({
    tools: rows.map((r) => ({ toolTypeId: r.toolTypeId, capabilities: r.capabilities })),
  });
}

/** Replaces the whole inventory in one transaction. */
export async function replaceInventory(db: Database, inventory: Inventory, now: Date) {
  await db.transaction(async (tx) => {
    await tx.delete(tools);
    if (inventory.tools.length > 0) {
      await tx.insert(tools).values(inventory.tools.map((t) => ({ ...t, updatedAt: now })));
    }
  });
}

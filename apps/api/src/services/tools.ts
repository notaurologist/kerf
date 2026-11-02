import { Inventory, readStoredTools } from '@kerf/core';
import { asc, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { tools } from '../db/schema.ts';

// The tool inventory, stored as one row per library tool. Its schema lives in core so the web app
// checks it the same way before saving. Rows are read through `readStoredTools`, which leaves out
// what the library no longer has; they are rewritten when the owner next saves the inventory.

export async function getInventory(db: Database): Promise<Inventory> {
  const rows = await db
    .select({
      toolTypeId: tools.toolTypeId,
      name: tools.name,
      capabilities: tools.capabilities,
    })
    .from(tools)
    .orderBy(asc(tools.position));
  return Inventory.parse({ tools: readStoredTools(rows) });
}

/**
 * Replaces the whole inventory in one transaction. Saves that arrive together take turns, so each
 * replaces the last instead of colliding on positions; reads are not blocked.
 */
export async function replaceInventory(db: Database, inventory: Inventory, now: Date) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`lock table ${tools} in exclusive mode`);
    await tx.delete(tools);
    if (inventory.tools.length > 0) {
      await tx.insert(tools).values(
        inventory.tools.map((t, position) => ({
          ...t,
          name: t.name ?? '',
          position,
          updatedAt: now,
        })),
      );
    }
  });
}

import { Inventory, readStoredTools } from '@kerf/core';
import type { Database } from '../db/client.ts';
import { otherTools, tools } from '../db/schema.ts';

// The tool inventory, stored as one row per library tool and one per other tool. Its schema lives
// in core so the web app checks it the same way before saving. Rows written before the tool
// library (M3 to M5) are read through `readStoredTools`, which moves anything the library does not
// have to other tools; the release step rewrites them (`upgradeStoredInventory`).

async function readInventory(db: Database): Promise<{ inventory: Inventory; moved: number }> {
  const rows = await db.select().from(tools).orderBy(tools.toolTypeId);
  const others = await db.select().from(otherTools).orderBy(otherTools.position);
  const read = readStoredTools(rows);
  const inventory = Inventory.parse({
    tools: read.tools,
    other: [...others.map((o) => ({ name: o.name, note: o.note })), ...read.moved],
  });
  return { inventory, moved: read.moved.length };
}

export async function getInventory(db: Database): Promise<Inventory> {
  return (await readInventory(db)).inventory;
}

/** Replaces the whole inventory in one transaction. */
export async function replaceInventory(db: Database, inventory: Inventory, now: Date) {
  await db.transaction(async (tx) => {
    await tx.delete(tools);
    await tx.delete(otherTools);
    if (inventory.tools.length > 0) {
      await tx.insert(tools).values(inventory.tools.map((t) => ({ ...t, updatedAt: now })));
    }
    if (inventory.other.length > 0) {
      await tx
        .insert(otherTools)
        .values(inventory.other.map((o, position) => ({ ...o, position, updatedAt: now })));
    }
  });
}

/**
 * Rewrites an inventory stored before the tool library in the current shape (decision 0014's
 * backfill). Returns how many entries moved to other tools; 0 when there was nothing to do.
 */
export async function upgradeStoredInventory(db: Database, now: Date): Promise<number> {
  const { inventory, moved } = await readInventory(db);
  if (moved > 0) await replaceInventory(db, inventory, now);
  return moved;
}

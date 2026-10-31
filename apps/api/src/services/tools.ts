import { Inventory, readStoredTools } from '@kerf/core';
import type { Database } from '../db/client.ts';
import { otherTools, tools } from '../db/schema.ts';

// The tool inventory, stored as one row per library tool and one per other tool. Its schema lives
// in core so the web app checks it the same way before saving. Rows written before the tool
// library (M3 to M5) are read through `readStoredTools`, which moves anything the library does not
// have to other tools. They are rewritten only when the owner next saves the inventory.

export async function getInventory(db: Database): Promise<Inventory> {
  const rows = await db.select().from(tools).orderBy(tools.position);
  const others = await db.select().from(otherTools).orderBy(otherTools.position);
  const read = readStoredTools(rows);
  return Inventory.parse({
    tools: read.tools,
    other: [...others.map((o) => ({ name: o.name, note: o.note })), ...read.moved],
  });
}

/** Replaces the whole inventory in one transaction. */
export async function replaceInventory(db: Database, inventory: Inventory, now: Date) {
  await db.transaction(async (tx) => {
    await tx.delete(tools);
    await tx.delete(otherTools);
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
    if (inventory.other.length > 0) {
      await tx
        .insert(otherTools)
        .values(inventory.other.map((o, position) => ({ ...o, position, updatedAt: now })));
    }
  });
}

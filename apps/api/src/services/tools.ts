import { Inventory, type RevisedInventory, readStoredTools } from '@kerf/core';
import { asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { tools, toolsRevision } from '../db/schema.ts';

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

/** The inventory with its revision. A database with no revision row yet reads as revision 1. */
export async function getRevisedInventory(db: Database): Promise<RevisedInventory> {
  const [row] = await db.select({ revision: toolsRevision.revision }).from(toolsRevision);
  return { ...(await getInventory(db)), revision: row?.revision ?? 1 };
}

export type ReplaceResult =
  | { ok: true; value: RevisedInventory }
  | { ok: false; error: 'stale-tools'; revision: number };

/**
 * Replaces the whole inventory in one transaction, if `revision` is the stored one, and raises the
 * revision. Saves that arrive together take turns, so each is checked against the last instead of
 * colliding on positions; reads are not blocked. A refused save changes nothing (#426).
 */
export async function replaceInventory(
  db: Database,
  inventory: Inventory,
  revision: number,
  now: Date,
): Promise<ReplaceResult> {
  return db.transaction(async (tx): Promise<ReplaceResult> => {
    await tx.execute(sql`lock table ${tools} in exclusive mode`);
    // Present after migration 0015; inserted here too so a missing row cannot block a save.
    await tx.insert(toolsRevision).values({ id: 1 }).onConflictDoNothing();
    const [row] = await tx.select({ revision: toolsRevision.revision }).from(toolsRevision);
    const current = row?.revision ?? 1;
    if (revision !== current) return { ok: false, error: 'stale-tools', revision: current };
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
    await tx.update(toolsRevision).set({ revision: current + 1 });
    return { ok: true, value: { ...(await getInventory(tx)), revision: current + 1 } };
  });
}

// A tool row as stored, for the backup. Loose on purpose: `getInventory` leaves out rows whose type
// the library no longer has, and a backup must not drop them silently.
const StoredToolRow = z.object({
  toolTypeId: z.string(),
  name: z.string(),
  position: z.number().int(),
  capabilities: z.unknown(),
});
export type StoredToolRow = z.infer<typeof StoredToolRow>;

/** Every stored tool row, unfiltered, in position order. */
export async function exportTools(db: Database): Promise<{ tools: StoredToolRow[] }> {
  const rows = await db
    .select({
      toolTypeId: tools.toolTypeId,
      name: tools.name,
      position: tools.position,
      capabilities: tools.capabilities,
    })
    .from(tools)
    .orderBy(asc(tools.position));
  return { tools: z.array(StoredToolRow).parse(rows) };
}

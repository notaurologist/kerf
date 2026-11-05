import { NO_OWNER_SETTINGS, OwnerSettings, type RevisedOwnerSettings } from '@kerf/core';
import type { Database } from '../db/client.ts';
import { ownerSettings } from '../db/schema.ts';

// The settings the owner enters once and every project's plan uses (#690), stored as one row.

/** The settings with their revision. A database with no row yet reads as nothing entered. */
export async function getSettings(db: Database): Promise<RevisedOwnerSettings> {
  const [row] = await db
    .select({ carryLength: ownerSettings.carryLength, revision: ownerSettings.revision })
    .from(ownerSettings);
  if (!row) return { ...NO_OWNER_SETTINGS, revision: 1 };
  const { revision, ...settings } = row;
  return { ...OwnerSettings.parse(settings), revision };
}

/**
 * The settings' revision, locked against a save until the transaction ends, so a plan generated
 * with that revision's settings is stored before they can change.
 */
export async function lockSettingsRevision(tx: Database): Promise<number> {
  const [row] = await tx
    .select({ revision: ownerSettings.revision })
    .from(ownerSettings)
    .for('share');
  return row?.revision ?? 1;
}

export type ReplaceSettingsResult =
  | { ok: true; value: RevisedOwnerSettings }
  | { ok: false; error: 'stale-settings'; revision: number };

/**
 * Replaces the settings, if `revision` is the stored one, and raises the revision. A refused save
 * changes nothing (0018).
 */
export async function replaceSettings(
  db: Database,
  settings: OwnerSettings,
  revision: number,
  now: Date,
): Promise<ReplaceSettingsResult> {
  return db.transaction(async (tx): Promise<ReplaceSettingsResult> => {
    // Present after migration 0018; inserted here too so a missing row cannot block a save.
    await tx.insert(ownerSettings).values({ id: 1 }).onConflictDoNothing();
    const [row] = await tx
      .select({ revision: ownerSettings.revision })
      .from(ownerSettings)
      .for('update');
    const current = row?.revision ?? 1;
    if (revision !== current) return { ok: false, error: 'stale-settings', revision: current };
    await tx
      .update(ownerSettings)
      .set({ carryLength: settings.carryLength, revision: current + 1, updatedAt: now });
    return { ok: true, value: { ...settings, revision: current + 1 } };
  });
}

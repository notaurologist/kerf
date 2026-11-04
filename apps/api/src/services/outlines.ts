import {
  type ProgressOutline,
  type ProjectSnapshot,
  progressOutline,
  readSnapshot,
  type TemplateDefinition,
} from '@kerf/core';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { projects } from '../db/schema.ts';

// Each project's progress outline (#636), stored beside its snapshot so the projects list counts
// progress without reading the snapshot. Derived data: written with every snapshot, and recomputed
// by every release, since a release can change how an older plan reads (0014).

/** The outline of a snapshot in the template's current shape. Throws if it cannot be counted. */
export const outlineOfSnapshot = (template: TemplateDefinition, snapshot: ProjectSnapshot) =>
  progressOutline(template, template.storedOutputs.parse(snapshot.outputs));

/**
 * A stored row's outline, read from its snapshot through the upgrades; null when the snapshot
 * cannot be read or counted, which is logged.
 */
export function outlineOf(
  templates: readonly TemplateDefinition[],
  row: { id: string; templateId: string; snapshot: unknown },
): ProgressOutline | null {
  const template = templates.find((t) => t.id === row.templateId);
  if (!template) return null;
  const read = readSnapshot(templates, row.snapshot);
  if (!read.ok) return null;
  try {
    return outlineOfSnapshot(template, read.snapshot);
  } catch (error) {
    console.error(`project ${row.id}: progress could not be counted`, error);
    return null;
  }
}

/** Rewrites every project's outline from its snapshot, each under a row lock. */
export async function refreshOutlines(deps: {
  db: Database;
  templates: readonly TemplateDefinition[];
}): Promise<{ projects: number }> {
  const { db, templates } = deps;
  let written = 0;
  for (const { id } of await db.select({ id: projects.id }).from(projects)) {
    const outline = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(projects).where(eq(projects.id, id)).for('update');
      if (!row) return null;
      const outline = outlineOf(templates, row);
      await tx
        .update(projects)
        .set({ progressOutline: outline, progressOutlineRevision: outline ? row.revision : null })
        .where(eq(projects.id, id));
      return outline;
    });
    if (outline) written++;
  }
  return { projects: written };
}

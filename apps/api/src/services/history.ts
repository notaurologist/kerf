import {
  type Inventory,
  type ProjectSnapshot,
  planSteps,
  readSnapshot,
  type TemplateDefinition,
} from '@kerf/core';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { projectHistory, projects } from '../db/schema.ts';
import { getInventory } from './tools.ts';

// A project's history (#106): one row per operation, written whenever its snapshot is saved, and
// at release for projects stored before history existed (decision 0014).

/** A snapshot's build steps for an inventory, from its template; read already, so it parses. */
export function snapshotSteps(
  template: TemplateDefinition,
  snapshot: ProjectSnapshot,
  inventory: Inventory,
) {
  return planSteps(template, template.storedOutputs.parse(snapshot.outputs), inventory);
}

/**
 * Replaces a project's history rows (#106): one per operation in its build steps, with the method
 * chosen from the inventory now and that inventory's key. A part cut from two boards has its cuts
 * in both board steps (#58); they get one row. Called in the transaction that saves the snapshot,
 * so the rows always match it.
 */
export async function writeHistory(
  tx: Database,
  template: TemplateDefinition,
  projectId: string,
  snapshot: ProjectSnapshot,
  at: Date,
): Promise<number> {
  const { inventoryKey, steps } = snapshotSteps(template, snapshot, await getInventory(tx));
  await tx.delete(projectHistory).where(eq(projectHistory.projectId, projectId));
  const operations = [
    ...new Map(steps.flatMap((s) => s.operations.map((o) => [o.operation.id, o]))).values(),
  ];
  const rows = operations.map((o) => ({
    projectId,
    operationId: o.operation.id,
    operation: o.operation.type,
    methodId: o.method?.id ?? null,
    skills: o.skills,
    inventoryKey,
    recordedAt: at,
  }));
  if (rows.length > 0) await tx.insert(projectHistory).values(rows);
  return rows.length;
}

/**
 * Writes history for projects that have none, at release. Each is locked and read again first, so
 * a save made meanwhile wins.
 */
export async function backfillHistory(deps: {
  db: Database;
  templates: readonly TemplateDefinition[];
  now: () => Date;
}): Promise<{ projects: number; rows: number }> {
  const { db, templates, now } = deps;
  const withRows = new Set(
    (await db.selectDistinct({ id: projectHistory.projectId }).from(projectHistory)).map(
      (r) => r.id,
    ),
  );
  const candidates = (await db.select({ id: projects.id }).from(projects)).filter(
    (r) => !withRows.has(r.id),
  );
  let written = 0;
  let count = 0;
  for (const { id } of candidates) {
    const n = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(projects).where(eq(projects.id, id)).for('update');
      if (!row) return 0;
      const [existing] = await tx
        .select({ id: projectHistory.id })
        .from(projectHistory)
        .where(eq(projectHistory.projectId, id))
        .limit(1);
      const template = templates.find((t) => t.id === row.templateId);
      const result = readSnapshot(templates, row.snapshot);
      if (existing || !template || !result.ok) return 0;
      return writeHistory(tx, template, id, result.snapshot, now());
    });
    if (n > 0) {
      written++;
      count += n;
    }
  }
  return { projects: written, rows: count };
}

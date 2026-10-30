import {
  type ProgressKind,
  ProgressKind as ProgressKindSchema,
  type ProgressReset,
  type ProjectSnapshot,
  progressItems,
  progressToReset,
  type TemplateDefinition,
} from '@kerf/core';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { projectProgress } from '../db/schema.ts';

// Saved progress (#57): what has been ticked off in a project, by the keys core gives each item.
// Every device reads the same rows. A write sets or clears ticks and is safe to send again, so a
// client can retry writes queued through a dropped connection.

export const ProgressChanges = z.object({
  changes: z
    .array(
      z.object({
        kind: ProgressKindSchema,
        key: z.string().min(1).max(300),
        done: z.boolean(),
      }),
    )
    .min(1)
    .max(500),
});
export type ProgressChanges = z.infer<typeof ProgressChanges>;

export interface ProgressEntry {
  kind: ProgressKind;
  key: string;
  /** When the server saved the tick. Ticking again keeps the first time. */
  doneAt: string;
}

/** A snapshot's progress items, from its template; read already, so its outputs parse. */
export function itemsOf(template: TemplateDefinition, snapshot: ProjectSnapshot) {
  return progressItems(template, template.outputs.parse(snapshot.outputs));
}

export async function readProgress(db: Database, projectId: string): Promise<ProgressEntry[]> {
  const rows = await db
    .select()
    .from(projectProgress)
    .where(eq(projectProgress.projectId, projectId))
    .orderBy(asc(projectProgress.doneAt), asc(projectProgress.kind), asc(projectProgress.key));
  return rows.map((r) => ({ kind: r.kind, key: r.key, doneAt: r.doneAt.toISOString() }));
}

/**
 * Sets and clears ticks. A key repeated in one request takes its last value. Ticking an item that
 * is already done keeps its first time, so a retried write changes nothing.
 */
export async function writeProgress(
  db: Database,
  projectId: string,
  changes: ProgressChanges['changes'],
  at: Date,
): Promise<void> {
  const last = new Map(changes.map((c) => [`${c.kind}:${c.key}`, c]));
  const done = [...last.values()].filter((c) => c.done);
  const undone = [...last.values()].filter((c) => !c.done);
  await db.transaction(async (tx) => {
    if (done.length > 0) {
      await tx
        .insert(projectProgress)
        .values(done.map((c) => ({ projectId, kind: c.kind, key: c.key, doneAt: at })))
        .onConflictDoNothing();
    }
    await clearTicks(tx, projectId, undone);
  });
}

async function clearTicks(
  tx: Database,
  projectId: string,
  ticks: readonly { kind: ProgressKind; key: string }[],
): Promise<void> {
  for (const kind of new Set(ticks.map((t) => t.kind))) {
    const keys = ticks.filter((t) => t.kind === kind).map((t) => t.key);
    await tx
      .delete(projectProgress)
      .where(
        and(
          eq(projectProgress.projectId, projectId),
          eq(projectProgress.kind, kind),
          inArray(projectProgress.key, keys),
        ),
      );
  }
}

/**
 * Clears the ticks a regeneration makes wrong (`progressToReset`): items no longer in the plan or
 * there with other numbers. Called in the transaction that saves the new snapshot.
 */
export async function resetProgress(
  tx: Database,
  projectId: string,
  before: { template: TemplateDefinition; snapshot: ProjectSnapshot },
  after: { template: TemplateDefinition; snapshot: ProjectSnapshot },
): Promise<ProgressReset[]> {
  const ticked = await tx
    .select({ kind: projectProgress.kind, key: projectProgress.key })
    .from(projectProgress)
    .where(eq(projectProgress.projectId, projectId))
    .orderBy(asc(projectProgress.doneAt), asc(projectProgress.kind), asc(projectProgress.key));
  if (ticked.length === 0) return [];
  const reset = progressToReset(
    ticked,
    itemsOf(before.template, before.snapshot),
    itemsOf(after.template, after.snapshot),
  );
  await clearTicks(tx, projectId, reset);
  return reset;
}

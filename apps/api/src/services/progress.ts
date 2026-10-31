import {
  type ProgressKind,
  ProgressKind as ProgressKindSchema,
  type ProgressReset,
  type ProgressSummary,
  type ProjectSnapshot,
  progressItems,
  progressToReset,
  type TemplateDefinition,
} from '@kerf/core';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { type PROJECT_STATUSES, projectProgress } from '../db/schema.ts';

// Saved progress (#57): what has been ticked off in a project, by the keys core gives each item.
// Every device reads the same rows. A write sets or clears ticks and is safe to send again, so a
// client can retry writes queued through a dropped connection.

export const ProgressChanges = z.object({
  /** The project's revision the ticks were made against (#207). */
  revision: z.number().int().positive(),
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
  return progressItems(template, template.storedOutputs.parse(snapshot.outputs));
}

type ProgressRow = typeof projectProgress.$inferSelect;
const ORDER = [asc(projectProgress.doneAt), asc(projectProgress.kind), asc(projectProgress.key)];
const entry = (r: ProgressRow): ProgressEntry => ({
  kind: r.kind,
  key: r.key,
  doneAt: r.doneAt.toISOString(),
});

export async function readProgress(db: Database, projectId: string): Promise<ProgressEntry[]> {
  const rows = await db
    .select()
    .from(projectProgress)
    .where(eq(projectProgress.projectId, projectId))
    .orderBy(...ORDER);
  return rows.map(entry);
}

/** Every project's ticks, by project ID, for the projects list (#61). */
export async function readAllProgress(db: Database): Promise<Map<string, ProgressEntry[]>> {
  const rows = await db
    .select()
    .from(projectProgress)
    .orderBy(...ORDER);
  const byProject = new Map<string, ProgressEntry[]>();
  for (const row of rows) {
    byProject.set(row.projectId, [...(byProject.get(row.projectId) ?? []), entry(row)]);
  }
  return byProject;
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
    .orderBy(...ORDER);
  if (ticked.length === 0) return [];
  const reset = progressToReset(
    ticked,
    itemsOf(before.template, before.snapshot),
    itemsOf(after.template, after.snapshot),
  );
  await clearTicks(tx, projectId, reset);
  return reset;
}

type Status = (typeof PROJECT_STATUSES)[number];

/**
 * A project's status after a write to its ticks (#61; information architecture, "Status follows
 * what you do"): Built when the write finishes the last step, In progress when a Planned project
 * gets its first tick. Only these forward moves are made; any status can still be set by hand,
 * and clearing a tick never moves it back.
 */
export function statusAfterTicks(
  status: Status,
  changes: ProgressChanges['changes'],
  before: ProgressSummary,
  after: ProgressSummary,
): Status {
  const { done, total } = after.steps;
  if (total > 0 && done === total && before.steps.done < total) return 'built';
  if (status === 'planned' && changes.some((c) => c.done)) return 'in-progress';
  return status;
}

import {
  isReviewProgress,
  type ProgressKind,
  ProgressKind as ProgressKindSchema,
  type ProgressReset,
  type ProgressSummary,
  type ProjectSnapshot,
  progressItems,
  progressToReset,
  ResetRecord,
  recordResets,
  type TemplateDefinition,
} from '@kerf/core';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { type PROJECT_STATUSES, projectProgress, projectResets } from '../db/schema.ts';

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
        // An expert check's key holds what to ask, numbers and all.
        key: z.string().min(1).max(1000),
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
    const ticks = byProject.get(row.projectId);
    if (ticks) ticks.push(entry(row));
    else byProject.set(row.projectId, [entry(row)]);
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

type Planned = { template: TemplateDefinition; snapshot: ProjectSnapshot };

/** The ticks a change from `before` to `after` would clear, each recorded against `before`. */
export async function resetsFor(
  db: Database,
  projectId: string,
  before: Planned,
  after: Planned,
): Promise<{ reset: ProgressReset[]; records: ResetRecord[] }> {
  const ticked = await db
    .select({ kind: projectProgress.kind, key: projectProgress.key })
    .from(projectProgress)
    .where(eq(projectProgress.projectId, projectId))
    .orderBy(...ORDER);
  if (ticked.length === 0) return { reset: [], records: [] };
  const reset = progressToReset(
    ticked,
    itemsOf(before.template, before.snapshot),
    itemsOf(after.template, after.snapshot),
  );
  const outputs = before.template.storedOutputs.parse(before.snapshot.outputs);
  return { reset, records: recordResets(before.template, outputs, reset) };
}

/**
 * Clears the ticks a regeneration makes wrong (`progressToReset`): items no longer in the plan or
 * there with other numbers, and records what each was (#444). Called in the transaction that
 * saves the new snapshot.
 */
export async function resetProgress(
  tx: Database,
  projectId: string,
  before: Planned,
  after: Planned,
  at: Date,
): Promise<ProgressReset[]> {
  const { reset, records } = await resetsFor(tx, projectId, before, after);
  await clearTicks(tx, projectId, reset);
  if (records.length > 0) {
    await tx
      .insert(projectResets)
      .values(
        records.map((record) => ({
          projectId,
          kind: record.kind,
          key: record.key,
          record,
          resetAt: at,
        })),
      )
      .onConflictDoUpdate({
        target: [projectResets.projectId, projectResets.kind, projectResets.key],
        set: { record: sql`excluded.record`, resetAt: at },
      });
  }
  return reset;
}

/** A recorded reset and when the save that made it was saved, which a dismissal names. */
export interface StoredReset {
  record: ResetRecord;
  resetAt: string;
}

/**
 * A project's recorded resets, oldest first. A row that no longer parses is logged and left out,
 * so one bad row does not stop the project opening.
 */
export async function readResets(db: Database, projectId: string): Promise<StoredReset[]> {
  const rows = await db
    .select()
    .from(projectResets)
    .where(eq(projectResets.projectId, projectId))
    .orderBy(asc(projectResets.resetAt), asc(projectResets.kind), asc(projectResets.key));
  return rows.flatMap((row) => {
    const parsed = ResetRecord.safeParse(row.record);
    if (parsed.success) return [{ record: parsed.data, resetAt: row.resetAt.toISOString() }];
    console.error(`project ${projectId}: reset ${row.kind} could not be read`, parsed.error);
    return [];
  });
}

/** Every project's recorded resets as stored, by project ID, for the backup file. */
export async function readAllResets(
  db: Database,
): Promise<Map<string, { record: unknown; resetAt: string }[]>> {
  const rows = await db
    .select()
    .from(projectResets)
    .orderBy(asc(projectResets.resetAt), asc(projectResets.kind), asc(projectResets.key));
  const byProject = new Map<string, { record: unknown; resetAt: string }[]>();
  for (const row of rows) {
    const reset = { record: row.record, resetAt: row.resetAt.toISOString() };
    const resets = byProject.get(row.projectId);
    if (resets) resets.push(reset);
    else byProject.set(row.projectId, [reset]);
  }
  return byProject;
}

export const ResetDismissals = z.object({
  resets: z
    .array(
      z.object({
        kind: ProgressKindSchema,
        key: z.string().min(1).max(1000),
        /** When the reset was saved, so a dismissal never clears a later reset of the item. */
        resetAt: z.iso.datetime(),
      }),
    )
    .min(1)
    .max(500),
});
export type ResetDismissals = z.infer<typeof ResetDismissals>;

/** Deletes the resets the owner dismissed. Dismissing one already gone does nothing. */
export async function dismissResets(
  db: Database,
  projectId: string,
  resets: ResetDismissals['resets'],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { kind, key, resetAt } of resets) {
      await tx
        .delete(projectResets)
        .where(
          and(
            eq(projectResets.projectId, projectId),
            eq(projectResets.kind, kind),
            eq(projectResets.key, key),
            eq(projectResets.resetAt, new Date(resetAt)),
          ),
        );
    }
  });
}

type Status = (typeof PROJECT_STATUSES)[number];

/**
 * A project's status after a write to its ticks (#61; information architecture, "Status follows
 * what you do"): Built when the write finishes the last step, In progress when a Planned project
 * gets its first tick in Shopping or Building. A tick in the structural review is not work on the
 * project, so it moves nothing (#393). Only these forward moves are made; any status can still be
 * set by hand, and clearing a tick never moves it back.
 */
export function statusAfterTicks(
  status: Status,
  changes: ProgressChanges['changes'],
  before: ProgressSummary,
  after: ProgressSummary,
): Status {
  const { done, total } = after.steps;
  if (total > 0 && done === total && before.steps.done < total) return 'built';
  if (status === 'planned' && changes.some((c) => c.done && !isReviewProgress(c.kind))) {
    return 'in-progress';
  }
  return status;
}

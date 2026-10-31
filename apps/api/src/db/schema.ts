import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Tables from ARCHITECTURE.md (apps/api, Data). JSON columns hold values that core's Zod schemas
// define; they are parsed with those schemas when read back (decision 0003).

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

// The owner's tool inventory: one row per library tool, in the owner's order, with the
// capabilities entered for it. A type can appear more than once, each with its own name.
export const tools = pgTable('tools', {
  position: integer('position').primaryKey(),
  toolTypeId: text('tool_type_id').notNull(),
  name: text('name').notNull().default(''),
  capabilities: jsonb('capabilities').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Tools the library does not have, in the order the owner listed them. Build steps ignore them.
export const otherTools = pgTable('other_tools', {
  position: integer('position').primaryKey(),
  name: text('name').notNull(),
  note: text('note').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const PROJECT_STATUSES = ['planned', 'in-progress', 'built'] as const;

// A project and its stored snapshot. The snapshot is regenerated only when the parameters or
// inputs change or the owner asks, so it never changes underneath the project.
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    status: text('status', { enum: PROJECT_STATUSES }).notNull(),
    templateId: text('template_id').notNull(),
    templateVersion: integer('template_version').notNull(),
    /**
     * Counts saves that change the plan: its name, parameters, structural inputs, or a
     * regeneration. A save or tick made against an older count is refused (#207), so two devices
     * cannot overwrite each other. Status changes and ticks leave it.
     */
    revision: integer('revision').notNull().default(1),
    /** Parameters and structural inputs live in the snapshot, the one copy upgrades keep current. */
    snapshot: jsonb('snapshot').notNull(),
    ...timestamps,
  },
  (t) => [
    check('projects_status', sql`${t.status} in ('planned', 'in-progress', 'built')`),
    check('projects_name', sql`length(trim(${t.name})) > 0`),
    check('projects_template_version', sql`${t.templateVersion} > 0`),
    check('projects_revision', sql`${t.revision} > 0`),
    // The list reads the version from this column without parsing every snapshot.
    check(
      'projects_template_version_matches_snapshot',
      sql`${t.templateVersion} = (${t.snapshot}->>'templateVersion')::integer`,
    ),
    index('projects_updated_at').on(t.updatedAt),
  ],
);

// One row per operation in a project's plan, for later references to past projects
// (PRODUCT.md, MVP feature 8). Replaced in the same transaction whenever a snapshot is saved
// (#106), from the build steps chosen from the inventory at that moment, which `inventory_key`
// names. Derived data: the release step writes rows for projects that have none.
export const projectHistory = pgTable(
  'project_history',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** The operation's ID in the plan, such as "beam/end-0". */
    operationId: text('operation_id').notNull(),
    /** The operation type. */
    operation: text('operation').notNull(),
    /** The chosen method, or null when the inventory supported none. */
    methodId: text('method_id'),
    skills: text('skills').array().notNull().default(sql`'{}'::text[]`),
    inventoryKey: text('inventory_key').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('project_history_operation').on(t.projectId, t.operationId)],
);

export const PROGRESS_KINDS = ['shopping-line', 'board', 'part', 'step'] as const;

// What has been ticked off in a project (#57): shopping lines, boards, parts' pieces, and build
// steps, by the keys core gives them (progress/). A row means done; clearing a tick deletes it.
// When a snapshot is saved, rows whose item is gone or has other numbers are deleted in the same
// transaction. Every device reads the same rows.
export const projectProgress = pgTable(
  'project_progress',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: PROGRESS_KINDS }).notNull(),
    key: text('key').notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.kind, t.key] }),
    check('project_progress_kind', sql`${t.kind} in ('shopping-line', 'board', 'part', 'step')`),
  ],
);

// Login sessions (decision 0007). The cookie holds a random token; only its SHA-256 hash is
// stored, so reading this table does not give anyone a working session.
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    /** Of the password hash the session was created under. Null rows predate it and never match. */
    passwordFingerprint: text('password_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    check('sessions_expires_after_created', sql`${t.expiresAt} > ${t.createdAt}`),
    index('sessions_expires_at').on(t.expiresAt),
  ],
);

// Failed logins per fixed time window, for rate limiting across function instances (0007).
// `scope` is `all` for the cap on the whole app, or `address:` and a client address (an IPv6
// address by its /64). Rows are deleted once their window has passed.
export const loginFailures = pgTable(
  'login_failures',
  {
    scope: text('scope').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    failures: integer('failures').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.windowStart] }),
    check('login_failures_failures', sql`${t.failures} > 0`),
  ],
);

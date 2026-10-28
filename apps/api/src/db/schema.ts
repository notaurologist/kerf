import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Tables from ARCHITECTURE.md (apps/api, Data). JSON columns hold values that core's Zod schemas
// define; they are parsed with those schemas when read back (decision 0003).

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

// The owner's tool inventory: one row per tool type, with the capabilities that matter for it.
export const tools = pgTable('tools', {
  toolTypeId: text('tool_type_id').primaryKey(),
  capabilities: jsonb('capabilities').notNull().default({}),
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
    params: jsonb('params').notNull(),
    structuralInputs: jsonb('structural_inputs').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    ...timestamps,
  },
  (t) => [
    check('projects_status', sql`${t.status} in ('planned', 'in-progress', 'built')`),
    check('projects_name', sql`length(trim(${t.name})) > 0`),
    check('projects_template_version', sql`${t.templateVersion} > 0`),
    index('projects_updated_at').on(t.updatedAt),
  ],
);

// One row per operation in a project's plan, for later references to past projects
// (PRODUCT.md, MVP feature 8). Written when a snapshot is saved, from M6 on.
export const projectHistory = pgTable(
  'project_history',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    operation: text('operation').notNull(),
    methodId: text('method_id').notNull(),
    skills: text('skills').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [index('project_history_project_id').on(t.projectId)],
);

// Login sessions (decision 0007). The cookie holds a random token; only its SHA-256 hash is
// stored, so reading this table does not give anyone a working session.
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    check('sessions_expires_after_created', sql`${t.expiresAt} > ${t.createdAt}`),
    index('sessions_expires_at').on(t.expiresAt),
  ],
);

// Failed logins per fixed time window, for rate limiting across function instances (0007).
export const loginAttempts = pgTable(
  'login_attempts',
  {
    windowStart: timestamp('window_start', { withTimezone: true }).primaryKey(),
    failures: integer('failures').notNull(),
  },
  (t) => [check('login_attempts_failures', sql`${t.failures} > 0`)],
);

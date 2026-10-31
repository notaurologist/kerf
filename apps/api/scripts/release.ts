import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSnapshot, TEMPLATES, type TemplateDefinition } from '@kerf/core';
import { sql } from 'drizzle-orm';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { LOCAL_DATABASE_URL } from '../drizzle.config.ts';
import { createDatabase, type Database } from '../src/db/client.ts';
import { projects } from '../src/db/schema.ts';
import { backfillHistory } from '../src/services/history.ts';

// Runs while the previous deploy still serves, so it never rewrites stored data into a newer
// shape; reads upgrade it (decision 0014).
const RELEASE_LOCK = 1;

export interface ReleaseConnection {
  db: Database;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}

export type ReleaseResult =
  | { status: 'skipped'; reason: string }
  | { status: 'invalid-url' }
  | { status: 'unreadable'; projects: { id: string; reason: string }[] }
  | { status: 'released'; history: { projects: number; rows: number } };

function skipReason(env: Record<string, string | undefined>): string | undefined {
  if (env.VERCEL && env.VERCEL_ENV !== 'production') {
    return `a ${env.VERCEL_ENV ?? 'unknown'} deployment`;
  }
  return undefined;
}

async function unreadableProjects(db: Database, templates: readonly TemplateDefinition[]) {
  const [table] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`information_schema.tables`)
    .where(sql`table_schema = current_schema() and table_name = 'projects'`);
  if (!table?.count) return [];
  // Runs before migrating, so it names only columns every migration has had.
  const rows = await db.select({ id: projects.id, snapshot: projects.snapshot }).from(projects);
  return rows.flatMap((row) => {
    const result = readSnapshot(templates, row.snapshot);
    return result.ok ? [] : [{ id: row.id, reason: result.reason }];
  });
}

export async function release(options: {
  env: Record<string, string | undefined>;
  connect: (url: string) => ReleaseConnection;
  templates: readonly TemplateDefinition[];
  now: () => Date;
  log: (message: string) => void;
}): Promise<ReleaseResult> {
  const { env, connect, templates, now, log } = options;
  const skip = skipReason(env);
  if (skip) {
    log(`release: skipped for ${skip}.`);
    return { status: 'skipped', reason: skip };
  }

  // Neon advises schema changes over the direct connection, not the pooler.
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || LOCAL_DATABASE_URL;
  if (!/^postgres(ql)?:\/\//.test(url)) {
    log('release: DATABASE_URL_UNPOOLED or DATABASE_URL must be a postgres:// URL.');
    return { status: 'invalid-url' };
  }

  const { db, migrate, close } = connect(url);
  try {
    // Session-level, which holds because every step uses this one connection.
    await db.execute(sql`select pg_advisory_lock(${RELEASE_LOCK})`);
    try {
      const unreadable = await unreadableProjects(db, templates);
      if (unreadable.length > 0) {
        const list = unreadable.map((p) => `${p.id} (${p.reason})`).join(', ');
        log(`release: projects this code cannot read: ${list}`);
        return { status: 'unreadable', projects: unreadable };
      }
      log('release: every stored project reads.');
      await migrate();
      log('release: migrations applied.');
      const history = await backfillHistory({ db, templates, now });
      log(
        `release: history written for ${history.projects} projects (${history.rows} operations).`,
      );
      return { status: 'released', history };
    } finally {
      await db.execute(sql`select pg_advisory_unlock(${RELEASE_LOCK})`);
    }
  } finally {
    await close();
  }
}

if (import.meta.main) {
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
  const result = await release({
    env: process.env,
    connect: (url) => {
      const { db, close } = createDatabase(url, { prepare: false, max: 1, connect_timeout: 30 });
      const migrate = () =>
        migratePostgres(db as Parameters<typeof migratePostgres>[0], { migrationsFolder });
      return { db, migrate, close };
    },
    templates: TEMPLATES,
    now: () => new Date(),
    log: console.log,
  });
  if (result.status === 'invalid-url' || result.status === 'unreadable') process.exitCode = 1;
}

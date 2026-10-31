import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSnapshot, TEMPLATES, type TemplateDefinition } from '@kerf/core';
import { sql } from 'drizzle-orm';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { LOCAL_DATABASE_URL } from '../drizzle.config.ts';
import { createDatabase, type Database } from '../src/db/client.ts';
import { projects } from '../src/db/schema.ts';
import { createProjectService } from '../src/services/projects.ts';

// Brings the database up to date with this code (decision 0014). Vercel runs it in every
// production build (vercel.json) while the previous deploy is still serving; locally it is
// `pnpm db:migrate`. Safe to re-run.
//
// It never rewrites stored data into a newer shape, since the previous deploy would then fail to
// read it: reads upgrade older shapes as they go. In order, it checks that this code can read every
// stored project, applies the committed Drizzle migrations, and writes history rows for projects
// that have none. Migrations use Neon's direct connection when one is set, since Neon advises
// against schema changes through the pooler.

/** Any number, fixed, so that two releases against one database run one after the other. */
const RELEASE_LOCK = 0x6b657266;

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

/** Why this build does not release, or undefined when it does. Only production builds release. */
function skipReason(env: Record<string, string | undefined>): string | undefined {
  if (env.VERCEL && env.VERCEL_ENV !== 'production') {
    return `a ${env.VERCEL_ENV ?? 'unknown'} deployment`;
  }
  return undefined;
}

/** Stored projects this code cannot read. Writes nothing; an empty database has none. */
async function unreadableProjects(db: Database, templates: readonly TemplateDefinition[]) {
  const [table] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`information_schema.tables`)
    .where(sql`table_schema = current_schema() and table_name = 'projects'`);
  if (!table?.count) return [];
  // Only the columns every migration has had, since this runs before migrating.
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

  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || LOCAL_DATABASE_URL;
  if (!/^postgres(ql)?:\/\//.test(url)) {
    log('release: DATABASE_URL_UNPOOLED or DATABASE_URL must be a postgres:// URL.');
    return { status: 'invalid-url' };
  }

  const { db, migrate, close } = connect(url);
  try {
    // A session lock, held on the one connection every step below uses.
    await db.execute(sql`select pg_advisory_lock(${RELEASE_LOCK})`);
    try {
      const unreadable = await unreadableProjects(db, templates);
      if (unreadable.length > 0) {
        // Stops the deploy before anything is written, so the previous deploy keeps serving
        // the database as it was.
        const list = unreadable.map((p) => `${p.id} (${p.reason})`).join(', ');
        log(`release: projects this code cannot read: ${list}`);
        return { status: 'unreadable', projects: unreadable };
      }
      log('release: every stored project reads.');
      await migrate();
      log('release: migrations applied.');
      const service = createProjectService({ db, templates, now });
      const history = await service.backfillHistory();
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

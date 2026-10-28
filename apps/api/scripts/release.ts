import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from '@kerf/core';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { LOCAL_DATABASE_URL } from '../drizzle.config.ts';
import { createDatabase } from '../src/db/client.ts';
import { createProjectService } from '../src/services/projects.ts';

// Brings the database up to date with this code (decision 0014): applies the committed Drizzle
// migrations, then rewrites any project snapshot stored in an older shape in the current one.
// Safe to re-run. Vercel runs it in every production build (vercel.json); locally it is
// `pnpm db:migrate`. Migrations use Neon's direct connection when one is set, since Neon advises
// against schema changes through the pooler.

if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
  console.log(`release: skipped for a ${process.env.VERCEL_ENV ?? 'unknown'} deployment.`);
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || LOCAL_DATABASE_URL;
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error('release: DATABASE_URL_UNPOOLED or DATABASE_URL must be a postgres:// URL.');
  process.exit(1);
}

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const { db, close } = createDatabase(url, { prepare: false, max: 1, connect_timeout: 30 });
try {
  await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder });
  console.log('release: migrations applied.');
  const projects = createProjectService({ db, templates: TEMPLATES, now: () => new Date() });
  const { upgraded, unreadable } = await projects.upgradeStoredSnapshots();
  console.log(`release: ${upgraded} project snapshots upgraded to the current shape.`);
  if (unreadable.length > 0) {
    // Stops the deploy, so code that cannot read stored projects never goes live.
    console.error(`release: snapshots that cannot be read: ${unreadable.join(', ')}`);
    process.exitCode = 1;
  }
} finally {
  await close();
}

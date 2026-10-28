import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from '../src/db/client.ts';
import * as schema from '../src/db/schema.ts';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

// One PGlite per test file with the committed migrations applied (decision 0010). Each test gets
// a clone of it, which is much faster than starting PGlite and migrating again.
let migrated: Promise<PGlite> | undefined;

function migratedTemplate(): Promise<PGlite> {
  migrated ??= (async () => {
    const client = new PGlite();
    await migrate(drizzle(client, { schema }), { migrationsFolder });
    return client;
  })();
  return migrated;
}

/** A fresh in-memory Postgres with the committed migrations applied. */
export async function createTestDatabase(): Promise<{
  db: Database;
  client: PGlite;
  close: () => Promise<void>;
}> {
  // clone() returns the interface type; the clone is a full PGlite instance.
  const client = (await (await migratedTemplate()).clone()) as PGlite;
  const db = drizzle(client, { schema });
  return { db, client, close: () => client.close() };
}

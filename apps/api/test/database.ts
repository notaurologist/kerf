import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, expect } from 'vitest';
import type { Database } from '../src/db/client.ts';
import * as schema from '../src/db/schema.ts';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

// One PGlite per test file with the committed migrations applied (decision 0010). Each test
// empties its tables and gets back the rows the migrations wrote, which takes a few milliseconds
// where a clone of the database takes over 100 ms and twice that in CPU.

type TestDatabase = { db: Database; client: PGlite; close: () => Promise<void> };

interface Migrated {
  client: PGlite;
  tables: string[];
  /** The rows the migrations wrote, as JSON, by table. */
  seeded: Map<string, string>;
  schema: string;
}

let migrated: Promise<Migrated> | undefined;
let usedBy: string | undefined;

/** Every table, column, constraint, index, and trigger in the public schema. */
async function schemaOf(client: PGlite): Promise<string> {
  const { rows } = await client.query<{ schema: string }>(`
    select concat_ws(e'\\n',
      (select string_agg(concat_ws(' ', c.relname, c.relkind::text, a.attname,
          format_type(a.atttypid, a.atttypmod), a.attnotnull::text,
          pg_get_expr(d.adbin, d.adrelid)), e'\\n' order by c.relname, a.attnum)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
        left join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
        left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum),
      (select string_agg(concat_ws(' ', conrelid::regclass::text, conname,
          pg_get_constraintdef(oid)), e'\\n' order by conrelid::regclass::text, conname)
        from pg_constraint where connamespace = 'public'::regnamespace),
      (select string_agg(indexdef, e'\\n' order by indexname) from pg_indexes
        where schemaname = 'public'),
      (select string_agg(concat_ws(' ', tgrelid::regclass::text, pg_get_triggerdef(oid)), e'\\n'
          order by tgrelid::regclass::text, tgname)
        from pg_trigger where not tgisinternal)
    ) as schema`);
  return rows[0]?.schema ?? '';
}

function migratedDatabase(): Promise<Migrated> {
  migrated ??= (async () => {
    const client = new PGlite();
    await migrate(drizzle(client, { schema }), { migrationsFolder });
    const { rows } = await client.query<{ name: string }>(
      "select quote_ident(tablename) as name from pg_tables where schemaname = 'public'",
    );
    const tables = rows.map((r) => r.name);
    const seeded = new Map<string, string>();
    for (const table of tables) {
      const { rows } = await client.query<{ rows: string | null }>(
        `select json_agg(t)::text as rows from ${table} t`,
      );
      if (rows[0]?.rows) seeded.set(table, rows[0].rows);
    }
    return { client, tables, seeded, schema: await schemaOf(client) };
  })();
  return migrated;
}

/** Empties every table, then puts back the rows the migrations wrote. */
async function reset(client: PGlite): Promise<void> {
  const { tables, seeded } = await migratedDatabase();
  await client.exec(`truncate ${tables.join(', ')} restart identity`);
  for (const [table, rows] of seeded) {
    await client.query(
      `insert into ${table} overriding system value
       select * from json_populate_recordset(null::${table}, $1)`,
      [rows],
    );
  }
}

afterEach(async () => {
  if (usedBy === undefined || !migrated) return;
  usedBy = undefined;
  const { client, schema } = await migrated;
  const now = await schemaOf(client);
  // The next test gets a new database, so only the test that changed the schema fails.
  if (now !== schema) migrated = undefined;
  expect(
    now,
    'This test changed the schema of the shared test database. Give it createIsolatedTestDatabase().',
  ).toBe(schema);
});

/**
 * The test file's database, emptied, with the rows the committed migrations wrote. A test gets
 * one; to serve the same data again, as a later deploy would, pass it to createTestApp.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const test = expect.getState().currentTestName ?? '';
  if (usedBy === test) {
    throw new Error(
      'A test has one test database. Pass it on, or use createIsolatedTestDatabase().',
    );
  }
  const { client } = await migratedDatabase();
  await reset(client);
  usedBy = test;
  return { db: drizzle(client, { schema }), client, close: async () => {} };
}

/** A copy of its own, for a test that changes the schema. */
export async function createIsolatedTestDatabase(): Promise<TestDatabase> {
  // clone() returns the interface type; the clone is a full PGlite instance.
  const client = (await (await migratedDatabase()).client.clone()) as PGlite;
  await reset(client);
  return { db: drizzle(client, { schema }), client, close: () => client.close() };
}

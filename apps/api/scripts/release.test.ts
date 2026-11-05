import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { TEMPLATES } from '@kerf/core';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema.ts';
import { createProjectService } from '../src/services/projects.ts';
import { createTestApp } from '../test/app.ts';
import { createIsolatedTestDatabase } from '../test/database.ts';
import { nextShape, swingSetInputs, swingSetParams } from '../test/fixtures.ts';
import { release } from './release.ts';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const pooled = 'postgres://kerf@ep-quiet-field-123456-pooler.us-east-1.aws.neon.tech/kerf';
const direct = 'postgres://kerf@ep-quiet-field-123456.us-east-1.aws.neon.tech/kerf';
const production = {
  VERCEL: '1',
  VERCEL_ENV: 'production',
  DATABASE_URL: pooled,
  DATABASE_URL_UNPOOLED: direct,
};
const now = () => new Date('2026-11-01T12:00:00Z');

async function releaseOn(
  client: PGlite,
  templates = TEMPLATES,
  env: Record<string, string | undefined> = production,
) {
  const db = drizzle(client, { schema });
  const calls = { connected: false, migrated: false, closed: false };
  const urls: string[] = [];
  const logs: string[] = [];
  const result = await release({
    env,
    connect: (url) => {
      calls.connected = true;
      urls.push(url);
      return {
        db,
        migrate: async () => {
          calls.migrated = true;
          await migrate(db, { migrationsFolder });
        },
        close: async () => {
          calls.closed = true;
        },
      };
    },
    templates,
    now,
    log: (m) => logs.push(m),
    logError: (e) => {
      throw new Error(`release logged an error: ${String(e)}`);
    },
  });
  return { result, calls, urls, logs };
}

async function contents(client: PGlite) {
  const tables = ['projects', 'project_history', 'project_progress', 'tools'];
  return Promise.all(tables.map(async (t) => (await client.query(`select * from ${t}`)).rows));
}

async function storedProject(database?: Awaited<ReturnType<typeof createIsolatedTestDatabase>>) {
  const app = await createTestApp(database && { database });
  const res = await app.authed('/api/projects', {
    method: 'POST',
    body: {
      name: 'Backyard swing set',
      templateId: 'swing-set-a-frame',
      params: swingSetParams,
      structuralInputs: swingSetInputs,
    },
  });
  const { id } = (await res.json()) as { id: string };
  return { ...app, id };
}

describe('release', () => {
  it('skips a preview deployment without connecting', async () => {
    const connect = () => {
      throw new Error('a preview build must not connect');
    };
    for (const env of [
      { VERCEL: '1', VERCEL_ENV: 'preview' },
      { VERCEL: '1', VERCEL_ENV: 'development' },
      { VERCEL: '1' },
    ]) {
      const logs: string[] = [];
      const result = await release({
        env,
        connect,
        templates: TEMPLATES,
        now,
        log: (m) => logs.push(m),
        logError: () => {},
      });
      expect(result.status).toBe('skipped');
      expect(logs).toHaveLength(1);
    }
  });

  async function refused(env: Record<string, string | undefined>) {
    const logs: string[] = [];
    const connect = () => {
      throw new Error('must not connect');
    };
    const result = await release({
      env,
      connect,
      templates: TEMPLATES,
      now,
      log: (m) => logs.push(m),
      logError: () => {},
    });
    return { result, logs };
  }

  it('refuses a database URL that is not postgres://', async () => {
    const { result, logs } = await refused({ ...production, DATABASE_URL_UNPOOLED: 'mysql://db' });
    expect(result).toEqual({ status: 'invalid-url' });
    expect(logs).toEqual(['release: DATABASE_URL_UNPOOLED must be a postgres:// URL.']);
  });

  it('refuses production with only the pooled DATABASE_URL, without connecting', async () => {
    const { DATABASE_URL_UNPOOLED: _, ...pooledOnly } = production;
    const { result, logs } = await refused(pooledOnly);
    expect(result).toEqual({ status: 'needs-direct-url' });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('DATABASE_URL_UNPOOLED');
    expect(logs[0]).not.toContain('neon.tech');
  });

  it('refuses production without DATABASE_URL_UNPOOLED, even with a direct DATABASE_URL', async () => {
    const { result } = await refused({
      VERCEL: '1',
      VERCEL_ENV: 'production',
      DATABASE_URL: direct,
    });
    expect(result).toEqual({ status: 'needs-direct-url' });
  });

  it('refuses a pooled host in DATABASE_URL_UNPOOLED, without connecting', async () => {
    const { result, logs } = await refused({ ...production, DATABASE_URL_UNPOOLED: pooled });
    expect(result).toEqual({ status: 'needs-direct-url' });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('DATABASE_URL_UNPOOLED');
    expect(logs[0]).not.toContain('neon.tech');
  });

  it('refuses a pooled host outside production too, naming the variable', async () => {
    const { result, logs } = await refused({ DATABASE_URL: pooled });
    expect(result).toEqual({ status: 'needs-direct-url' });
    expect(logs[0]).toContain('DATABASE_URL points at a pooled host');
  });

  it('connects through DATABASE_URL_UNPOOLED in production', async () => {
    const client = new PGlite();
    const { result, urls } = await releaseOn(client);
    expect(result.status).toBe('released');
    expect(urls).toEqual([direct]);
    await client.close();
  });

  it('falls back to DATABASE_URL outside production', async () => {
    const client = new PGlite();
    const { result, urls } = await releaseOn(client, TEMPLATES, { DATABASE_URL: direct });
    expect(result.status).toBe('released');
    expect(urls).toEqual([direct]);
    await client.close();
  });

  it('migrates an empty database', async () => {
    const client = new PGlite();
    const { result, calls } = await releaseOn(client);
    expect(result).toEqual({
      status: 'released',
      history: { projects: 0, rows: 0 },
    });
    expect(calls).toEqual({ connected: true, migrated: true, closed: true });
    const tables = await client.query("select 1 from pg_tables where tablename = 'projects'");
    expect(tables.rows).toHaveLength(1);
    await client.close();
  });

  it('leaves a project stored in the previous shape readable by the previous code', async () => {
    const { client, db, id, close } = await storedProject();
    const [before] = (await client.query('select snapshot from projects')).rows;

    // Released by code with the next shape; read by the current code, still serving.
    const { result } = await releaseOn(client, [nextShape]);
    expect(result.status).toBe('released');

    const [after] = (await client.query('select snapshot from projects')).rows;
    expect(after).toEqual(before);
    const previous = createProjectService({ db, templates: TEMPLATES, now });
    const read = await previous.get(id);
    if (!read.ok) throw new Error('the project should still exist');
    expect(read.value.unreadable).toBeUndefined();
    expect(read.value.snapshot?.snapshotVersion).toBe(TEMPLATES[0]?.snapshotVersion);
    await close();
  });

  it('fails before migrating or writing when a project cannot be read', async () => {
    const { client, id, close } = await storedProject();
    // A project with no history rows, which a release would otherwise backfill.
    await client.query('delete from project_history where project_id = $1', [id]);
    const { rows } = await client.query<{ id: string }>(
      `insert into projects (name, status, template_id, template_version, snapshot)
       values ('Bench', 'planned', 'bench', 1, '{"templateId": "bench", "snapshotVersion": 1}')
       returning id`,
    );
    const before = await contents(client);

    const { result, calls, logs } = await releaseOn(client);
    expect(result).toEqual({
      status: 'unreadable',
      projects: [{ id: rows[0]?.id, reason: 'unknown-template' }],
    });
    expect(calls).toEqual({ connected: true, migrated: false, closed: true });
    expect(logs.at(-1)).toContain(rows[0]?.id);
    expect(await contents(client)).toEqual(before);
    await close();
  });

  it("fails before migrating when a project's template ID differs from its snapshot's", async () => {
    const { client, id, close } = await storedProject(await createIsolatedTestDatabase());
    // As a database from before the check could hold.
    await client.query(
      'alter table projects drop constraint projects_template_id_matches_snapshot',
    );
    await client.query(`update projects set template_id = 'bench' where id = $1`, [id]);

    const { result, calls } = await releaseOn(client);
    expect(result).toEqual({
      status: 'unreadable',
      projects: [{ id, reason: 'template-id-mismatch' }],
    });
    expect(calls.migrated).toBe(false);
    await close();
  });

  it('writes history for a project that has none, and only once', async () => {
    const { client, id, close } = await storedProject();
    const written = (await client.query('select operation_id from project_history')).rows;
    await client.query('delete from project_history where project_id = $1', [id]);

    const first = await releaseOn(client);
    expect(first.result).toMatchObject({
      status: 'released',
      history: { projects: 1, rows: written.length },
    });
    const second = await releaseOn(client);
    expect(second.result).toMatchObject({ status: 'released', history: { projects: 0, rows: 0 } });
    const after = await client.query('select operation_id from project_history');
    expect(after.rows).toHaveLength(written.length);
    await close();
  });

  it("logs a failed step without its query's parameters, and releases the lock", async () => {
    const { client, close } = await storedProject();
    const db = drizzle(client, { schema });
    const errors: unknown[] = [];
    const result = await release({
      env: production,
      connect: () => ({
        db,
        migrate: async () => {
          await db.execute(sql`select ${'secret-parameter'}::text, 1 / 0`);
        },
        close: async () => {},
      }),
      templates: TEMPLATES,
      now,
      log: () => {},
      logError: (e) => errors.push(e),
    });
    expect(result).toEqual({ status: 'failed' });
    expect(errors).toHaveLength(1);
    expect(inspect(errors[0], { depth: null })).toContain('select $1::text, 1 / 0');
    expect(inspect(errors[0], { depth: null })).not.toContain('secret-parameter');
    const locks = await client.query("select 1 from pg_locks where locktype = 'advisory'");
    expect(locks.rows).toEqual([]);
    await close();
  });

  it('releases the lock, so the next release can run', async () => {
    const { client, close } = await storedProject();
    await releaseOn(client);
    const locks = await client.query("select 1 from pg_locks where locktype = 'advisory'");
    expect(locks.rows).toEqual([]);
    await close();
  });
});

describe('project_history', () => {
  it('holds one row per operation in a project', async () => {
    const { client, id, close } = await storedProject();
    const [row] = (
      await client.query<{ operation_id: string }>(
        'select operation_id from project_history where project_id = $1 limit 1',
        [id],
      )
    ).rows;
    await expect(
      client.query(
        `insert into project_history (project_id, operation_id, operation, inventory_key)
         values ($1, $2, 'crosscut', 'k')`,
        [id, row?.operation_id],
      ),
    ).rejects.toThrow(/project_history_operation/);
    await close();
  });
});

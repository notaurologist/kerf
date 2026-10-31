import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { TEMPLATES } from '@kerf/core';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema.ts';
import { createProjectService } from '../src/services/projects.ts';
import { createTestApp } from '../test/app.ts';
import { nextShape, swingSetInputs, swingSetParams } from '../test/fixtures.ts';
import { release } from './release.ts';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const production = { VERCEL: '1', VERCEL_ENV: 'production', DATABASE_URL: 'postgres://db' };
const now = () => new Date('2026-11-01T12:00:00Z');

async function releaseOn(
  client: PGlite,
  templates = TEMPLATES,
  env: Record<string, string | undefined> = production,
) {
  const db = drizzle(client, { schema });
  const calls = { connected: false, migrated: false, closed: false };
  const logs: string[] = [];
  const result = await release({
    env,
    connect: () => {
      calls.connected = true;
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
  });
  return { result, calls, logs };
}

async function contents(client: PGlite) {
  const tables = ['projects', 'project_history', 'project_progress', 'tools', 'other_tools'];
  return Promise.all(tables.map(async (t) => (await client.query(`select * from ${t}`)).rows));
}

async function storedProject() {
  const app = await createTestApp();
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
      });
      expect(result.status).toBe('skipped');
      expect(logs).toHaveLength(1);
    }
  });

  it('refuses a database URL that is not postgres://', async () => {
    const connect = () => {
      throw new Error('must not connect');
    };
    const env = { ...production, DATABASE_URL: 'mysql://db' };
    const result = await release({ env, connect, templates: TEMPLATES, now, log: () => {} });
    expect(result).toEqual({ status: 'invalid-url' });
  });

  it('migrates an empty database', async () => {
    const client = new PGlite();
    const { result, calls } = await releaseOn(client);
    expect(result).toEqual({ status: 'released', history: { projects: 0, rows: 0 } });
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

  it('writes history for a project that has none, and only once', async () => {
    const { client, id, close } = await storedProject();
    const written = (await client.query('select operation_id from project_history')).rows;
    await client.query('delete from project_history where project_id = $1', [id]);

    const first = await releaseOn(client);
    expect(first.result).toEqual({
      status: 'released',
      history: { projects: 1, rows: written.length },
    });
    const second = await releaseOn(client);
    expect(second.result).toEqual({ status: 'released', history: { projects: 0, rows: 0 } });
    const after = await client.query('select operation_id from project_history');
    expect(after.rows).toHaveLength(written.length);
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

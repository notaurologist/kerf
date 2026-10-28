import { describe, expect, it } from 'vitest';
import { createTestDatabase } from './database.ts';

describe('createTestDatabase', () => {
  it('applies the committed migrations', async () => {
    const { client, close } = await createTestDatabase();
    const tables = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by 1",
    );
    expect(tables.rows.map((r) => r.tablename)).toEqual([
      'login_attempts',
      'project_history',
      'projects',
      'sessions',
      'tools',
    ]);
    await close();
  });

  it('enforces the check constraints', async () => {
    const { client, close } = await createTestDatabase();
    const insert = (status: string, name: string) =>
      client.query(
        `insert into projects (name, status, template_id, template_version, params, structural_inputs, snapshot)
         values ($1, $2, 't', 1, '{}', '{}', '{}')`,
        [name, status],
      );
    await expect(insert('done', 'Swing set')).rejects.toThrow(/projects_status/);
    await expect(insert('planned', '  ')).rejects.toThrow(/projects_name/);
    await expect(
      client.query('insert into login_attempts (window_start, failures) values (now(), 0)'),
    ).rejects.toThrow(/login_attempts_failures/);
    await close();
  });

  it("deletes a project's history with the project", async () => {
    const { client, close } = await createTestDatabase();
    const { rows } = await client.query<{ id: string }>(
      `insert into projects (name, status, template_id, template_version, params, structural_inputs, snapshot)
       values ('Swing set', 'planned', 't', 1, '{}', '{}', '{}') returning id`,
    );
    const id = rows[0]?.id;
    await client.query(
      "insert into project_history (project_id, operation, method_id) values ($1, 'crosscut', 'm')",
      [id],
    );
    await client.query('delete from projects where id = $1', [id]);
    const left = await client.query('select * from project_history');
    expect(left.rows).toEqual([]);
    await close();
  });
});

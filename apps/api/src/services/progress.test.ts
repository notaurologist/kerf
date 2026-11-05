import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../test/database.ts';
import { readAllResets } from './progress.ts';

describe('readAllResets', () => {
  it("groups every project's resets under it, oldest first", async () => {
    const { client, db, close } = await createTestDatabase();
    const { rows } = await client.query<{ id: string }>(
      `insert into projects (name, status, template_id, template_version, snapshot)
       values ('A', 'planned', 't', 1, '{"templateId": "t", "templateVersion": 1}'),
              ('B', 'planned', 't', 1, '{"templateId": "t", "templateVersion": 1}')
       returning id`,
    );
    const [a, b] = rows.map((r) => r.id);
    const reset = (project: string | undefined, key: string, at: string) =>
      client.query(
        `insert into project_resets (project_id, kind, key, record, reset_at)
         values ($1, 'part', $2, $3, $4)`,
        [project, key, JSON.stringify({ key }), at],
      );
    await reset(a, 'a2', '2026-11-02T00:00:00Z');
    await reset(b, 'b1', '2026-11-01T12:00:00Z');
    await reset(a, 'a1', '2026-11-01T00:00:00Z');
    await reset(a, 'a3', '2026-11-03T00:00:00Z');

    const byProject = await readAllResets(db);
    const keys = (id: string | undefined) =>
      byProject.get(id ?? '')?.map((r) => (r.record as { key: string }).key);
    expect(keys(a)).toEqual(['a1', 'a2', 'a3']);
    expect(keys(b)).toEqual(['b1']);
    expect(byProject.get(a ?? '')?.[0]?.resetAt).toBe('2026-11-01T00:00:00.000Z');
    await close();
  });
});

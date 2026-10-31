import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from '@kerf/core';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/app.ts';

// Every shape a project has been stored in, as the database holds it, served by today's code.
const templatesFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  ...['..', '..', '..', '..', 'packages', 'core', 'src', 'templates'],
);

const fixtures = TEMPLATES.flatMap((template) => {
  const folder = join(templatesFolder, template.id, 'snapshots');
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const snapshots = JSON.parse(readFileSync(join(folder, file), 'utf8')) as {
        templateId: string;
        templateVersion: number;
      }[];
      return snapshots.map((snapshot, i) => ({ name: `${template.id} ${file} #${i}`, snapshot }));
    });
});

describe('stored projects of every shape', () => {
  it('has fixtures to serve', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)('serves $name', async ({ snapshot }) => {
    const { client, authed, close } = await createTestApp();
    const { rows } = await client.query<{ id: string }>(
      `insert into projects (name, status, template_id, template_version, snapshot)
       values ('Stored', 'planned', $1, $2, $3) returning id`,
      [snapshot.templateId, snapshot.templateVersion, JSON.stringify(snapshot)],
    );
    const id = rows[0]?.id;

    const one = await authed(`/api/projects/${id}`);
    expect(one.status).toBe(200);
    const project = (await one.json()) as Record<string, unknown>;
    expect(project.unreadable).toBeUndefined();
    expect(project.drawings).not.toBeNull();
    expect(project.steps).not.toBeNull();
    expect(project.progress).not.toBeNull();

    const list = await authed('/api/projects');
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ projects: [{ id }] });
    await close();
  });

  it('lists the other projects when one cannot be counted', async () => {
    const [swingSet] = TEMPLATES;
    if (!swingSet) throw new Error('needs a template');
    const throwing = {
      ...swingSet,
      plan: () => {
        throw new Error('a plan this code cannot read');
      },
    };
    const { client, authed, close } = await createTestApp({ templates: [throwing] });
    const current = fixtures.find((f) => f.name.startsWith(swingSet.id))?.snapshot;
    await client.query(
      `insert into projects (name, status, template_id, template_version, snapshot)
       values ('Stored', 'planned', $1, $2, $3)`,
      [current?.templateId, current?.templateVersion, JSON.stringify(current)],
    );
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await authed('/api/projects');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ projects: [{ name: 'Stored', progress: null }] });
    await close();
  });
});

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordCabinet, TEMPLATES } from '@kerf/core';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { swingSetInputs, swingSetParams } from '../../test/fixtures.ts';

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
    expect(project.steps).not.toBeNull();
    expect(project.progress).not.toBeNull();

    const drawings = await authed(`/api/projects/${id}/drawings`);
    expect(drawings.status).toBe(200);
    expect(await drawings.json()).not.toEqual({ drawings: null });

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

  it('opens a project whose drawings and steps cannot be drawn, without them', async () => {
    const [swingSet] = TEMPLATES;
    if (!swingSet) throw new Error('needs a template');
    const throwing = {
      ...swingSet,
      drawings: () => {
        throw new Error('drawings this code cannot draw');
      },
      steps: () => {
        throw new Error('steps this code cannot choose');
      },
    };
    const before = await createTestApp();
    const created = await before.authed('/api/projects', {
      method: 'POST',
      body: {
        name: 'Stored',
        templateId: swingSet.id,
        params: swingSetParams,
        structuralInputs: swingSetInputs,
      },
    });
    const { id } = (await created.json()) as { id: string };
    const { authed, close } = await createTestApp({ database: before, templates: [throwing] });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await authed(`/api/projects/${id}`);
    const drawings = await authed(`/api/projects/${id}/drawings`);
    expect(logged).toHaveBeenCalledWith(
      `project ${id}: the build steps could not be drawn`,
      expect.any(Error),
    );
    expect(logged).toHaveBeenCalledWith(
      `project ${id}: the drawings could not be drawn`,
      expect.any(Error),
    );
    logged.mockRestore();
    expect(res.status).toBe(200);
    const project = (await res.json()) as Record<string, unknown>;
    expect(project.unreadable).toBeUndefined();
    expect(project.snapshot).not.toBeNull();
    expect(project.version).toEqual({ status: 'current', version: swingSet.version });
    expect(project.steps).toBeNull();
    expect(drawings.status).toBe(200);
    expect(await drawings.json()).toEqual({ drawings: null });
    await close();
  });
});

// Vercel refuses a function response over 4.5 MB, and a project is read on every open and save.
// The drawings, which are most of a plan's size, come in a request of their own.
const PROJECT_BUDGET = 1_000_000;
const DRAWINGS_BUDGET = 4_000_000;

const bytes = (text: string) => new TextEncoder().encode(text).length;

const examples = TEMPLATES.flatMap((template) =>
  template.examples.map((example) => ({
    name: `${template.id}: ${example.name}`,
    template,
    example,
  })),
);

describe('response sizes', () => {
  it.each(examples)('keeps $name under budget', async ({ template, example }) => {
    const { authed, close } = await createTestApp();
    const created = await authed('/api/projects', {
      method: 'POST',
      body: {
        name: example.name,
        templateId: template.id,
        params: example.params,
        structuralInputs: example.structuralInputs,
      },
    });
    expect(created.status).toBe(201);
    const text = await created.text();
    expect(bytes(text)).toBeLessThan(PROJECT_BUDGET);
    const { id } = JSON.parse(text) as { id: string };
    const read = await authed(`/api/projects/${id}`);
    expect(read.status).toBe(200);
    expect(bytes(await read.text())).toBeLessThan(PROJECT_BUDGET);
    const drawings = await authed(`/api/projects/${id}/drawings`);
    expect(drawings.status).toBe(200);
    expect(bytes(await drawings.text())).toBeLessThan(DRAWINGS_BUDGET);
    await close();
  });

  // Narrower boards make more board drawings. The most boards found within the ranges: the
  // narrowest boards a panel accepts, the most jointing allowance, 2' lengths (the shortest that
  // hold the pieces), and the largest four-bay case. Doors need boards a stile can be ripped from
  // (#563), so the narrowest boards have none, and the narrowest that allow a 1-1/2" frame, 2", do.
  it.each([
    { width: 1.5, doors: 'none' as const, boards: 110 },
    { width: 2, doors: 'sliding' as const, boards: 100 },
  ])('keeps a record cabinet of $width" boards, doors $doors, under budget', async (c) => {
    const template = recordCabinet.definition;
    const [example] = template.examples;
    if (!example) throw new Error('no worked example');
    const withBoards = (width: number) => ({
      ...example.params,
      width: 72,
      bays: 4,
      caseDepth: 20,
      bayHeight: 18,
      doors: c.doors,
      door: { ...example.params.door, frameWidth: 1.5 },
      board: { source: 'store' as const, thickness: 0.8125, width, lengths: [2] },
      allowances: { ...example.params.allowances, jointPerEdge: 0.25 },
    });
    expect(template.params.safeParse(withBoards(1.5)).success).toBe(true);
    expect(template.params.safeParse(withBoards(1.5 - 0.0625)).success).toBe(false);

    const { authed, close } = await createTestApp();
    const created = await authed('/api/projects', {
      method: 'POST',
      body: {
        name: 'Narrow boards',
        templateId: template.id,
        params: withBoards(c.width),
        structuralInputs: example.structuralInputs,
      },
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const drawings = await authed(`/api/projects/${id}/drawings`);
    expect(drawings.status).toBe(200);
    const text = await drawings.text();
    const { drawings: drawn } = JSON.parse(text) as { drawings: { boards: unknown[] } };
    expect(drawn.boards.length).toBeGreaterThan(c.boards);
    expect(bytes(text)).toBeLessThan(DRAWINGS_BUDGET);
    await close();
  });
});

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  progressItems,
  progressSummary,
  readSnapshot,
  recordCabinet,
  TEMPLATES,
  type TemplateDefinition,
} from '@kerf/core';
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

    const version = await authed(`/api/projects/${id}/version`);
    expect(version.status).toBe(200);
    expect(await version.json()).not.toEqual({ version: null });

    const drawings = await authed(`/api/projects/${id}/drawings`);
    expect(drawings.status).toBe(200);
    const drawn = (await drawings.json()) as {
      drawings: unknown;
      subAssemblies: { id: string }[];
    };
    expect(drawn.drawings).not.toBeNull();
    for (const group of drawn.subAssemblies) {
      const res = await authed(`/api/projects/${id}/subassemblies/${group.id}/drawing`);
      expect(res.status).toBe(200);
      expect(await res.json()).not.toEqual({ drawings: null });
    }

    const list = await authed('/api/projects');
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ projects: [{ id }] });
    await close();
  });

  // The list counts progress from the stored outline (#636); this pins it to the count made from
  // the snapshot, as the list made it before, for a project saved before outlines and after.
  it.each(fixtures)(
    'lists $name with progress as counted from its snapshot',
    async ({ snapshot }) => {
      const { client, authed, close } = await createTestApp();
      const { rows } = await client.query<{ id: string }>(
        `insert into projects (name, status, template_id, template_version, snapshot)
       values ('Stored', 'planned', $1, $2, $3) returning id`,
        [snapshot.templateId, snapshot.templateVersion, JSON.stringify(snapshot)],
      );
      const id = rows[0]?.id;
      const template = TEMPLATES.find((t) => t.id === snapshot.templateId) as TemplateDefinition;
      const read = readSnapshot(TEMPLATES, snapshot);
      if (!read.ok) throw new Error(read.message);
      const outputs = template.storedOutputs.parse(read.snapshot.outputs);
      // Every other item ticked, a minute apart, cut pieces last, so the step to resume at is found
      // through a cutting step's board.
      const last = (kind: string) => (kind === 'part' ? 1 : 0);
      const ticked = progressItems(template, outputs)
        .filter((_, i) => i % 2 === 0)
        .sort((a, b) => last(a.kind) - last(b.kind))
        .map((item, i) => ({
          kind: item.kind,
          key: item.key,
          doneAt: new Date(Date.UTC(2026, 9, 1) + i * 60_000).toISOString(),
        }));
      for (const tick of ticked) {
        await client.query(
          'insert into project_progress (project_id, kind, key, done_at) values ($1, $2, $3, $4)',
          [id, tick.kind, tick.key, tick.doneAt],
        );
      }
      const expected = progressSummary(template, outputs, ticked);

      const listed = async () =>
        ((await (await authed('/api/projects')).json()) as { projects: { progress: unknown }[] })
          .projects[0]?.progress;
      expect(await listed()).toEqual(expected);
      const stored = await client.query<{ revision: number; at: number | null }>(
        'select revision, progress_outline_revision as at from projects where id = $1',
        [id],
      );
      expect(stored.rows[0]?.at).toBe(stored.rows[0]?.revision);
      expect(await listed()).toEqual(expected);
      await close();
    },
  );

  it('lists without reading a snapshot whose outline is current, and reads a stale one once', async () => {
    const [swingSet] = TEMPLATES;
    if (!swingSet) throw new Error('needs a template');
    const plan = vi.fn(swingSet.plan);
    const counting = { ...swingSet, plan };
    const { client, authed, close } = await createTestApp({ templates: [counting] });
    const created = await authed('/api/projects', {
      method: 'POST',
      body: {
        name: 'Stored',
        templateId: swingSet.id,
        params: swingSetParams,
        structuralInputs: swingSetInputs,
      },
    });
    expect(created.status).toBe(201);
    const list = async () => {
      plan.mockClear();
      const res = await authed('/api/projects');
      expect(res.status).toBe(200);
      return plan.mock.calls.length;
    };
    expect(await list()).toBe(0);
    // As a save by the previous deploy leaves it: a new revision, and the outline from before.
    await client.query('update projects set revision = revision + 1');
    expect(await list()).toBe(1);
    expect(await list()).toBe(0);
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
    const step = await authed(`/api/projects/${id}/steps/frames/drawing`);
    expect(logged).toHaveBeenCalledWith(
      `project ${id}: the build steps could not be drawn`,
      expect.any(Error),
    );
    expect(logged).toHaveBeenCalledWith(
      `project ${id}: the drawing for step frames could not be drawn`,
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
    expect(await drawings.json()).toEqual({ drawings: null, subAssemblies: [] });
    expect(step.status).toBe(200);
    expect(await step.json()).toEqual({ drawing: null });
    await close();
  });
});

// Vercel refuses a function response over 4.5 MB, and a project is read on every open and save.
// The drawings, which are most of a plan's size, come in a request of their own, and each build
// step's action drawing in another, opened one step at a time. What regenerating an out-of-date
// plan would change comes in another, with the plan it would store.
const PROJECT_BUDGET = 1_000_000;
const VERSION_BUDGET = 1_000_000;
const DRAWINGS_BUDGET = 4_000_000;
const STEP_DRAWING_BUDGET = 1_000_000;
const SUB_ASSEMBLY_BUDGET = 1_000_000;

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
    const readText = await read.text();
    expect(bytes(readText)).toBeLessThan(PROJECT_BUDGET);
    const drawings = await authed(`/api/projects/${id}/drawings`);
    expect(drawings.status).toBe(200);
    const drawingsText = await drawings.text();
    expect(bytes(drawingsText)).toBeLessThan(DRAWINGS_BUDGET);
    const { subAssemblies } = JSON.parse(drawingsText) as { subAssemblies: { id: string }[] };
    for (const group of subAssemblies) {
      const res = await authed(`/api/projects/${id}/subassemblies/${group.id}/drawing`);
      expect(res.status).toBe(200);
      expect(bytes(await res.text())).toBeLessThan(SUB_ASSEMBLY_BUDGET);
    }
    const { steps } = JSON.parse(readText) as { steps: { steps: { id: string }[] } };
    let drawn = 0;
    for (const step of steps.steps) {
      const res = await authed(`/api/projects/${id}/steps/${step.id}/drawing`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(bytes(text)).toBeLessThan(STEP_DRAWING_BUDGET);
      if ((JSON.parse(text) as { drawing: unknown }).drawing !== null) drawn += 1;
    }
    expect(drawn).toBeGreaterThan(0);
    await close();
  });

  // An out-of-date plan's project response carries only its version status; the plan
  // regenerating would store comes with the version report.
  it('keeps a workbench plan behind its template version under budget', async () => {
    const template = TEMPLATES.find((t) => t.id === 'workbench');
    const example = template?.examples[0];
    if (!template || !example) throw new Error('no workbench worked example');
    const before = await createTestApp();
    const created = await before.authed('/api/projects', {
      method: 'POST',
      body: {
        name: example.name,
        templateId: template.id,
        params: example.params,
        structuralInputs: example.structuralInputs,
      },
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const next = { ...template, version: template.version + 1 };
    const after = await createTestApp({
      database: before,
      templates: TEMPLATES.map((t) => (t.id === template.id ? next : t)),
    });
    const read = await after.authed(`/api/projects/${id}`);
    expect(read.status).toBe(200);
    const readText = await read.text();
    expect(JSON.parse(readText)).toMatchObject({ version: { status: 'behind' } });
    expect(bytes(readText)).toBeLessThan(PROJECT_BUDGET);
    const version = await after.authed(`/api/projects/${id}/version`);
    expect(version.status).toBe(200);
    const versionText = await version.text();
    expect(JSON.parse(versionText)).toMatchObject({
      version: { status: 'behind', regenerated: { ok: true } },
    });
    expect(bytes(versionText)).toBeLessThan(VERSION_BUDGET);
    await before.close();
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

import { createSnapshot, swingSetAFrame, TEMPLATES, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTestApp } from '../../test/app.ts';
import { swingSetInputs, swingSetParams } from '../../test/fixtures.ts';
import { createProjectService } from '../services/projects.ts';

const newProject: Record<string, unknown> = {
  name: 'Backyard swing set',
  templateId: 'swing-set-a-frame',
  params: swingSetParams,
  structuralInputs: swingSetInputs,
};

// biome-ignore lint/suspicious/noExplicitAny: test reads deep into JSON responses.
type Json = any;

async function create(
  authed: Awaited<ReturnType<typeof createTestApp>>['authed'],
  body = newProject,
) {
  const res = await authed('/api/projects', { method: 'POST', body });
  return { status: res.status, body: (await res.json()) as Json };
}

describe('POST /api/projects', () => {
  it('stores the snapshot core generates, and reads it back unchanged (round trip)', async () => {
    const { authed, client } = await createTestApp();
    const created = await create(authed);
    expect(created.status).toBe(201);

    const expected = createSnapshot(
      TEMPLATES[0] as TemplateDefinition,
      swingSetParams,
      swingSetInputs,
    );
    if (!expected.ok) throw new Error('worked example should generate');
    const asJson = JSON.parse(JSON.stringify(expected.output));
    expect(created.body.snapshot).toEqual(asJson);

    // Stored as a JSON object, not a JSON string.
    const { rows } = await client.query<{ type: string }>(
      'select jsonb_typeof(snapshot) as type from projects',
    );
    expect(rows).toEqual([{ type: 'object' }]);

    const read = await authed(`/api/projects/${created.body.id}`);
    expect(read.status).toBe(200);
    const project = (await read.json()) as Json;
    expect(project.snapshot).toEqual(asJson);
    expect(project).toMatchObject({
      name: 'Backyard swing set',
      status: 'planned',
      templateId: 'swing-set-a-frame',
      templateVersion: 1,
      templateBehind: false,
      version: { status: 'current', version: 1 },
    });
    // The structural review is in the snapshot: the worked example's bending margin is 1.08.
    expect(project.snapshot.outputs.structuralReview.beam.bending.margin).toBeCloseTo(1.08, 2);
  });

  it('stores a project with no structural inputs, its checks waiting on input', async () => {
    const { authed } = await createTestApp();
    const { status, body } = await create(authed, { ...newProject, structuralInputs: {} });
    expect(status).toBe(201);
    const review = body.snapshot.outputs.structuralReview;
    expect(review.beam.bending.status).toBe('input-needed');
    expect(review.hanger.missing.map((m: { key: string }) => m.key)).toContain('hangerRating');
  });

  it('answers 422 with the issues for parameters core rejects, storing nothing', async () => {
    const { authed } = await createTestApp();
    const { status, body } = await create(authed, {
      ...newProject,
      params: { ...swingSetParams, beamLength: 10 },
    });
    expect(status).toBe(422);
    expect(body.error).toBe('invalid-project');
    expect(body.issues[0].params).toEqual(['beamLength']);
    expect(await (await authed('/api/projects')).json()).toEqual({ projects: [] });
  });

  it('answers 400 for an unknown template or a missing name', async () => {
    const { authed } = await createTestApp();
    expect((await create(authed, { ...newProject, templateId: 'bookshelf' })).status).toBe(400);
    expect((await create(authed, { ...newProject, name: '  ' })).status).toBe(400);
  });
});

describe('GET /api/projects', () => {
  it('lists projects, most recently updated first, without snapshots', async () => {
    const { authed, clock } = await createTestApp();
    await create(authed, { ...newProject, name: 'First' });
    clock.now = new Date(clock.now.getTime() + 1000);
    await create(authed, { ...newProject, name: 'Second' });
    const body = (await (await authed('/api/projects')).json()) as Json;
    expect(body.projects.map((p: { name: string }) => p.name)).toEqual(['Second', 'First']);
    expect(body.projects[0]).not.toHaveProperty('snapshot');
  });

  it('answers 404 for a project that does not exist, and 400 for a malformed ID', async () => {
    const { authed } = await createTestApp();
    expect((await authed('/api/projects/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await authed('/api/projects/nope')).status).toBe(400);
  });
});

describe('PUT /api/projects/:id', () => {
  it('changes name and status without regenerating', async () => {
    const { authed, client } = await createTestApp();
    const { body } = await create(authed);
    // Tamper with the stored snapshot's name field to show it is left alone.
    await client.query(
      `update projects set snapshot = jsonb_set(snapshot, '{outputs,cutList,0,name}', '"Marked"')`,
    );
    const res = await authed(`/api/projects/${body.id}`, {
      method: 'PUT',
      body: { name: 'Swing set', status: 'in-progress' },
    });
    const updated = (await res.json()) as Json;
    expect(updated).toMatchObject({ name: 'Swing set', status: 'in-progress' });
    expect(updated.snapshot.outputs.cutList[0].name).toBe('Marked');
  });

  it('regenerates when the structural inputs change', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed, { ...newProject, structuralInputs: {} });
    const res = await authed(`/api/projects/${body.id}`, {
      method: 'PUT',
      body: { structuralInputs: swingSetInputs },
    });
    const updated = (await res.json()) as Json;
    expect(updated.snapshot.structuralInputs).toEqual(swingSetInputs);
    expect(updated.snapshot.outputs.structuralReview.beam.bending.status).toBe('computed');
  });

  it('keeps the stored project when new parameters are rejected', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const res = await authed(`/api/projects/${body.id}`, {
      method: 'PUT',
      body: { params: { ...swingSetParams, beamHeight: 1 } },
    });
    expect(res.status).toBe(422);
    const read = (await (await authed(`/api/projects/${body.id}`)).json()) as Json;
    expect(read.snapshot.params.beamHeight).toBe(96);
  });

  it('rejects a change that changes nothing, and a bad status', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const put = (b: unknown) => authed(`/api/projects/${body.id}`, { method: 'PUT', body: b });
    expect((await put({})).status).toBe(400);
    expect((await put({ status: 'done' })).status).toBe(400);
  });
});

// A made-up version 2 of the swing set that changes the first cut-list length, standing in for a
// real template change (decision 0008).
const version2: TemplateDefinition = {
  ...(swingSetAFrame.definition as TemplateDefinition),
  version: 2,
  generate(params, inputs) {
    const result = (swingSetAFrame.definition as TemplateDefinition).generate(params, inputs);
    if (!result.ok) return result;
    const outputs = result.output as { cutList: { length: string }[] };
    const [first, ...rest] = outputs.cutList;
    return {
      ok: true,
      output: { ...outputs, cutList: first ? [{ ...first, length: '121"' }, ...rest] : rest },
    };
  },
};

describe('a project whose template version is behind', () => {
  it('reports what regenerating would change, and regenerates only when asked', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);

    // The same database, served by code whose template is now at version 2.
    const after = await createTestApp({ database: before, templates: [version2] });
    const get = async (path: string, method = 'GET') =>
      (await (await after.authed(path, { method })).json()) as Json;

    const list = await get('/api/projects');
    expect(list.projects[0]).toMatchObject({ templateVersion: 1, templateBehind: true });

    const project = await get(`/api/projects/${body.id}`);
    expect(project.version).toEqual({
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: {
        ok: true,
        changes: [{ path: 'cutList[0].length', before: '120"', after: '121"' }],
        truncated: false,
      },
    });
    // The stored plan is still version 1's.
    expect(project.snapshot.outputs.cutList[0].length).toBe('120"');

    const regenerated = await get(`/api/projects/${body.id}/regenerate`, 'POST');
    expect(regenerated).toMatchObject({
      templateVersion: 2,
      templateBehind: false,
      version: { status: 'current', version: 2 },
    });
    expect(regenerated.snapshot.outputs.cutList[0].length).toBe('121"');
  });

  it('says so when a stored snapshot is damaged, rather than guessing', async () => {
    const { authed, client } = await createTestApp();
    const { body } = await create(authed);
    await client.query(
      `update projects set snapshot = jsonb_set(snapshot, '{outputs,cutList}', '"damaged"')`,
    );
    const project = (await (await authed(`/api/projects/${body.id}`)).json()) as Json;
    expect(project).toMatchObject({
      snapshot: null,
      unreadable: { reason: 'malformed' },
      version: null,
    });
    const regenerate = await authed(`/api/projects/${body.id}/regenerate`, { method: 'POST' });
    expect(regenerate.status).toBe(500);
  });
});

// A made-up shape 2 of the swing-set snapshot that renames outputs.cutList to outputs.cuts, with
// its upgrade (decision 0014).
const shape2: TemplateDefinition = {
  ...(swingSetAFrame.definition as TemplateDefinition),
  snapshotVersion: 2,
  outputs: z.looseObject({ cuts: z.array(z.object({ length: z.string() }).loose()) }),
  snapshotUpgrades: {
    1: (s) => {
      const { cutList, ...outputs } = s.outputs as { cutList: unknown };
      return { ...s, outputs: { ...outputs, cuts: cutList } };
    },
  },
};

describe('a project stored in an older snapshot shape', () => {
  it('reads through the upgrade, keeping the stored numbers', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);
    const after = await createTestApp({ database: before, templates: [shape2] });
    const project = (await (await after.authed(`/api/projects/${body.id}`)).json()) as Json;
    expect(project.snapshot.snapshotVersion).toBe(2);
    expect(project.snapshot.outputs.cuts[0].length).toBe('120"');
    expect(project.version).toEqual({ status: 'current', version: 1 });
  });

  it('is rewritten in the current shape by the release backfill, numbers and dates unchanged', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);
    const service = createProjectService({
      db: before.db,
      templates: [shape2],
      now: () => new Date('2030-01-01T00:00:00Z'),
    });
    expect(await service.upgradeStoredSnapshots()).toEqual({ upgraded: 1, unreadable: [] });
    expect(await service.upgradeStoredSnapshots()).toEqual({ upgraded: 0, unreadable: [] });

    const { rows } = await before.client.query<{ snapshot: Json; updated_at: Date }>(
      'select snapshot, updated_at from projects',
    );
    expect(rows[0]?.snapshot.snapshotVersion).toBe(2);
    expect(rows[0]?.snapshot.outputs.cuts[0].length).toBe('120"');
    expect(rows[0]?.snapshot.outputs).not.toHaveProperty('cutList');
    expect(rows[0]?.updated_at.toISOString()).toBe(body.updatedAt);
  });
});

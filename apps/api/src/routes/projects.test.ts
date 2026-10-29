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

// Versions relative to the template's current ones, so these tests outlive real bumps.
const CURRENT = swingSetAFrame.definition.version;
const SHAPE = swingSetAFrame.definition.snapshotVersion;

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
      templateVersion: CURRENT,
      templateBehind: false,
      version: { status: 'current', version: CURRENT },
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

describe('GET /api/projects/:id drawings', () => {
  it("returns the plan's drawings, drawn by core from the stored snapshot", async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const project = (await (await authed(`/api/projects/${body.id}`)).json()) as Json;
    const expected = swingSetAFrame.definition.drawings(
      swingSetAFrame.definition.outputs.parse(project.snapshot.outputs),
    );
    expect(project.drawings).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(project.drawings.isometric.title).toBe('Isometric view');
    expect(project.drawings.cutDetails).toHaveLength(project.snapshot.outputs.cutList.length);
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

// A made-up next version of the swing set that changes the first cut-list length, standing in
// for a real template change (decision 0008).
const nextVersion: TemplateDefinition = {
  ...(swingSetAFrame.definition as TemplateDefinition),
  version: CURRENT + 1,
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

describe('POST /api/projects/:id/preview', () => {
  const preview = (
    authed: Awaited<ReturnType<typeof createTestApp>>['authed'],
    id: string,
    body: unknown,
  ) => authed(`/api/projects/${id}/preview`, { method: 'POST', body });

  it('returns the snapshot and what it changes, saving nothing', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const res = await preview(authed, body.id, { params: { ...swingSetParams, beamLength: 132 } });
    expect(res.status).toBe(200);
    const result = (await res.json()) as Json;
    expect(result.snapshot.params.beamLength).toBe(132);
    expect(result.snapshot.outputs.cutList[0].length).toBe('132"');
    expect(result.truncated).toBe(false);
    expect(result.changes).toContainEqual({
      path: 'cutList[0].length',
      before: '120"',
      after: '132"',
    });

    const stored = (await (await authed(`/api/projects/${body.id}`)).json()) as Json;
    expect(stored.snapshot).toEqual(body.snapshot);
    expect(stored.updatedAt).toBe(body.updatedAt);
  });

  it('keeps the stored inputs when only the parameters are sent, and the reverse', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const withParams = (await (
      await preview(authed, body.id, { params: { ...swingSetParams, beamLength: 132 } })
    ).json()) as Json;
    expect(withParams.snapshot.structuralInputs).toEqual(swingSetInputs);
    const withInputs = (await (
      await preview(authed, body.id, { structuralInputs: {} })
    ).json()) as Json;
    expect(withInputs.snapshot.params).toEqual(swingSetParams);
    expect(withInputs.changes).toContainEqual(
      expect.objectContaining({
        path: 'checks[0].status',
        before: 'computed',
        after: 'input-needed',
      }),
    );
  });

  it('answers 422 with core issues for parameters core rejects', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const res = await preview(authed, body.id, { params: { ...swingSetParams, beamLength: 10 } });
    expect(res.status).toBe(422);
    const result = (await res.json()) as Json;
    expect(result.error).toBe('invalid-project');
    expect(result.issues[0].params).toEqual(['beamLength']);
  });

  it('answers 404 for a missing project, 400 for a body that changes nothing', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await preview(authed, missing, { name: 'x' })).status).toBe(404);
    expect((await preview(authed, body.id, {})).status).toBe(400);
  });

  it('requires a session', async () => {
    const { app, authed } = await createTestApp();
    const { body } = await create(authed);
    const res = await app.request(`/api/projects/${body.id}/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ params: swingSetParams }),
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('deletes the project and its history rows, then answers 404 for it', async () => {
    const { authed, client } = await createTestApp();
    const { body } = await create(authed);
    const other = await create(authed, { ...newProject, name: 'Kept' });
    await client.query(
      `insert into project_history (project_id, operation, method_id) values ($1, 'crosscut', 'circular-saw')`,
      [body.id],
    );

    const res = await authed(`/api/projects/${body.id}`, { method: 'DELETE', body: {} });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');

    expect((await authed(`/api/projects/${body.id}`)).status).toBe(404);
    const history = await client.query('select count(*)::int as n from project_history');
    expect(history.rows).toEqual([{ n: 0 }]);
    const list = (await (await authed('/api/projects')).json()) as Json;
    expect(list.projects.map((p: Json) => p.id)).toEqual([other.body.id]);
  });

  it('answers 404 for a project that does not exist, and 400 for a malformed ID', async () => {
    const { authed } = await createTestApp();
    const missing = '/api/projects/00000000-0000-4000-8000-000000000000';
    expect((await authed(missing, { method: 'DELETE', body: {} })).status).toBe(404);
    expect((await authed('/api/projects/nope', { method: 'DELETE', body: {} })).status).toBe(400);
  });
});

describe('a project whose template version is behind', () => {
  it('reports what regenerating would change, and regenerates only when asked', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);

    // The same database, served by code whose template is now at the next version.
    const after = await createTestApp({ database: before, templates: [nextVersion] });
    const get = async (path: string, method = 'GET') =>
      (await (await after.authed(path, { method })).json()) as Json;

    const list = await get('/api/projects');
    expect(list.projects[0]).toMatchObject({ templateVersion: CURRENT, templateBehind: true });

    const project = await get(`/api/projects/${body.id}`);
    expect(project.version).toEqual({
      status: 'behind',
      storedVersion: CURRENT,
      currentVersion: CURRENT + 1,
      regenerated: {
        ok: true,
        changes: [{ path: 'cutList[0].length', before: '120"', after: '121"' }],
        truncated: false,
      },
    });
    // The stored plan is still the earlier version's.
    expect(project.snapshot.outputs.cutList[0].length).toBe('120"');

    const regenerated = await get(`/api/projects/${body.id}/regenerate`, 'POST');
    expect(regenerated).toMatchObject({
      templateVersion: CURRENT + 1,
      templateBehind: false,
      version: { status: 'current', version: CURRENT + 1 },
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

// A made-up next shape of the swing-set snapshot that renames outputs.cutList to outputs.cuts,
// with its upgrade (decision 0014).
const nextShape: TemplateDefinition = {
  ...(swingSetAFrame.definition as TemplateDefinition),
  snapshotVersion: SHAPE + 1,
  outputs: z.looseObject({ cuts: z.array(z.object({ length: z.string() }).loose()) }),
  snapshotUpgrades: {
    ...swingSetAFrame.definition.snapshotUpgrades,
    [SHAPE]: (s) => {
      const { cutList, ...outputs } = s.outputs as { cutList: unknown };
      return { ...s, outputs: { ...outputs, cuts: cutList } };
    },
  },
};

describe('a project stored in an older snapshot shape', () => {
  it('reads through the upgrade, keeping the stored numbers', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);
    const after = await createTestApp({ database: before, templates: [nextShape] });
    const project = (await (await after.authed(`/api/projects/${body.id}`)).json()) as Json;
    expect(project.snapshot.snapshotVersion).toBe(SHAPE + 1);
    expect(project.snapshot.outputs.cuts[0].length).toBe('120"');
    expect(project.version).toEqual({ status: 'current', version: CURRENT });
  });

  it('is rewritten in the current shape by the release backfill, numbers and dates unchanged', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);
    const service = createProjectService({
      db: before.db,
      templates: [nextShape],
      now: () => new Date('2030-01-01T00:00:00Z'),
    });
    expect(await service.upgradeStoredSnapshots()).toEqual({ upgraded: 1, unreadable: [] });
    expect(await service.upgradeStoredSnapshots()).toEqual({ upgraded: 0, unreadable: [] });

    const { rows } = await before.client.query<{ snapshot: Json; updated_at: Date }>(
      'select snapshot, updated_at from projects',
    );
    expect(rows[0]?.snapshot.snapshotVersion).toBe(SHAPE + 1);
    expect(rows[0]?.snapshot.outputs.cuts[0].length).toBe('120"');
    expect(rows[0]?.snapshot.outputs).not.toHaveProperty('cutList');
    expect(rows[0]?.updated_at.toISOString()).toBe(body.updatedAt);
  });
});

import {
  BuildSteps,
  cornerViews,
  createSnapshot,
  geometry,
  type Inventory,
  inventoryKey,
  projectDrawings,
  readSnapshot,
  swingSetAFrame,
  TEMPLATES,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { nextShape, swingSetInputs, swingSetParams } from '../../test/fixtures.ts';
import { backfillHistory } from '../services/history.ts';

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
    // Stored as core makes it, with each empty part list left out; returned as read, with each
    // filled back in.
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
    const asRead = readSnapshot(TEMPLATES, asJson);
    if (!asRead.ok) throw new Error(asRead.message);
    const readJson = JSON.parse(JSON.stringify(asRead.snapshot));
    expect(created.body.snapshot).toEqual(readJson);

    // Stored as a JSON object, not a JSON string.
    const { rows } = await client.query<{ type: string; snapshot: unknown }>(
      'select jsonb_typeof(snapshot) as type, snapshot from projects',
    );
    expect(rows).toEqual([{ type: 'object', snapshot: asJson }]);

    const read = await authed(`/api/projects/${created.body.id}`);
    expect(read.status).toBe(200);
    const project = (await read.json()) as Json;
    expect(project.snapshot).toEqual(readJson);
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
    const outputs = swingSetAFrame.definition.storedOutputs.parse(project.snapshot.outputs);
    const plan = swingSetAFrame.definition.plan(outputs);
    const expected = projectDrawings(swingSetAFrame.definition, outputs);
    expect(project.drawings).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(project.drawings.boards).toHaveLength(plan.lumber.boards.length);
    expect(project.drawings.isometric.title).toBe('Isometric view');
    expect(project.drawings.cutDetails).toHaveLength(project.snapshot.outputs.cutList.length);
  });
});

describe('GET /api/projects/:id/views/:corner (#364)', () => {
  it('draws the assembled and exploded views from each corner, the front left as the project has', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const project = (await (await authed(`/api/projects/${body.id}`)).json()) as Json;
    const outputs = swingSetAFrame.definition.storedOutputs.parse(project.snapshot.outputs);
    for (const corner of geometry.CORNERS) {
      const res = await authed(`/api/projects/${body.id}/views/${corner}`);
      expect(res.status).toBe(200);
      const views = (await res.json()) as Json;
      const expected = cornerViews(swingSetAFrame.definition, outputs, corner);
      expect(views).toEqual(JSON.parse(JSON.stringify(expected)));
    }
    const frontLeft = (await (
      await authed(`/api/projects/${body.id}/views/front-left`)
    ).json()) as Json;
    expect(frontLeft.isometric).toEqual(project.drawings.isometric);
    expect(frontLeft.exploded).toEqual(project.drawings.exploded);
    const back = (await (await authed(`/api/projects/${body.id}/views/back-right`)).json()) as Json;
    expect(back.isometric.description).toBe(
      'The swing set, assembled. Seen from the back right, above.',
    );
  });

  it('answers 404 for a missing project and 400 for a corner it does not know', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await authed(`/api/projects/${missing}/views/front-right`)).status).toBe(404);
    expect((await authed(`/api/projects/${body.id}/views/top`)).status).toBe(400);
  });
});

describe('GET /api/projects/:id build steps (#52)', () => {
  it('returns every build step in the project response, chosen from the current inventory', async () => {
    const { authed, putTools } = await createTestApp();
    const { body } = await create(authed);
    const read = async () => (await (await authed(`/api/projects/${body.id}`)).json()) as Json;

    // No tools yet: every operation has a step, and none has a method. A part cut from two boards
    // has its cuts in both boards' steps (#58).
    const before = await read();
    const empty = { tools: [] };
    expect(BuildSteps.parse(before.steps).inventoryKey).toBe(inventoryKey(empty));
    const operations = before.snapshot.outputs.design.operations;
    const stepped = before.steps.steps.flatMap((s: Json) => s.operations);
    expect([...new Set(stepped.map((o: Json) => o.operation.id))].sort()).toEqual(
      operations.map((o: Json) => o.id).sort(),
    );
    expect(stepped.every((o: Json) => o.method === undefined && o.needed)).toBe(true);

    // With a miter saw that cuts a 4x6, the beam's ends get the miter-saw method, and the key
    // names the new inventory.
    const tools: Inventory = {
      tools: [
        { toolTypeId: 'miter-saw', capabilities: { cutDepth: 4, crosscutWidth: 12 } },
        { toolTypeId: 'tape-measure', capabilities: {} },
      ],
    };
    expect((await putTools(tools)).status).toBe(200);
    const after = await read();
    expect(after.steps.inventoryKey).toBe(inventoryKey(tools));
    expect(after.steps.inventoryKey).not.toBe(before.steps.inventoryKey);
    const beam = after.steps.steps.find((s: Json) =>
      s.board?.pieces.some((p: Json) => p.partId === 'beam'),
    );
    expect(beam.operations.map((o: Json) => o.method?.id)).toEqual([
      'crosscut-miter-saw',
      'crosscut-miter-saw',
    ]);
  });
});

describe('project history (#106)', () => {
  type HistoryRow = {
    operation_id: string;
    operation: string;
    method_id: string | null;
    skills: string[];
    inventory_key: string;
  };
  async function history(client: Awaited<ReturnType<typeof createTestApp>>['client'], id: string) {
    const { rows } = await client.query<HistoryRow>(
      `select operation_id, operation, method_id, skills, inventory_key
       from project_history where project_id = $1 order by id`,
      [id],
    );
    return rows;
  }
  const miterSaw: Inventory = {
    tools: [
      { toolTypeId: 'miter-saw', capabilities: { cutDepth: 4, crosscutWidth: 12, maxMiter: 50 } },
      { toolTypeId: 'tape-measure', capabilities: {} },
    ],
  };

  it('writes a row for every operation when a project is created', async () => {
    const { authed, client } = await createTestApp();
    const { body } = await create(authed);
    const rows = await history(client, body.id);
    const operations = body.snapshot.outputs.design.operations as { id: string; type: string }[];
    expect(rows.map((r) => [r.operation_id, r.operation]).sort()).toEqual(
      operations.map((o) => [o.id, o.type]).sort(),
    );
    // No tools yet: no method, no skills, and the empty inventory's key.
    expect(rows.every((r) => r.method_id === null && r.skills.length === 0)).toBe(true);
    expect(new Set(rows.map((r) => r.inventory_key))).toEqual(
      new Set([inventoryKey({ tools: [] })]),
    );
  });

  it('replaces the rows when the parameters change or the project is regenerated, not on a rename', async () => {
    const { authed, client, putTools } = await createTestApp();
    const { body } = await create(authed);
    const before = await history(client, body.id);
    expect((await putTools(miterSaw)).status).toBe(200);

    // A rename keeps the snapshot, so its history stands.
    await authed(`/api/projects/${body.id}`, {
      method: 'PUT',
      body: { name: 'Renamed', revision: 1 },
    });
    expect(await history(client, body.id)).toEqual(before);

    // New parameters save a new snapshot: the rows are rewritten from the current tools.
    const params = { ...swingSetParams, beamHeight: swingSetParams.beamHeight - 1 };
    const updated = await authed(`/api/projects/${body.id}`, {
      method: 'PUT',
      body: { params, revision: 2 },
    });
    expect(updated.status).toBe(200);
    const after = await history(client, body.id);
    expect(after).toHaveLength(before.length);
    expect(after.find((r) => r.operation_id === 'beam/end-0')).toMatchObject({
      method_id: 'crosscut-miter-saw',
      skills: ['measure-and-mark', 'cut-to-a-line'],
      inventory_key: inventoryKey(miterSaw),
    });

    // Regenerating rewrites them too, from the tools at that moment.
    await putTools({ tools: [] });
    const regenerated = await authed(`/api/projects/${body.id}/regenerate`, {
      method: 'POST',
      body: { revision: 3 },
    });
    expect(regenerated.status).toBe(200);
    const again = await history(client, body.id);
    expect(again.every((r) => r.method_id === null)).toBe(true);
  });

  it('backfills rows at release for projects that have none, and keeps rows that exist', async () => {
    const { authed, client, db, putTools } = await createTestApp();
    const first = await create(authed);
    const second = await create(authed, { ...newProject, name: 'Second' });
    await client.query('delete from project_history where project_id = $1', [first.body.id]);
    const kept = await history(client, second.body.id);
    await putTools(miterSaw);

    const backfill = () => backfillHistory({ db, templates: TEMPLATES, now: () => new Date() });
    const result = await backfill();
    expect(result.projects).toBe(1);
    const filled = await history(client, first.body.id);
    expect(result.rows).toBe(filled.length);
    expect(filled.length).toBe(kept.length);
    expect(filled[0]?.inventory_key).toBe(inventoryKey(miterSaw));
    expect(await history(client, second.body.id)).toEqual(kept);
    expect(await backfill()).toEqual({ projects: 0, rows: 0 });
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
      body: { name: 'Swing set', status: 'in-progress', revision: 1 },
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
      body: { structuralInputs: swingSetInputs, revision: 1 },
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
      body: { params: { ...swingSetParams, beamHeight: 1 }, revision: 1 },
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

describe('POST /api/projects/preview', () => {
  const draft = { templateId: 'swing-set-a-frame', params: swingSetParams, structuralInputs: {} };

  it('returns the snapshot a create would store, marks nothing changed, and saves nothing', async () => {
    const { authed, client } = await createTestApp();
    const res = await authed('/api/projects/preview', { method: 'POST', body: draft });
    expect(res.status).toBe(200);
    const result = (await res.json()) as Json;
    const expected = createSnapshot(TEMPLATES[0] as TemplateDefinition, swingSetParams, {});
    if (!expected.ok) throw new Error('worked example should generate');
    expect(result.snapshot).toEqual(JSON.parse(JSON.stringify(expected.output)));
    expect(result.changes).toEqual([]);
    expect(result.truncated).toBe(false);
    const { rows } = await client.query('select id from projects');
    expect(rows).toEqual([]);
  });

  it('takes the create body as it is, name and status included', async () => {
    const { authed } = await createTestApp();
    const res = await authed('/api/projects/preview', { method: 'POST', body: newProject });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).snapshot.structuralInputs).toEqual(swingSetInputs);
  });

  it('answers 422 with core issues, and 400 for an unknown template', async () => {
    const { authed } = await createTestApp();
    const rejected = await authed('/api/projects/preview', {
      method: 'POST',
      body: { ...draft, params: { ...swingSetParams, beamLength: 10 } },
    });
    expect(rejected.status).toBe(422);
    expect(((await rejected.json()) as Json).issues[0].params).toEqual(['beamLength']);
    const unknown = await authed('/api/projects/preview', {
      method: 'POST',
      body: { ...draft, templateId: 'bookshelf' },
    });
    expect(unknown.status).toBe(400);
    expect(((await unknown.json()) as Json).error).toBe('unknown-template');
  });

  it('requires a session', async () => {
    const { app } = await createTestApp();
    const res = await app.request('/api/projects/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    });
    expect(res.status).toBe(401);
  });
});

describe('deleting, the trash, and restoring (#21)', () => {
  const historyCount = async (client: Json, id: string) =>
    (
      await client.query('select count(*)::int as n from project_history where project_id = $1', [
        id,
      ])
    ).rows[0]?.n;

  it('moves a deleted project to the trash, out of every other route, and keeps its history', async () => {
    const { authed, client } = await createTestApp();
    const { body } = await create(authed);
    const other = await create(authed, { ...newProject, name: 'Kept' });
    const history = await historyCount(client, body.id);
    expect(history).toBeGreaterThan(0);

    const res = await authed(`/api/projects/${body.id}`, { method: 'DELETE', body: {} });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');

    expect((await authed(`/api/projects/${body.id}`)).status).toBe(404);
    expect(
      (
        await authed(`/api/projects/${body.id}/regenerate`, {
          method: 'POST',
          body: { revision: 1 },
        })
      ).status,
    ).toBe(404);
    expect((await authed(`/api/projects/${body.id}`, { method: 'DELETE', body: {} })).status).toBe(
      404,
    );
    const list = (await (await authed('/api/projects')).json()) as Json;
    expect(list.projects.map((p: Json) => p.id)).toEqual([other.body.id]);
    expect(await historyCount(client, body.id)).toBe(history);

    // Deleted at the test clock's 2026-10-28 noon, purged 30 days later.
    const trash = (await (await authed('/api/trash')).json()) as Json;
    expect(trash.projects).toHaveLength(1);
    expect(trash.projects[0]).toMatchObject({
      id: body.id,
      name: body.name,
      deletedAt: '2026-10-28T12:00:00.000Z',
      purgeAt: '2026-11-27T12:00:00.000Z',
    });
  });

  it('restores a project from the trash as it was', async () => {
    const { authed } = await createTestApp();
    const { body } = await create(authed);
    await authed(`/api/projects/${body.id}`, { method: 'DELETE', body: {} });
    const res = await authed(`/api/trash/${body.id}/restore`, { method: 'POST', body: {} });
    expect(res.status).toBe(204);
    const read = (await (await authed(`/api/projects/${body.id}`)).json()) as Json;
    expect(read.snapshot).toEqual(body.snapshot);
    expect((await (await authed('/api/trash')).json()) as Json).toEqual({ projects: [] });
    // Only a project in the trash can be restored.
    expect(
      (await authed(`/api/trash/${body.id}/restore`, { method: 'POST', body: {} })).status,
    ).toBe(404);
  });

  it('deletes a project in the trash for good, with its history, but only from the trash', async () => {
    const { authed, client } = await createTestApp();
    const { body } = await create(authed);
    expect((await authed(`/api/trash/${body.id}`, { method: 'DELETE', body: {} })).status).toBe(
      404,
    );
    await authed(`/api/projects/${body.id}`, { method: 'DELETE', body: {} });
    expect((await authed(`/api/trash/${body.id}`, { method: 'DELETE', body: {} })).status).toBe(
      204,
    );
    expect(await historyCount(client, body.id)).toBe(0);
    expect((await (await authed('/api/trash')).json()) as Json).toEqual({ projects: [] });
  });

  it('purges a project 30 days after it was deleted, not before', async () => {
    const { authed, clock, client } = await createTestApp();
    const { body } = await create(authed);
    await authed(`/api/projects/${body.id}`, { method: 'DELETE', body: {} });
    const deleted = clock.now.getTime();
    const day = 24 * 60 * 60 * 1000;
    clock.now = new Date(deleted + 30 * day);
    expect(((await (await authed('/api/trash')).json()) as Json).projects).toHaveLength(1);
    clock.now = new Date(deleted + 30 * day + 1);
    expect(((await (await authed('/api/trash')).json()) as Json).projects).toHaveLength(0);
    expect(await historyCount(client, body.id)).toBe(0);
  });

  it('answers 404 for a project that does not exist, and 400 for a malformed ID', async () => {
    const { authed } = await createTestApp();
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await authed(`/api/projects/${missing}`, { method: 'DELETE', body: {} })).status).toBe(
      404,
    );
    expect((await authed('/api/projects/nope', { method: 'DELETE', body: {} })).status).toBe(400);
    expect(
      (await authed(`/api/trash/${missing}/restore`, { method: 'POST', body: {} })).status,
    ).toBe(404);
    expect((await authed('/api/trash/nope', { method: 'DELETE', body: {} })).status).toBe(400);
  });
});

describe('GET /api/export (#21)', () => {
  it('downloads every project as stored, with its ticks, the trash apart, and the tool rows as stored', async () => {
    const { authed, client } = await createTestApp();
    const { body } = await create(authed);
    await client.query(
      `insert into tools (position, tool_type_id, name, capabilities)
       values (0, 'retired-tool-type', 'Old saw', '{"kept": true}')`,
    );
    const gone = await create(authed, { ...newProject, name: 'Gone' });
    await authed(`/api/projects/${gone.body.id}`, { method: 'DELETE', body: {} });

    const res = await authed('/api/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="kerf-2026-10-28.json"',
    );
    const exported = (await res.json()) as Json;
    const stored = async (id: string) =>
      (
        await client.query<{ snapshot: unknown }>('select snapshot from projects where id = $1', [
          id,
        ])
      ).rows[0]?.snapshot;
    expect(exported.kind).toBe('kerf-export');
    expect(exported.formatVersion).toBe(2);
    expect(exported.exportedAt).toBe('2026-10-28T12:00:00.000Z');
    expect(exported.projects.map((p: Json) => p.id)).toEqual([body.id]);
    expect(exported.projects[0].snapshot).toEqual(await stored(body.id));
    expect(exported.projects[0].ticks).toEqual([]);
    expect(exported.deletedProjects.map((p: Json) => p.id)).toEqual([gone.body.id]);
    expect(exported.deletedProjects[0].deletedAt).toBe('2026-10-28T12:00:00.000Z');
    expect(exported.deletedProjects[0].snapshot).toEqual(await stored(gone.body.id));
    expect(exported.tools.tools).toEqual([
      {
        toolTypeId: 'retired-tool-type',
        name: 'Old saw',
        position: 0,
        capabilities: { kept: true },
      },
    ]);
  });

  it('leaves a purged project out', async () => {
    const { authed } = await createTestApp();
    const gone = await create(authed, { ...newProject, name: 'Gone' });
    await authed(`/api/projects/${gone.body.id}`, { method: 'DELETE', body: {} });
    await authed(`/api/trash/${gone.body.id}`, { method: 'DELETE', body: {} });

    const exported = (await (await authed('/api/export')).json()) as Json;
    expect(exported.projects).toEqual([]);
    expect(exported.deletedProjects).toEqual([]);
  });

  it('streams a backup larger than the 4.5 MB Vercel allows an unstreamed response', async () => {
    const { authed, client } = await createTestApp();
    const { body } = await create(authed);
    // Copies of one stored project, enough to pass the limit whatever a snapshot measures.
    const snapshotBytes = JSON.stringify(body.snapshot).length;
    const LIMIT = 4.5 * 1024 * 1024;
    const copies = Math.ceil(LIMIT / snapshotBytes) + 5;
    await client.query(
      `insert into projects (name, status, template_id, template_version, snapshot)
       select name || ' ' || n, status, template_id, template_version, snapshot
       from projects, generate_series(1, $1) as n`,
      [copies],
    );

    const res = await authed('/api/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBeNull();
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let text = '';
    let pieces = 0;
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      pieces += 1;
      text += decoder.decode(read.value, { stream: true });
    }
    text += decoder.decode();

    expect(new TextEncoder().encode(text).length).toBeGreaterThan(LIMIT);
    expect(pieces).toBeGreaterThan(copies);
    const exported = JSON.parse(text) as Json;
    expect(exported).toMatchObject({ kind: 'kerf-export', formatVersion: 2 });
    expect(exported.projects).toHaveLength(copies + 1);
    const { rows } = await client.query<{ snapshot: unknown }>(
      'select snapshot from projects where id = $1',
      [body.id],
    );
    expect(exported.projects.at(-1).snapshot).toEqual(rows[0]?.snapshot);
  });
});

describe('the trash and export routes', () => {
  it('require a session', async () => {
    const { app } = await createTestApp();
    const id = '00000000-0000-4000-8000-000000000000';
    for (const [path, method] of [
      ['/api/trash', 'GET'],
      [`/api/trash/${id}/restore`, 'POST'],
      [`/api/trash/${id}`, 'DELETE'],
      ['/api/export', 'GET'],
    ] as const) {
      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(method === 'GET' ? {} : { body: '{}' }),
      });
      expect({ path, status: res.status }).toEqual({ path, status: 401 });
    }
  });
});

describe('a stored project whose template this code no longer has', () => {
  it('opens, saying why its plan cannot be read', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);
    const after = await createTestApp({ database: before, templates: [] });
    const res = await after.authed(`/api/projects/${body.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: body.id,
      name: 'Backyard swing set',
      snapshot: null,
      unreadable: {
        reason: 'unknown-template',
        message: 'No template has the ID "swing-set-a-frame".',
      },
      version: null,
      drawings: null,
      steps: null,
    });
  });

  it('answers a preview as the server’s problem, not the request’s', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);
    const after = await createTestApp({ database: before, templates: [] });
    const res = await after.authed(`/api/projects/${body.id}/preview`, {
      method: 'POST',
      body: { name: 'x' },
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'missing-template' });
  });

  it('refuses a template ID longer than any template has', async () => {
    const { authed } = await createTestApp();
    const res = await authed('/api/projects/preview', {
      method: 'POST',
      body: { templateId: 'x'.repeat(101), params: swingSetParams, structuralInputs: {} },
    });
    expect(res.status).toBe(400);
  });
});

describe('a project whose template version is behind', () => {
  it('reports what regenerating would change, and regenerates only when asked', async () => {
    const before = await createTestApp();
    const { body } = await create(before.authed);

    // The same database, served by code whose template is now at the next version.
    const after = await createTestApp({ database: before, templates: [nextVersion] });
    const get = async (path: string) => (await (await after.authed(path)).json()) as Json;

    const list = await get('/api/projects');
    expect(list.projects[0]).toMatchObject({ templateVersion: CURRENT, templateBehind: true });

    const project = await get(`/api/projects/${body.id}`);
    expect(project.version).toEqual({
      status: 'behind',
      storedVersion: CURRENT,
      currentVersion: CURRENT + 1,
      regenerated: {
        ok: true,
        outputs: expect.objectContaining({ cutList: expect.any(Array) }),
        changes: [{ path: 'cutList[0].length', before: '120"', after: '121"' }],
        truncated: false,
      },
    });
    expect(project.version.regenerated.outputs.cutList[0].length).toBe('121"');
    // The stored plan is still the earlier version's.
    expect(project.snapshot.outputs.cutList[0].length).toBe('120"');

    const regenerated = (await (
      await after.authed(`/api/projects/${body.id}/regenerate`, {
        method: 'POST',
        body: { revision: project.revision },
      })
    ).json()) as Json;
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
    const regenerate = await authed(`/api/projects/${body.id}/regenerate`, {
      method: 'POST',
      body: { revision: 1 },
    });
    expect(regenerate.status).toBe(500);
  });
});

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
});

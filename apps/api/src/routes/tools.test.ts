import {
  recordCabinet,
  swingSetAFrame,
  type TemplateDefinition,
  unletteredView,
  workbench,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';

describe('/api/tools', () => {
  it('starts empty', async () => {
    const { authed } = await createTestApp();
    expect(await (await authed('/api/tools')).json()).toEqual({ tools: [], revision: 1 });
  });

  it('replaces the whole inventory and reads it back', async () => {
    const { authed } = await createTestApp();
    const first = {
      tools: [
        { toolTypeId: 'drill-driver', capabilities: {} },
        { toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.4375 } },
        { toolTypeId: 'clamps', name: 'Long', capabilities: { maxOpening: 24 } },
        { toolTypeId: 'clamps', name: 'Short', capabilities: {} },
      ],
    };
    const put = await authed('/api/tools', { method: 'PUT', body: { ...first, revision: 1 } });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ ...first, revision: 2 });

    const second = { tools: [{ toolTypeId: 'rafter-square', capabilities: {} }] };
    await authed('/api/tools', { method: 'PUT', body: { ...second, revision: 2 } });
    expect(await (await authed('/api/tools')).json()).toEqual({ ...second, revision: 3 });
  });

  it('refuses a save made on an older list with 409, saving nothing and keeping the revision (#426)', async () => {
    const { authed } = await createTestApp();
    const mine = { tools: [{ toolTypeId: 'level', capabilities: {} }] };
    const theirs = { tools: [{ toolTypeId: 'jigsaw', capabilities: {} }] };
    await authed('/api/tools', { method: 'PUT', body: { ...theirs, revision: 1 } });

    const stale = await authed('/api/tools', { method: 'PUT', body: { ...mine, revision: 1 } });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'stale-tools', revision: 2 });
    expect(await (await authed('/api/tools')).json()).toEqual({ ...theirs, revision: 2 });

    // A revision from the future is refused the same way.
    const ahead = await authed('/api/tools', { method: 'PUT', body: { ...mine, revision: 3 } });
    expect(ahead.status).toBe(409);

    // Naming the current revision saves over the newer list.
    const over = await authed('/api/tools', { method: 'PUT', body: { ...mine, revision: 2 } });
    expect(await over.json()).toEqual({ ...mine, revision: 3 });
  });

  it('requires the revision', async () => {
    const { authed } = await createTestApp();
    const put = await authed('/api/tools', { method: 'PUT', body: { tools: [] } });
    expect(put.status).toBe(400);
  });

  it('needs a session to read or save', async () => {
    const { app } = await createTestApp();
    const headers = { 'content-type': 'application/json' };
    expect((await app.request('/api/tools')).status).toBe(401);
    const put = await app.request('/api/tools', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ tools: [], revision: 1 }),
    });
    expect(put.status).toBe(401);
  });

  it('starts at revision 1 for a database whose revision row was never written', async () => {
    const { authed, client } = await createTestApp();
    await client.query('delete from tools_revision');
    expect(await (await authed('/api/tools')).json()).toEqual({ tools: [], revision: 1 });
    const put = await authed('/api/tools', { method: 'PUT', body: { tools: [], revision: 1 } });
    expect(await put.json()).toEqual({ tools: [], revision: 2 });
  });

  it('lets one of several saves made on the same revision through, and refuses the rest', async () => {
    const { app, sessionCookie } = await createTestApp();
    const cookie = await sessionCookie();
    const put = (toolTypeId: string) =>
      app.request('/api/tools', {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ tools: [{ toolTypeId, capabilities: {} }], revision: 1 }),
      });
    const results = await Promise.all(['hand-saw', 'jigsaw', 'level'].map(put));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    const stored = (await (await app.request('/api/tools', { headers: { cookie } })).json()) as {
      tools: unknown[];
    };
    expect(stored.tools).toHaveLength(1);
  });

  it('refuses an inventory longer than anyone keeps', async () => {
    const { authed } = await createTestApp();
    const tools = Array.from({ length: 201 }, (_, i) => ({
      toolTypeId: 'clamps',
      name: `Clamp ${i}`,
      capabilities: {},
    }));
    const put = await authed('/api/tools', { method: 'PUT', body: { tools } });
    expect(put.status).toBe(400);
  });

  it('rejects unnamed repeats, IDs not in the library, and capabilities out of range, changing nothing', async () => {
    const { authed } = await createTestApp();
    const put = (body: object) =>
      authed('/api/tools', { method: 'PUT', body: { ...body, revision: 1 } });
    const dup = {
      tools: [
        { toolTypeId: 'drill-driver', capabilities: {} },
        { toolTypeId: 'drill-driver', capabilities: {} },
      ],
    };
    expect((await put(dup)).status).toBe(400);
    const unknown = { tools: [{ toolTypeId: 'lathe', capabilities: {} }] };
    const res = await put(unknown);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      issues: [
        { path: ['tools', '0', 'toolTypeId'], message: 'is not a tool type in the library' },
      ],
    });
    const range = { tools: [{ toolTypeId: 'miter-saw', capabilities: { maxMiter: 120 } }] };
    expect((await put(range)).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect(await (await authed('/api/tools')).json()).toEqual({ tools: [], revision: 1 });
  });

  it('reads an inventory stored before the library, leaving out what no method can use (#363)', async () => {
    const { authed, client } = await createTestApp();
    // Rows as M3 to M5 stored them: free-text IDs and capability names.
    await client.query(
      `insert into tools (position, tool_type_id, capabilities) values
         (0, 'circular-saw', '{"bevels": true, "depthOfCut": 2.375}'),
         (1, 'lathe', '{}')`,
    );
    expect(await (await authed('/api/tools')).json()).toEqual({
      tools: [{ toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.375 } }],
      revision: 1,
    });
    const stored = await client.query('select tool_type_id from tools order by position');
    expect(stored.rows).toEqual([{ tool_type_id: 'circular-saw' }, { tool_type_id: 'lathe' }]);
  });
});

describe('/api/templates', () => {
  it('lists each template with its current version and what it is', async () => {
    const { authed } = await createTestApp();
    expect(await (await authed('/api/templates')).json()).toEqual({
      templates: [
        {
          id: 'swing-set-a-frame',
          version: swingSetAFrame.definition.version,
          name: 'Two-swing A-frame swing set',
          description: swingSetAFrame.definition.description,
        },
        {
          id: 'record-cabinet',
          version: recordCabinet.definition.version,
          name: 'Record cabinet',
          description: recordCabinet.definition.description,
        },
        {
          id: 'workbench',
          version: workbench.definition.version,
          name: 'Workbench',
          description: workbench.definition.description,
        },
      ],
    });
  });

  it("draws a template's first worked example, assembled and unlettered, from core", async () => {
    const { authed } = await createTestApp();
    // The templates' types differ, so they are read through the shared definition type.
    const definitions: TemplateDefinition[] = [
      swingSetAFrame.definition,
      recordCabinet.definition,
      workbench.definition as TemplateDefinition,
    ];
    for (const definition of definitions) {
      const example = definition.examples[0];
      if (!example) throw new Error('no worked example');
      const made = definition.generate(example.params, example.structuralInputs);
      if (!made.ok) throw new Error('worked example does not generate');
      const expected = JSON.parse(JSON.stringify(unletteredView(definition, made.output)));
      expect(expected.primitives.some((p: { kind: string }) => p.kind === 'letter')).toBe(false);
      const res = await authed(`/api/templates/${definition.id}/drawing`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ drawing: expected });
    }
  });

  it('answers an unknown template with not-found', async () => {
    const { authed } = await createTestApp();
    const res = await authed('/api/templates/shed/drawing');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not-found' });
  });
});

describe('/api/templates/:id/suggestions', () => {
  const suggestions = (authed: Authed, id: string, body: unknown) =>
    authed(`/api/templates/${id}/suggestions`, { method: 'POST', body });

  it("suggests each template's starting values from core, for every answer set it gives", async () => {
    const { authed } = await createTestApp();
    const definitions: TemplateDefinition[] = [swingSetAFrame.definition, recordCabinet.definition];
    for (const { id, questions } of definitions) {
      if (!questions) throw new Error(`${id} asks no questions`);
      for (const answers of questions.examples) {
        const res = await suggestions(authed, id, { answers });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(
          JSON.parse(JSON.stringify({ suggestions: questions.suggest(answers) })),
        );
      }
    }
  });

  it('sizes the swing set’s bolts, which generates the frame', async () => {
    const { authed } = await createTestApp();
    const answers = swingSetAFrame.definition.questions?.examples[0];
    const res = await suggestions(authed, 'swing-set-a-frame', { answers });
    const body = (await res.json()) as { suggestions: { path: string; value: unknown }[] };
    const bolt = body.suggestions.find((s) => s.path === 'hardware.legBoltDiameter');
    expect(typeof bolt?.value).toBe('number');
  });

  it("refuses answers the template's schema does not read, with each problem under answers", async () => {
    const { authed } = await createTestApp();
    const res = await suggestions(authed, 'swing-set-a-frame', { answers: { riders: 'kids' } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: { path: string[] }[] };
    expect(body.error).toBe('invalid-request');
    expect(body.issues.length).toBeGreaterThan(0);
    for (const issue of body.issues) expect(issue.path[0]).toBe('answers');
    expect((await suggestions(authed, 'swing-set-a-frame', {})).status).toBe(400);
  });

  it('answers an unknown template with not-found', async () => {
    const { authed } = await createTestApp();
    const res = await suggestions(authed, 'shed', { answers: {} });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not-found' });
  });

  it('needs a session', async () => {
    const { app } = await createTestApp();
    const res = await app.request('/api/templates/swing-set-a-frame/suggestions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: swingSetAFrame.definition.questions?.examples[0] }),
    });
    expect(res.status).toBe(401);
  });
});

type Authed = Awaited<ReturnType<typeof createTestApp>>['authed'];

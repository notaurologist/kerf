import { recordCabinet, swingSetAFrame, type TemplateDefinition, unletteredView } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';

describe('/api/tools', () => {
  it('starts empty', async () => {
    const { authed } = await createTestApp();
    expect(await (await authed('/api/tools')).json()).toEqual({ tools: [] });
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
    const put = await authed('/api/tools', { method: 'PUT', body: first });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual(first);

    const second = { tools: [{ toolTypeId: 'rafter-square', capabilities: {} }] };
    await authed('/api/tools', { method: 'PUT', body: second });
    expect(await (await authed('/api/tools')).json()).toEqual(second);
  });

  it('takes saves sent at the same moment one after the other, the last one kept', async () => {
    const { app, sessionCookie } = await createTestApp();
    const cookie = await sessionCookie();
    const put = (toolTypeId: string) =>
      app.request('/api/tools', {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ tools: [{ toolTypeId, capabilities: {} }] }),
      });
    const results = await Promise.all(['hand-saw', 'jigsaw', 'level'].map(put));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
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
    const put = (body: unknown) => authed('/api/tools', { method: 'PUT', body });
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
    expect(await (await authed('/api/tools')).json()).toEqual({ tools: [] });
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
      ],
    });
  });

  it("draws a template's first worked example, assembled and unlettered, from core", async () => {
    const { authed } = await createTestApp();
    // The two templates' types differ, so they are read through the shared definition type.
    const definitions: TemplateDefinition[] = [swingSetAFrame.definition, recordCabinet.definition];
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

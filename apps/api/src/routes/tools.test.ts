import { swingSetAFrame } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';

describe('/api/tools', () => {
  it('starts empty', async () => {
    const { authed } = await createTestApp();
    expect(await (await authed('/api/tools')).json()).toEqual({ tools: [], other: [] });
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
      other: [
        { name: 'Table saw', note: 'Tilts to 45' },
        { name: 'Router', note: '' },
      ],
    };
    const put = await authed('/api/tools', { method: 'PUT', body: first });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual(first);

    const second = { tools: [{ toolTypeId: 'rafter-square', capabilities: {} }], other: [] };
    await authed('/api/tools', { method: 'PUT', body: second });
    expect(await (await authed('/api/tools')).json()).toEqual(second);
  });

  it('takes saves sent at the same moment one after the other, the last one kept', async () => {
    const { app, sessionCookie } = await createTestApp();
    const cookie = await sessionCookie();
    const put = (name: string) =>
      app.request('/api/tools', {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ tools: [], other: [{ name, note: '' }] }),
      });
    const results = await Promise.all(['A', 'B', 'C'].map(put));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    const stored = (await (await app.request('/api/tools', { headers: { cookie } })).json()) as {
      other: { name: string }[];
    };
    expect(stored.other).toHaveLength(1);
  });

  it('refuses an inventory longer than anyone keeps', async () => {
    const { authed } = await createTestApp();
    const other = Array.from({ length: 201 }, (_, i) => ({ name: `Tool ${i}`, note: '' }));
    const put = await authed('/api/tools', { method: 'PUT', body: { tools: [], other } });
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
      other: [],
    };
    expect((await put(dup)).status).toBe(400);
    const unknown = { tools: [{ toolTypeId: 'lathe', capabilities: {} }], other: [] };
    const res = await put(unknown);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      issues: [
        { path: ['tools', '0', 'toolTypeId'], message: 'is not a tool type in the library' },
      ],
    });
    const range = {
      tools: [{ toolTypeId: 'miter-saw', capabilities: { maxMiter: 120 } }],
      other: [],
    };
    expect((await put(range)).status).toBe(400);
    expect((await put({ tools: [] })).status).toBe(400);
    expect(await (await authed('/api/tools')).json()).toEqual({ tools: [], other: [] });
  });

  it('reads an inventory stored before the library, leaving the rows as stored', async () => {
    const { authed, client } = await createTestApp();
    // Rows as M3 to M5 stored them: free-text IDs and capability names.
    await client.query(
      `insert into tools (position, tool_type_id, capabilities) values
         (0, 'circular-saw', '{"bevels": true, "depthOfCut": 2.375}'),
         (1, 'lathe', '{}')`,
    );
    const expected = {
      tools: [{ toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.375 } }],
      other: [
        {
          name: 'circular-saw',
          note: 'Moved here from your tool list. Details the circular saw entry cannot use. Earlier values: bevels: true.',
        },
        {
          name: 'lathe',
          note: 'Moved here from your tool list. Not a tool type in the library.',
        },
      ],
    };
    expect(await (await authed('/api/tools')).json()).toEqual(expected);

    const stored = await client.query('select tool_type_id from tools order by position');
    expect(stored.rows).toEqual([{ tool_type_id: 'circular-saw' }, { tool_type_id: 'lathe' }]);
  });
});

describe('/api/templates', () => {
  it('lists each template with its current version', async () => {
    const { authed } = await createTestApp();
    expect(await (await authed('/api/templates')).json()).toEqual({
      templates: [
        {
          id: 'swing-set-a-frame',
          version: swingSetAFrame.definition.version,
          name: 'Two-swing A-frame swing set',
        },
      ],
    });
  });
});

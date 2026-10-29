import { swingSetAFrame } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { upgradeStoredInventory } from '../services/tools.ts';

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
        { toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.4375, maxBevel: 50 } },
      ],
      other: [
        { name: 'Table saw', note: 'Tilts to 45' },
        { name: 'Router', note: '' },
      ],
    };
    const put = await authed('/api/tools', { method: 'PUT', body: first });
    expect(put.status).toBe(200);
    // Library tools sorted by ID; other tools in the order given.
    expect(await put.json()).toEqual({
      tools: [first.tools[1], first.tools[0]],
      other: first.other,
    });

    const second = { tools: [{ toolTypeId: 'rafter-square', capabilities: {} }], other: [] };
    await authed('/api/tools', { method: 'PUT', body: second });
    expect(await (await authed('/api/tools')).json()).toEqual(second);
  });

  it('rejects duplicates, IDs not in the library, and capabilities out of range, changing nothing', async () => {
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
    const unknown = { tools: [{ toolTypeId: 'table-saw', capabilities: {} }], other: [] };
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

  it('reads an inventory stored before the library, and the release step rewrites it', async () => {
    const { authed, client, db } = await createTestApp();
    // Rows as M3 to M5 stored them: free-text IDs and capability names.
    await client.query(
      `insert into tools (tool_type_id, capabilities) values
         ('circular-saw', '{"bevels": true, "maxBevel": 56}'),
         ('table-saw', '{}')`,
    );
    const expected = {
      tools: [{ toolTypeId: 'circular-saw', capabilities: { maxBevel: 56 } }],
      other: [
        {
          name: 'circular-saw',
          note: 'Moved here from your tool list. Details the circular saw entry cannot use. Earlier values: bevels: true.',
        },
        {
          name: 'table-saw',
          note: 'Moved here from your tool list. Not a tool type in the library.',
        },
      ],
    };
    expect(await (await authed('/api/tools')).json()).toEqual(expected);

    const now = new Date('2026-10-29T12:00:00Z');
    expect(await upgradeStoredInventory(db, now)).toBe(2);
    expect(await upgradeStoredInventory(db, now)).toBe(0);
    const stored = await client.query('select tool_type_id from tools');
    expect(stored.rows).toEqual([{ tool_type_id: 'circular-saw' }]);
    expect(await (await authed('/api/tools')).json()).toEqual(expected);
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

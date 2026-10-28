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
        { toolTypeId: 'circular-saw', capabilities: { bevels: true, maxBevel: 56 } },
      ],
    };
    const put = await authed('/api/tools', { method: 'PUT', body: first });
    expect(put.status).toBe(200);
    // Sorted by ID.
    expect(await put.json()).toEqual({ tools: [first.tools[1], first.tools[0]] });

    const second = { tools: [{ toolTypeId: 'speed-square', capabilities: {} }] };
    await authed('/api/tools', { method: 'PUT', body: second });
    expect(await (await authed('/api/tools')).json()).toEqual(second);
  });

  it('rejects duplicate and malformed tool type IDs, changing nothing', async () => {
    const { authed } = await createTestApp();
    const dup = {
      tools: [
        { toolTypeId: 'drill-driver', capabilities: {} },
        { toolTypeId: 'drill-driver', capabilities: {} },
      ],
    };
    expect((await authed('/api/tools', { method: 'PUT', body: dup })).status).toBe(400);
    const bad = { tools: [{ toolTypeId: 'Drill Driver', capabilities: {} }] };
    expect((await authed('/api/tools', { method: 'PUT', body: bad })).status).toBe(400);
    expect(await (await authed('/api/tools')).json()).toEqual({ tools: [] });
  });
});

describe('/api/templates', () => {
  it('lists each template with its current version', async () => {
    const { authed } = await createTestApp();
    expect(await (await authed('/api/templates')).json()).toEqual({
      templates: [{ id: 'swing-set-a-frame', version: 1, name: 'Two-swing A-frame swing set' }],
    });
  });
});

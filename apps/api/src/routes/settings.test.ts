import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { swingSetInputs, swingSetParams } from '../../test/fixtures.ts';

// biome-ignore lint/suspicious/noExplicitAny: test reads deep into JSON responses.
type Json = any;

describe('/api/settings', () => {
  it('starts with nothing entered', async () => {
    const { authed } = await createTestApp();
    expect(await (await authed('/api/settings')).json()).toEqual({
      carryLength: null,
      revision: 1,
    });
  });

  it('saves the carry length and clears it', async () => {
    const { authed } = await createTestApp();
    const put = await authed('/api/settings', {
      method: 'PUT',
      body: { carryLength: 96, revision: 1 },
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ carryLength: 96, revision: 2 });
    await authed('/api/settings', { method: 'PUT', body: { carryLength: null, revision: 2 } });
    expect(await (await authed('/api/settings')).json()).toEqual({
      carryLength: null,
      revision: 3,
    });
  });

  it('refuses a save made on older settings with 409, saving nothing', async () => {
    const { authed } = await createTestApp();
    await authed('/api/settings', { method: 'PUT', body: { carryLength: 96, revision: 1 } });
    const stale = await authed('/api/settings', {
      method: 'PUT',
      body: { carryLength: 120, revision: 1 },
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'stale-settings', revision: 2 });
    expect(await (await authed('/api/settings')).json()).toEqual({
      carryLength: 96,
      revision: 2,
    });
  });

  it('refuses a carry length that is not a positive length, and a missing revision', async () => {
    const { authed } = await createTestApp();
    for (const body of [
      { carryLength: 0, revision: 1 },
      { carryLength: -12, revision: 1 },
      { carryLength: '96', revision: 1 },
      { carryLength: 96 },
    ]) {
      const res = await authed('/api/settings', { method: 'PUT', body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('projects and the carry length', () => {
  const newProject = {
    name: 'Backyard swing set',
    templateId: 'swing-set-a-frame',
    params: swingSetParams,
    structuralInputs: swingSetInputs,
  };

  it('plans new projects with it, and offers to replan older ones only when asked', async () => {
    const { authed } = await createTestApp();
    const made = (await (
      await authed('/api/projects', { method: 'POST', body: newProject })
    ).json()) as Json;
    expect(made.version.status).toBe('current');
    expect(made.snapshot.outputs.lumber).not.toHaveProperty('carryLength');

    await authed('/api/settings', { method: 'PUT', body: { carryLength: 120, revision: 1 } });

    const opened = (await (await authed(`/api/projects/${made.id}`)).json()) as Json;
    expect(opened.version).toMatchObject({
      status: 'carry-length',
      storedCarryLength: null,
      carryLength: 120,
      regenerated: { ok: true },
    });
    // The stored plan is unchanged until the owner regenerates.
    expect(opened.snapshot.outputs.lumber).not.toHaveProperty('carryLength');
    expect(opened.revision).toBe(made.revision);

    const regenerated = await authed(`/api/projects/${made.id}/regenerate`, {
      method: 'POST',
      body: { revision: made.revision },
    });
    expect(regenerated.status).toBe(200);
    const after = (await regenerated.json()) as Json;
    expect(after.snapshot.outputs.lumber.carryLength).toBe(120);
    expect(after.version.status).toBe('current');

    const fresh = (await (
      await authed('/api/projects', { method: 'POST', body: newProject })
    ).json()) as Json;
    expect(fresh.snapshot.outputs.lumber.carryLength).toBe(120);
  });
});

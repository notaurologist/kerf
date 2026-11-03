import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { swingSetInputs, swingSetParams } from '../../test/fixtures.ts';

// A change made mid-build (#444) on the swing-set worked example: a front leg cut at 138-3/8"
// becomes 140-3/16" when the beam goes from a 4x6 to a 4x8 (core's resets.test.ts has the
// working). The preview names what the save would reset, and the save records it until the owner
// dismisses it.

// biome-ignore lint/suspicious/noExplicitAny: test reads deep into JSON responses.
type Json = any;

const LEG = {
  kind: 'part',
  key: 'leg-front/0',
  item: 'C Front leg (downhill), piece 1',
  change: 'cut at 138-3/8", now 140-3/16"',
};

async function setup() {
  const test = await createTestApp();
  const res = await test.authed('/api/projects', {
    method: 'POST',
    body: {
      name: 'Backyard swing set',
      templateId: 'swing-set-a-frame',
      params: swingSetParams,
      structuralInputs: swingSetInputs,
    },
  });
  const { id } = (await res.json()) as { id: string };
  const project = async () => (await (await test.authed(`/api/projects/${id}`)).json()) as Json;
  const tick = async (changes: { kind: string; key: string }[]) =>
    test.authed(`/api/projects/${id}/progress`, {
      method: 'PATCH',
      body: {
        revision: (await project()).revision,
        changes: changes.map((c) => ({ ...c, done: true })),
      },
    });
  const params = (beamStock: string) => ({ ...swingSetParams, beamStock });
  const save = async (beamStock: string) =>
    test.authed(`/api/projects/${id}`, {
      method: 'PUT',
      body: { params: params(beamStock), revision: (await project()).revision },
    });
  const dismiss = async (resets: { kind: string; key: string; resetAt: string }[]) =>
    test.authed(`/api/projects/${id}/resets/dismiss`, { method: 'POST', body: { resets } });
  return { ...test, id, project, tick, save, params, dismiss };
}

describe('resets after a change made mid-build', () => {
  it('need a session to dismiss', async () => {
    const { app, id } = await setup();
    const res = await app.request(`/api/projects/${id}/resets/dismiss`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resets: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('are listed in the preview before saving, and nothing is cleared', async () => {
    const { id, authed, tick, params, project } = await setup();
    await tick([{ kind: 'part', key: 'leg-front/0' }]);
    const res = await authed(`/api/projects/${id}/preview`, {
      method: 'POST',
      body: { params: params('4x8') },
    });
    expect(res.status).toBe(200);
    const preview = (await res.json()) as Json;
    expect(preview.progressReset).toEqual([
      expect.objectContaining({ ...LEG, replacement: expect.objectContaining({ feet: 12 }) }),
    ]);
    const now = await project();
    expect(now.ticks).toHaveLength(1);
    expect(now.resets).toEqual([]);
  });

  it('stay on the project after saving, read against the plan, until dismissed', async () => {
    const { tick, save, project, dismiss, clock } = await setup();
    await tick([
      { kind: 'part', key: 'leg-front/0' },
      { kind: 'shopping-line', key: 'lumber/4x6/12' },
    ]);
    const saved = (await (await save('4x8')).json()) as Json;
    const resetAt = clock.now.toISOString();
    expect(saved.resets).toEqual([
      expect.objectContaining({ ...LEG, stepIds: ['board-2'], resetAt }),
      expect.objectContaining({ item: '4x6 × 12\' 0"', change: 'bought 1; no longer in the plan' }),
    ]);

    // Back to the 4x6: the leg is the length it was cut at again, and its note says so.
    clock.now = new Date(clock.now.getTime() + 60_000);
    await save('4x6');
    const back = await project();
    expect(back.resets[0]).toMatchObject({
      key: 'leg-front/0',
      change: 'cut at 138-3/8", the same length now; its end cuts, marks, or holes changed',
      resetAt,
    });

    const res = await dismiss([{ kind: 'part', key: 'leg-front/0', resetAt }]);
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).resets.map((r: Json) => r.key)).toEqual(['lumber/4x6/12']);
    expect((await project()).resets.map((r: Json) => r.key)).toEqual(['lumber/4x6/12']);
  });

  it('keep a later reset of the item when an older one is dismissed', async () => {
    const { tick, save, project, dismiss, clock } = await setup();
    await tick([{ kind: 'part', key: 'leg-front/0' }]);
    await save('4x8');
    const first = clock.now.toISOString();
    // The owner cuts a new leg and ticks it, then changes the beam again.
    clock.now = new Date(clock.now.getTime() + 60_000);
    await tick([{ kind: 'part', key: 'leg-front/0' }]);
    await save('4x6');
    const second = clock.now.toISOString();
    expect((await project()).resets).toEqual([
      expect.objectContaining({
        key: 'leg-front/0',
        change: 'cut at 140-3/16", now 138-3/8"',
        resetAt: second,
      }),
    ]);

    await dismiss([{ kind: 'part', key: 'leg-front/0', resetAt: first }]);
    expect((await project()).resets).toHaveLength(1);
  });

  it('rejects a malformed dismissal and an unknown project', async () => {
    const { authed, dismiss } = await setup();
    expect((await dismiss([])).status).toBe(400);
    expect((await dismiss([{ kind: 'part', key: 'x', resetAt: 'yesterday' }])).status).toBe(400);
    const missing = '00000000-0000-4000-8000-000000000000';
    const res = await authed(`/api/projects/${missing}/resets/dismiss`, {
      method: 'POST',
      body: { resets: [{ kind: 'part', key: 'x', resetAt: new Date().toISOString() }] },
    });
    expect(res.status).toBe(404);
  });

  it('go into the backup file as stored', async () => {
    const { tick, save, authed } = await setup();
    await tick([{ kind: 'part', key: 'leg-front/0' }]);
    await save('4x8');
    const exported = (await (await authed('/api/export')).json()) as Json;
    expect(exported.projects[0].resets).toEqual([
      {
        record: expect.objectContaining({ kind: 'part', key: 'leg-front/0', reason: 'changed' }),
        resetAt: expect.any(String),
      },
    ]);
  });
});

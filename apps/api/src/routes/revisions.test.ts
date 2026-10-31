import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { swingSetInputs, swingSetParams } from '../../test/fixtures.ts';

// Two devices saving one project (#207): a save or tick made against an older revision of the
// plan is refused, so neither silently undoes the other.

// biome-ignore lint/suspicious/noExplicitAny: test reads deep into JSON responses.
type Json = any;

async function setup() {
  const test = await createTestApp();
  const res = await test.authed('/api/projects', {
    method: 'POST',
    body: {
      name: 'Backyard swing set',
      templateId: 'swing-set-a-frame',
      params: swingSetParams,
      structuralInputs: {},
    },
  });
  const created = (await res.json()) as Json;
  const path = `/api/projects/${created.id}`;
  const put = async (body: unknown) => {
    const r = await test.authed(path, { method: 'PUT', body });
    return { status: r.status, body: (await r.json()) as Json };
  };
  const tick = async (revision: number, key: string) => {
    const r = await test.authed(`${path}/progress`, {
      method: 'PATCH',
      body: { revision, changes: [{ kind: 'step', key, done: true }] },
    });
    return { status: r.status, body: (await r.json()) as Json };
  };
  const read = async () => (await (await test.authed(path)).json()) as Json;
  return { ...test, created, path, put, tick, read };
}

describe('project revisions', () => {
  it('start at 1 and are sent with every project', async () => {
    const { created, authed } = await setup();
    expect(created.revision).toBe(1);
    const list = (await (await authed('/api/projects')).json()) as Json;
    expect(list.projects[0].revision).toBe(1);
  });

  it('refuse a save made against an older revision, and keep the newer one', async () => {
    const { put, read } = await setup();
    // Both devices opened revision 1. The laptop saves structural inputs first.
    const laptop = await put({ structuralInputs: swingSetInputs, revision: 1 });
    expect(laptop.status).toBe(200);
    expect(laptop.body.revision).toBe(2);
    // The phone's save of new parameters, made against revision 1, would regenerate with the
    // old, empty inputs. It is refused with the revision it missed.
    const phone = await put({ params: { ...swingSetParams, crossbarHeight: 44 }, revision: 1 });
    expect(phone).toEqual({ status: 409, body: { error: 'stale-project', revision: 2 } });
    const stored = await read();
    expect(stored.snapshot.structuralInputs).toEqual(swingSetInputs);
    expect(stored.snapshot.params.crossbarHeight).toBe(swingSetParams.crossbarHeight);
    // Saved again on purpose against revision 2, it keeps the laptop's inputs.
    const again = await put({ params: { ...swingSetParams, crossbarHeight: 44 }, revision: 2 });
    expect(again.status).toBe(200);
    expect(again.body.revision).toBe(3);
    expect(again.body.snapshot.structuralInputs).toEqual(swingSetInputs);
    expect(again.body.snapshot.params.crossbarHeight).toBe(44);
  });

  it('let only one of two saves sent at once against the same revision through', async () => {
    const { put, read } = await setup();
    const [a, b] = await Promise.all([
      put({ name: 'Swing set A', revision: 1 }),
      put({ name: 'Swing set B', revision: 1 }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? 'Swing set A' : 'Swing set B';
    expect((await read()).name).toBe(winner);
  });

  it('need a revision to change the plan, and none to change the status', async () => {
    const { put, tick, read } = await setup();
    expect((await put({ name: 'Swing set' })).status).toBe(400);
    expect((await put({ params: swingSetParams })).status).toBe(400);
    const status = await put({ status: 'in-progress' });
    expect(status.status).toBe(200);
    // Neither a status change nor a tick changes the plan, so neither moves the revision.
    expect(status.body.revision).toBe(1);
    expect((await tick(1, 'site')).status).toBe(200);
    expect((await read()).revision).toBe(1);
  });

  it('refuse a tick made before the plan was regenerated, and save none of it', async () => {
    const { authed, path, tick, read } = await setup();
    const regenerated = await authed(`${path}/regenerate`, { method: 'POST', body: {} });
    expect(((await regenerated.json()) as Json).revision).toBe(2);
    // A tick queued on a phone against revision 1, retried after the regeneration.
    expect(await tick(1, 'frames')).toEqual({
      status: 409,
      body: { error: 'stale-project', revision: 2 },
    });
    expect((await read()).ticks).toEqual([]);
    expect((await tick(2, 'frames')).status).toBe(200);
  });

  it('refuse a tick made before a save that changed the plan', async () => {
    const { put, tick } = await setup();
    await put({ params: { ...swingSetParams, crossbarHeight: 44 }, revision: 1 });
    expect((await tick(1, 'frames')).status).toBe(409);
  });
});

import { swingSetAFrame } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { swingSetParams } from '../../test/fixtures.ts';

// Saves and regenerations generate before they lock the project's row, so a slow generation
// holds no lock, and check the revision again under the lock (#421).

// biome-ignore lint/suspicious/noExplicitAny: test reads deep into JSON responses.
type Json = any;

/**
 * The swing set, except that while `during.action` is set, generating runs it first: another
 * device's write landing while this request generates.
 */
async function setup() {
  const during: { action?: () => void } = {};
  const swingSet = swingSetAFrame.definition;
  const template = {
    ...swingSet,
    generate: (...args: Parameters<typeof swingSet.generate>) => {
      const action = during.action;
      during.action = undefined;
      action?.();
      return swingSet.generate(...args);
    },
  };
  const test = await createTestApp({ templates: [template] });
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
  const send = async (url: string, method: string, body: unknown) => {
    const r = await test.authed(url, { method, body });
    return { status: r.status, body: (await r.json()) as Json };
  };
  /** Another device's save, queued on the database while this request is generating. */
  const otherSave = () => {
    void test.client.query(
      "update projects set revision = revision + 1, name = 'Saved elsewhere' where id = $1",
      [created.id],
    );
  };
  const read = async () => (await (await test.authed(path)).json()) as Json;
  return { during, path, send, otherSave, read, close: test.close };
}

describe('generating before the row lock', () => {
  it('refuses a save when the revision moved while it generated, and saves none of it', async () => {
    const { during, path, send, otherSave, read, close } = await setup();
    during.action = otherSave;
    const save = await send(path, 'PUT', {
      params: { ...swingSetParams, crossbarHeight: 44 },
      revision: 1,
    });
    expect(save).toEqual({ status: 409, body: { error: 'stale-project', revision: 2 } });
    const stored = await read();
    expect(stored.name).toBe('Saved elsewhere');
    expect(stored.snapshot.params.crossbarHeight).toBe(swingSetParams.crossbarHeight);
    await close();
  });

  it('refuses a regeneration when the revision moved while it generated', async () => {
    const { during, path, send, otherSave, read, close } = await setup();
    const before = await read();
    during.action = otherSave;
    expect(await send(`${path}/regenerate`, 'POST', { revision: 1 })).toEqual({
      status: 409,
      body: { error: 'stale-project', revision: 2 },
    });
    expect((await read()).snapshot).toEqual(before.snapshot);
    await close();
  });

  it('saves when nothing moved', async () => {
    const { path, send, close } = await setup();
    const save = await send(path, 'PUT', {
      params: { ...swingSetParams, crossbarHeight: 44 },
      revision: 1,
    });
    expect(save.status).toBe(200);
    expect(save.body.revision).toBe(2);
    expect(save.body.snapshot.params.crossbarHeight).toBe(44);
    await close();
  });

  it('answers a throw from the template as issues on the values, not a server error', async () => {
    const { during, path, send, read, close } = await setup();
    during.action = () => {
      throw new RangeError('Length must not be negative, got -1');
    };
    const save = await send(path, 'PUT', {
      params: { ...swingSetParams, crossbarHeight: 44 },
      revision: 1,
    });
    expect(save.status).toBe(422);
    expect(save.body.error).toBe('invalid-project');
    expect(save.body.issues.map((i: Json) => i.code)).toEqual(['generation-error']);
    expect((await read()).revision).toBe(1);
    await close();
  });
});

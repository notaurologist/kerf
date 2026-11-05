import { findTemplate, flagProgressKey, PROGRESS_KINDS, progressOutlineKey } from '@kerf/core';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { freshBasis, swingSetInputs, swingSetParams } from '../../test/fixtures.ts';
import { PROGRESS_KINDS as STORED_KINDS } from '../db/schema.ts';

// Saved progress (#57) on the swing-set worked example. Keys are core's (progress/): the worked
// example's boards are 4x6/12/1, 4x4/12/1 to /4, 2x6/10/1, and 2x8/8/1; its steps board-1 to
// board-7, ease-edges, treat-cuts, site, frames, and beam.

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
      structuralInputs: swingSetInputs,
    },
  });
  const { id } = (await res.json()) as { id: string };
  const revision = async () =>
    ((await (await test.authed(`/api/projects/${id}`)).json()) as Json).revision as number;
  const tick = async (changes: { kind: string; key: string; done: boolean }[]) => {
    const res = await test.authed(`/api/projects/${id}/progress`, {
      method: 'PATCH',
      body: { revision: await revision(), changes },
    });
    return { status: res.status, body: (await res.json()) as Json };
  };
  const progress = async () => {
    const res = await test.authed(`/api/projects/${id}/progress`);
    return ((await res.json()) as Json).ticks as { kind: string; key: string }[];
  };
  /** A save made against the project's current revision. */
  const save = async (body: Record<string, unknown>) =>
    test.authed(`/api/projects/${id}`, {
      method: 'PUT',
      body: { ...body, revision: await revision() },
    });
  /** The expert checks in the stored plan, as core reads them. */
  const flags = async () => {
    const project = (await (await test.authed(`/api/projects/${id}`)).json()) as Json;
    const template = findTemplate('swing-set-a-frame');
    if (!template) throw new Error('no swing-set template');
    return template.plan(template.storedOutputs.parse(project.snapshot.outputs)).flags;
  };
  return { ...test, id, tick, progress, save, revision, flags };
}

const done = (kind: string, key: string) => ({ kind, key, done: true });
const keys = (rows: { kind: string; key: string }[]) => rows.map((r) => `${r.kind} ${r.key}`);

describe('project progress', () => {
  it('stores the same kinds core keys progress by', () => {
    expect(STORED_KINDS).toEqual(PROGRESS_KINDS);
  });

  it('needs a session to read or write', async () => {
    const { app, id } = await setup();
    const path = `/api/projects/${id}/progress`;
    const headers = { 'content-type': 'application/json' };
    expect((await app.request(path)).status).toBe(401);
    const body = JSON.stringify({ changes: [done('step', 'site')] });
    expect((await app.request(path, { method: 'PATCH', headers, body })).status).toBe(401);
  });

  it('starts empty, and saves ticks with the time the server saved them', async () => {
    const { tick, progress, clock } = await setup();
    expect(await progress()).toEqual([]);
    const { status, body } = await tick([
      done('shopping-line', 'lumber/2x6/10'),
      done('board', '2x6/10/1'),
      done('part', 'crossbar/1'),
      done('step', 'board-6'),
    ]);
    expect(status).toBe(200);
    expect(body.ticks).toHaveLength(4);
    expect(body.ticks[0]).toEqual({
      kind: 'board',
      key: '2x6/10/1',
      doneAt: clock.now.toISOString(),
    });
    expect(keys(await progress())).toEqual(keys(body.ticks));
  });

  it('keeps the first time when a tick is sent again, so a retry changes nothing', async () => {
    const { tick, clock } = await setup();
    const first = clock.now.toISOString();
    await tick([done('step', 'site')]);
    clock.now = new Date(clock.now.getTime() + 60_000);
    const { body } = await tick([done('step', 'site')]);
    expect(body.ticks).toEqual([{ kind: 'step', key: 'site', doneAt: first }]);
  });

  it('clears ticks, and takes the last value for a key sent twice', async () => {
    const { tick } = await setup();
    await tick([done('step', 'site'), done('step', 'frames')]);
    const { body } = await tick([
      { kind: 'step', key: 'site', done: false },
      done('step', 'beam'),
      { kind: 'step', key: 'beam', done: false },
      // Clearing a tick that is not there, or an item the plan lacks, is allowed: no tick either way.
      { kind: 'board', key: 'no-such-board', done: false },
    ]);
    expect(keys(body.ticks)).toEqual(['step frames']);
  });

  it('refuses a tick on an item the plan does not have, and saves none of the request', async () => {
    const { tick, progress } = await setup();
    const { status, body } = await tick([
      done('step', 'site'),
      done('board', '2x6/10/2'),
      done('part', 'crossbar/2'),
    ]);
    expect(status).toBe(422);
    expect(body).toEqual({
      error: 'unknown-progress',
      items: [
        { kind: 'board', key: '2x6/10/2' },
        { kind: 'part', key: 'crossbar/2' },
      ],
    });
    expect(await progress()).toEqual([]);
  });

  it('rejects a malformed request and an unknown project', async () => {
    const { tick, authed } = await setup();
    expect((await tick([])).status).toBe(400);
    expect((await tick([{ kind: 'nail', key: 'x', done: true }])).status).toBe(400);
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await authed(`/api/projects/${missing}/progress`)).status).toBe(404);
    const res = await authed(`/api/projects/${missing}/progress`, {
      method: 'PATCH',
      body: { revision: 1, changes: [done('step', 'site')] },
    });
    expect(res.status).toBe(404);
  });

  it('clears the ticks a regeneration changes, keeps the rest, and says which', async () => {
    // Core's worked example (swing-set-a-frame/progress.test.ts): raising the crossbar from 40 to
    // 44 shortens the crossbars and moves the legs' crossbar holes. The 2x6 line, the beam's board
    // and step, and the site work keep the same numbers.
    const { tick, progress, save } = await setup();
    await tick([
      done('shopping-line', 'lumber/2x6/10'),
      done('board', '4x6/12/1'),
      done('board', '2x6/10/1'),
      done('part', 'crossbar/0'),
      done('part', 'leg-back/0'),
      done('step', 'board-1'),
      done('step', 'site'),
      done('step', 'frames'),
    ]);
    const res = await save({ params: { ...swingSetParams, crossbarHeight: 44 } });
    expect(res.status).toBe(200);
    const project = (await res.json()) as Json;
    expect(project.progressReset).toEqual([
      { kind: 'board', key: '2x6/10/1', reason: 'changed' },
      { kind: 'part', key: 'crossbar/0', reason: 'changed' },
      { kind: 'part', key: 'leg-back/0', reason: 'changed' },
      { kind: 'step', key: 'frames', reason: 'changed' },
    ]);
    expect(keys(await progress()).sort()).toEqual([
      'board 4x6/12/1',
      'shopping-line lumber/2x6/10',
      'step board-1',
      'step site',
    ]);
  });

  it('reports removed items when a stock change drops a line', async () => {
    const { tick, save } = await setup();
    await tick([done('shopping-line', 'lumber/2x6/10'), done('step', 'board-7')]);
    const res = await save({ params: { ...swingSetParams, crossbarStock: '2x8' } });
    expect(((await res.json()) as Json).progressReset).toEqual([
      { kind: 'shopping-line', key: 'lumber/2x6/10', reason: 'removed' },
      { kind: 'step', key: 'board-7', reason: 'removed' },
    ]);
  });

  it('keeps every tick through a rename and a regenerate that changes nothing', async () => {
    const { tick, progress, authed, id, save, revision } = await setup();
    await tick([done('step', 'frames')]);
    const renamed = await save({ name: 'Swing set' });
    expect((await renamed.json()) as Json).not.toHaveProperty('progressReset');
    const regenerated = await authed(`/api/projects/${id}/regenerate`, {
      method: 'POST',
      body: { revision: await revision(), ...freshBasis },
    });
    expect(((await regenerated.json()) as Json).progressReset).toEqual([]);
    expect(keys(await progress())).toEqual(['step frames']);
  });

  it('keeps the stored outline current through a rename, under the key it was made with', async () => {
    const { client, authed, save } = await setup();
    const template = findTemplate('swing-set-a-frame');
    if (!template) throw new Error('no swing-set template');
    const stored = async () =>
      (
        await client.query<{ revision: number; outline: number; version: string }>(
          `select revision, progress_outline_revision as outline,
                  progress_outline_version as version from projects`,
        )
      ).rows[0];
    expect((await save({ name: 'Swing set' })).status).toBe(200);
    expect(await stored()).toEqual({
      revision: 2,
      outline: 2,
      version: progressOutlineKey(template),
    });
    // An outline made by other code, as the previous deploy leaves one, is still read again.
    await client.query("update projects set progress_outline_version = 'other'");
    expect((await save({ name: 'Backyard swing set' })).status).toBe(200);
    expect(await stored()).toEqual({ revision: 3, outline: 3, version: 'other' });
    expect((await authed('/api/projects')).status).toBe(200);
    expect(await stored()).toEqual({
      revision: 3,
      outline: 3,
      version: progressOutlineKey(template),
    });
  });

  it('saves a tick on a plan whose progress cannot be counted, and moves no status', async () => {
    const before = await setup();
    const template = findTemplate('swing-set-a-frame');
    if (!template) throw new Error('no swing-set template');
    const throwing = {
      ...template,
      plan: () => {
        throw new Error('a plan this code cannot count');
      },
    };
    const { authed } = await createTestApp({ database: before, templates: [throwing] });
    const project = (await (await authed(`/api/projects/${before.id}`)).json()) as Json;
    expect(project.progress).toBeNull();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await authed(`/api/projects/${before.id}/progress`, {
      method: 'PATCH',
      body: { revision: project.revision, changes: [done('shopping-line', 'lumber/2x6/10')] },
    });
    expect(logged).toHaveBeenCalledWith(
      `project ${before.id}: progress could not be counted`,
      expect.any(Error),
    );
    logged.mockRestore();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ticks: [expect.objectContaining({ kind: 'shopping-line', key: 'lumber/2x6/10' })],
      status: 'planned',
    });
  });

  it('keeps a project’s progress in the trash, and deletes it with the project for good', async () => {
    const { tick, authed, client, id } = await setup();
    await tick([done('step', 'frames')]);
    const count = async () =>
      (await client.query<{ n: number }>('select count(*)::int as n from project_progress')).rows[0]
        ?.n;
    expect((await authed(`/api/projects/${id}`, { method: 'DELETE' })).status).toBe(204);
    expect(await count()).toBe(1);
    expect((await authed(`/api/trash/${id}`, { method: 'DELETE' })).status).toBe(204);
    expect(await count()).toBe(0);
  });

  it('moves a planned project to In progress at its first tick, and to Built at its last step', async () => {
    const { tick, authed, id } = await setup();
    const status = async () =>
      ((await (await authed(`/api/projects/${id}`)).json()) as Json).status;
    expect(await status()).toBe('planned');

    // Clearing a tick starts nothing.
    expect((await tick([{ kind: 'step', key: 'site', done: false }])).body.status).toBe('planned');
    expect((await tick([done('shopping-line', 'lumber/2x6/10')])).body.status).toBe('in-progress');

    const steps = [1, 2, 3, 4, 5, 6, 7].map((n) => `board-${n}`);
    steps.push('ease-edges', 'treat-cuts', 'site', 'frames', 'hanger-holes', 'raise', 'beam');
    steps.push('set', 'tighten');
    expect((await tick(steps.map((key) => done('step', key)))).body.status).toBe('in-progress');
    expect((await tick([done('step', 'hang')])).body.status).toBe('built');
    expect(await status()).toBe('built');

    // Set by hand, it stays: clearing and ticking again a step already done does not move it.
    await authed(`/api/projects/${id}`, { method: 'PUT', body: { status: 'in-progress' } });
    expect((await tick([done('step', 'hang')])).body.status).toBe('in-progress');
    await tick([{ kind: 'step', key: 'hang', done: false }]);
    expect((await tick([done('step', 'hang')])).body.status).toBe('built');
  });

  it('saves and clears ticks on expert checks and checklist items, which move no status', async () => {
    const { tick, progress, flags } = await setup();
    const [flag] = await flags();
    if (!flag) throw new Error('the worked example has no expert checks');
    const asked = flagProgressKey(flag);
    const { status, body } = await tick([
      done('flag', asked),
      done('checklist-item', 'racking/A-frames and crossbars'),
    ]);
    expect(status).toBe(200);
    expect(keys(body.ticks).sort()).toEqual([
      'checklist-item racking/A-frames and crossbars',
      `flag ${asked}`,
    ]);
    // Asking and confirming is not work on the project: it stays Planned.
    expect(body.status).toBe('planned');
    await tick([{ kind: 'flag', key: asked, done: false }]);
    expect(keys(await progress())).toEqual(['checklist-item racking/A-frames and crossbars']);
    // An item the review does not have is refused, as for any kind.
    expect((await tick([done('checklist-item', 'racking/Swing seats')])).status).toBe(422);
  });

  it('clears a tick on an expert check whose numbers a regeneration changes', async () => {
    // Core's worked example: the flag on the projecting ends names the crossbar ends' heights, so
    // raising the crossbar makes it another question. The checklist items do not change.
    const { tick, progress, save, flags } = await setup();
    const ends = (await flags()).find((f) => f.ask.startsWith("For the bolts' end distance"));
    if (!ends) throw new Error('the worked example has no flag on the projecting ends');
    await tick([
      done('flag', flagProgressKey(ends)),
      done('checklist-item', 'racking/A-frames and crossbars'),
    ]);
    const res = await save({ params: { ...swingSetParams, crossbarHeight: 44 } });
    expect(((await res.json()) as Json).progressReset).toEqual([
      { kind: 'flag', key: flagProgressKey(ends), reason: 'removed' },
    ]);
    expect(keys(await progress())).toEqual(['checklist-item racking/A-frames and crossbars']);
  });

  it('lists each project with its progress summary and no snapshot', async () => {
    const { tick, authed } = await setup();
    await tick([
      done('shopping-line', 'lumber/2x6/10'),
      done('shopping-line', 'hardware/Swing hangers'),
      done('step', 'board-1'),
      done('step', 'board-2'),
      done('part', 'leg-front/0'),
    ]);
    const list = (await (await authed('/api/projects')).json()) as Json;
    const [project] = list.projects;
    expect(project).not.toHaveProperty('snapshot');
    // The worked example: 4 lumber and 8 hardware lines; 9 pieces (a beam and two each of back
    // legs, front legs, crossbars, and gussets); 7 board steps and 10 more.
    expect(project.progress).toEqual({
      shopping: { done: 2, total: 13 },
      pieces: { done: 1, total: 9 },
      steps: { done: 2, total: 17 },
      nextStep: {
        id: 'board-3',
        number: 3,
        title: "Cut board 3, a 4x4 12' long: Front leg (downhill)",
      },
      // Ticks saved together: board 2 marked done is the furthest along, so the step after it.
      resumeStep: {
        id: 'board-3',
        number: 3,
        title: "Cut board 3, a 4x4 12' long: Front leg (downhill)",
      },
    });
  });

  it('resumes the list at the step with the most recent tick, by the time it was saved (#460)', async () => {
    // Legs cut before the beam: board 4's piece ticked a minute after board 2's.
    const { tick, authed, clock } = await setup();
    await tick([done('part', 'leg-front/0')]);
    clock.now = new Date(clock.now.getTime() + 60_000);
    await tick([done('part', 'leg-back/0')]);
    clock.now = new Date(clock.now.getTime() + 60_000);
    // A tick outside Building leaves where the owner was in Building alone.
    await tick([done('shopping-line', 'lumber/2x6/10')]);
    const list = (await (await authed('/api/projects')).json()) as Json;
    const { progress } = list.projects[0];
    expect(progress.resumeStep).toEqual({
      id: 'board-4',
      number: 4,
      title: "Cut board 4, a 4x4 12' long: Back leg (uphill)",
    });
    expect(progress.nextStep.id).toBe('board-1');
  });

  it('carries the ticks and summary in the project response', async () => {
    const { tick, authed, id } = await setup();
    await tick([done('step', 'board-1')]);
    const project = (await (await authed(`/api/projects/${id}`)).json()) as Json;
    expect(project.ticks.map((t: Json) => t.key)).toEqual(['board-1']);
    expect(project.progress.steps).toEqual({ done: 1, total: 17 });
  });
});

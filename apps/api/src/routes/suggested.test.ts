import {
  buildFromForm,
  suggestedValues,
  swingSetAFrame,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app.ts';
import { swingSetInputs } from '../../test/fixtures.ts';

// Suggested values (#417): the server records which values are Kerf's suggestions from the
// starting answers, keeps each unconfirmed until it is ticked in the structural review or changed,
// and refuses a tick made on an older revision (0018).

// biome-ignore lint/suspicious/noExplicitAny: test reads deep into JSON responses.
type Json = any;

const template = swingSetAFrame.definition as TemplateDefinition;
const answers = {
  riders: 'kids',
  riderWeights: [90, 110],
  area: { length: 360, depth: 480 },
  ground: { kind: 'level' },
  feet: 'pads',
};
const questions = template.questions;
if (!questions) throw new Error('the swing set asks questions');
const form = suggestedValues(template.form, questions.suggest(answers));
const params = buildFromForm(template.form.params, form.params);
// The inputs Kerf does not suggest are entered, so the checks compute.
const inputs = { ...swingSetInputs, ...buildFromForm(template.form.structuralInputs, form.inputs) };

const SUGGESTED_INPUTS = ['maxSwingAngle', 'deflectionLimit', 'beamMoistureContent'];
const SUGGESTED_PARAMS = [
  'hardware.legBoltDiameter',
  'hardware.crossbarBolts.diameter',
  'hardware.crossbarBolts.perJoint',
  'hardware.gussetBolts.diameter',
  'hardware.gussetBolts.perJoint',
];
const paths = (suggested: Json[]) => suggested.map((s) => `${s.from} ${s.path}`).sort();
const all = [
  ...SUGGESTED_INPUTS.map((p) => `structuralInputs ${p}`),
  ...SUGGESTED_PARAMS.map((p) => `params ${p}`),
].sort();

async function setup(body: Record<string, unknown> = {}) {
  const test = await createTestApp();
  const res = await test.authed('/api/projects', {
    method: 'POST',
    body: {
      name: 'From answers',
      templateId: template.id,
      params,
      structuralInputs: inputs,
      answers,
      ...body,
    },
  });
  const created = (await res.json()) as Json;
  const path = `/api/projects/${created.id}`;
  const confirm = async (revision: number, changes: unknown[]) => {
    const r = await test.authed(`${path}/suggested`, {
      method: 'PATCH',
      body: { revision, changes },
    });
    return { status: r.status, body: (await r.json()) as Json };
  };
  const put = async (body: unknown) => {
    const r = await test.authed(path, { method: 'PUT', body });
    return { status: r.status, body: (await r.json()) as Json };
  };
  const read = async () => (await (await test.authed(path)).json()) as Json;
  return { ...test, status: res.status, created, path, confirm, put, read };
}

const limit = { from: 'structuralInputs', path: 'deflectionLimit' };

describe('POST /api/projects with starting answers', () => {
  it('stores each suggested input and bolt size as unconfirmed, with its basis', async () => {
    const { status, created } = await setup();
    expect(status).toBe(201);
    expect(paths(created.snapshot.suggested)).toEqual(all);
    expect(created.snapshot.suggested.every((s: Json) => s.confirmed === false)).toBe(true);
    const stored = created.snapshot.suggested.find((s: Json) => s.path === 'deflectionLimit');
    expect(stored.basis.citation).toMatch(/^International Building Code \(2021\), Table 1604\.3/);
    // Where a value came from changes no number: the worked example's margin, entered.
    expect(created.snapshot.outputs.structuralReview.beam.deflection.status).toBe('computed');
  });

  it('records a value changed before Create as entered', async () => {
    const { created } = await setup({ structuralInputs: { ...inputs, deflectionLimit: 360 } });
    expect(paths(created.snapshot.suggested)).not.toContain('structuralInputs deflectionLimit');
    expect(paths(created.snapshot.suggested)).toContain('structuralInputs maxSwingAngle');
  });

  it('records nothing as suggested without answers, as before', async () => {
    const { created } = await setup({ answers: undefined });
    expect(created.snapshot.suggested).toEqual([]);
  });

  it('answers 422 for answers the questions do not take, storing nothing', async () => {
    const { status, authed } = await setup({ answers: { riders: 'nobody' } });
    expect(status).toBe(422);
    const list = (await (await authed('/api/projects')).json()) as Json;
    expect(list.projects).toEqual([]);
  });

  it('previews a new project with its suggestions', async () => {
    const { authed } = await setup();
    const res = await authed('/api/projects/preview', {
      method: 'POST',
      body: { templateId: template.id, params, structuralInputs: inputs, answers },
    });
    expect(res.status).toBe(200);
    expect(paths(((await res.json()) as Json).snapshot.suggested)).toEqual(all);
  });
});

describe('PATCH /api/projects/:id/suggested', () => {
  it('confirms a suggestion, leaving the revision and status as they were', async () => {
    const { created, confirm, read } = await setup();
    const res = await confirm(created.revision, [{ ...limit, confirmed: true }]);
    expect(res.status).toBe(200);
    const confirmed = res.body.suggested.filter((s: Json) => s.confirmed).map((s: Json) => s.path);
    expect(confirmed).toEqual(['deflectionLimit']);
    const project = await read();
    expect(project.revision).toBe(created.revision);
    expect(project.status).toBe('planned');
    expect(project.snapshot.suggested).toEqual(res.body.suggested);
    // Unticking makes it a suggestion again.
    const undone = await confirm(created.revision, [{ ...limit, confirmed: false }]);
    expect(undone.body.suggested.every((s: Json) => !s.confirmed)).toBe(true);
  });

  it('refuses a tick made on an older revision, and one for a value that is not a suggestion', async () => {
    const { created, confirm, put, read } = await setup();
    const saved = await put({ name: 'Renamed', revision: created.revision });
    expect(saved.body.revision).toBe(created.revision + 1);
    expect(await confirm(created.revision, [{ ...limit, confirmed: true }])).toEqual({
      status: 409,
      body: { error: 'stale-project', revision: created.revision + 1 },
    });
    const other = { from: 'structuralInputs', path: 'dynamicFactor', confirmed: true };
    expect(await confirm(created.revision + 1, [other])).toEqual({
      status: 422,
      body: {
        error: 'unknown-suggestion',
        fields: [{ from: 'structuralInputs', path: 'dynamicFactor' }],
      },
    });
    expect((await read()).snapshot.suggested.every((s: Json) => !s.confirmed)).toBe(true);
  });

  it('answers 404 for a missing project, and requires a session', async () => {
    const { authed, app } = await setup();
    const missing = '/api/projects/00000000-0000-4000-8000-000000000000/suggested';
    const body = { revision: 1, changes: [{ ...limit, confirmed: true }] };
    expect((await authed(missing, { method: 'PATCH', body })).status).toBe(404);
    const res = await app.request(missing, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(401);
  });
});

describe('saving a project with suggestions', () => {
  it('keeps the suggestions a save leaves alone, and makes a changed value entered', async () => {
    const { created, put } = await setup();
    const saved = await put({
      structuralInputs: { ...inputs, deflectionLimit: 360 },
      revision: created.revision,
    });
    expect(saved.status).toBe(200);
    expect(paths(saved.body.snapshot.suggested)).toEqual(
      all.filter((p) => p !== 'structuralInputs deflectionLimit'),
    );
  });

  it('keeps a confirmation made on another device after the form opened', async () => {
    const { created, confirm, put } = await setup();
    // The phone ticks the limit; the laptop's form, opened at the same revision, saves a rider.
    await confirm(created.revision, [{ ...limit, confirmed: true }]);
    const saved = await put({
      structuralInputs: { ...inputs, riderWeights: [90, 120] },
      revision: created.revision,
    });
    expect(saved.status).toBe(200);
    const stored = saved.body.snapshot.suggested.find((s: Json) => s.path === 'deflectionLimit');
    expect(stored.confirmed).toBe(true);
  });

  it('keeps them through a regeneration', async () => {
    const { created, authed, read } = await setup();
    const res = await authed(`/api/projects/${created.id}/regenerate`, {
      method: 'POST',
      body: { revision: created.revision },
    });
    expect(res.status).toBe(200);
    expect(paths((await read()).snapshot.suggested)).toEqual(all);
  });
});

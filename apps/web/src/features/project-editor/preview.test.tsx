import {
  createSnapshot,
  findTemplate,
  formValues,
  type Plan,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { indexChanges } from '../../lib/changes.tsx';
import { planOf } from '../../lib/plan.ts';
import { projectFrom } from '../../test/projects.ts';
import { render, renderText } from '../../test/render.tsx';
import { PreviewPane, previewRequest, previewState } from './Preview.tsx';

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const example = template.examples[0];
if (!example) throw new Error('needs a worked example');
const params = example.params as Record<string, unknown>;

function snapshotOf(params: unknown) {
  const result = createSnapshot(template, params, example?.structuralInputs);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return JSON.parse(JSON.stringify(result.output));
}

const project = projectFrom(snapshotOf(example.params));
const savedForm = {
  params: formValues(template.form.params, example.params),
  inputs: formValues(template.form.structuralInputs, example.structuralInputs),
};

function planFrom(snapshot: { outputs: unknown }): Plan {
  const plan = planOf(template.id, snapshot.outputs);
  if (!plan.ok) throw new Error(plan.message);
  return plan.plan;
}

describe('previewRequest', () => {
  it('asks for nothing while the form matches the saved plan', () => {
    expect(previewRequest(template, project, savedForm.params, savedForm.inputs)).toEqual({
      kind: 'saved',
    });
  });

  it('waits while an entry cannot be read, or the schema rejects it', () => {
    const unread = { ...savedForm.params, beamLength: 'about ten' };
    expect(previewRequest(template, project, unread, savedForm.inputs).kind).toBe('incomplete');
    const empty = { ...savedForm.params, beamLength: '' };
    expect(previewRequest(template, project, empty, savedForm.inputs).kind).toBe('incomplete');
  });

  it('sends what a save would send, once a value changes', () => {
    const request = previewRequest(
      template,
      project,
      { ...savedForm.params, beamLength: "11'" },
      savedForm.inputs,
    );
    expect(request.kind).toBe('ask');
    if (request.kind !== 'ask') return;
    expect(request.body.params).toEqual({ ...params, beamLength: 132 });
    expect(request.body.structuralInputs).toEqual(example.structuralInputs);
  });
});

describe('previewState', () => {
  it("shows core's issues when the server rejects the values", () => {
    const state = previewState(template.id, {
      ok: false,
      error: { kind: 'invalid', issues: [{ field: 'beamLength', message: 'Too short.' }] },
    });
    expect(state).toEqual({ kind: 'rejected', messages: ['Too short.'] });
  });

  it('reads a preview as a plan with its changes', () => {
    const state = previewState(template.id, {
      ok: true,
      value: {
        snapshot: snapshotOf({ ...params, beamLength: 132 }),
        changes: [{ path: 'cutList[0].length', before: '120"', after: '132"' }],
        truncated: false,
      },
    });
    expect(state.kind).toBe('ready');
    if (state.kind !== 'ready') return;
    expect(state.plan.cutList[0]?.length).toBe('132"');
    expect(state.changes.at('cutList[0].length')?.before).toBe('120"');
  });
});

describe('the preview pane', () => {
  const saved = planFrom(project.snapshot as { outputs: unknown });

  it('shows the saved plan, unlabeled as a preview, until a value changes', () => {
    const text = renderText(<PreviewPane saved={saved} state={{ kind: 'saved' }} />);
    expect(text).toContain('Saved plan');
    expect(text).not.toContain('Preview, not saved');
    expect(text).toContain('131-1/2"');
  });

  it('labels a preview and marks each changed value with the saved one', () => {
    const preview = planFrom(snapshotOf({ ...params, beamLength: 132 }));
    const state = {
      kind: 'ready' as const,
      plan: preview,
      changes: indexChanges([
        { path: 'cutList[0].length', before: '120"', after: '132"' },
        { path: 'checks[0].margin', before: 1.0796947718059655, after: preview.checks[0] },
      ]),
      truncated: false,
    };
    const html = render(<PreviewPane saved={saved} state={state} />);
    const text = renderText(<PreviewPane saved={saved} state={state} />);
    expect(text).toContain('Preview, not saved');
    expect(text).toContain('132" was 120"');
    expect(text).toContain('was margin 1.1x');
    // Only the beam's row is marked; the legs are unchanged.
    expect(html.match(/<tr data-changed="">/g)).toHaveLength(1);
  });

  it('keeps the saved plan in view and says why when the server rejects the values', () => {
    const text = renderText(
      <PreviewPane saved={saved} state={{ kind: 'rejected', messages: ['Too short.'] }} />,
    );
    expect(text).toContain('No preview for these values. Too short.');
    expect(text).toContain('Saved plan');
  });
});

describe("a new project's preview pane", () => {
  it('shows no plan and says what it waits for until every entry can be read', () => {
    const text = renderText(<PreviewPane saved={null} state={{ kind: 'incomplete' }} />);
    expect(text).toContain('Preview');
    expect(text).not.toContain('Saved plan');
    expect(text).not.toContain('Cut list');
    expect(text).toContain('show here when every dimension and hardware entry can be read');
  });

  it('shows the previewed plan, labeled, with nothing marked as changed', () => {
    const plan = planFrom(project.snapshot as { outputs: unknown });
    const state = { kind: 'ready' as const, plan, changes: indexChanges([]), truncated: false };
    const html = render(<PreviewPane saved={null} state={state} />);
    const text = renderText(<PreviewPane saved={null} state={state} />);
    expect(text).toContain('Preview, not saved');
    expect(text).toContain('Nothing is saved until you create the project.');
    expect(text).toContain('131-1/2"');
    expect(html).not.toContain('data-changed');
  });
});

describe('previewRequest for a new project', () => {
  it('asks for the values as soon as they can be read, with nothing to compare against', () => {
    expect(previewRequest(template, null, savedForm.params, savedForm.inputs)).toEqual({
      kind: 'ask',
      body: {
        params: project.snapshot?.params,
        structuralInputs: project.snapshot?.structuralInputs,
      },
    });
  });
});

import {
  buildFromForm,
  confirmedPaths,
  findTemplate,
  formValues,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../lib/types.ts';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, renderText } from '../../test/render.tsx';
import { placeIssues, schemaIssues } from './issues.ts';
import { changesFor, ProjectEditor, startValues } from './ProjectEditor.tsx';

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const { params: sections } = template.form;

describe('a new project form', () => {
  const html = render(
    <ProjectEditor
      template={template}
      initial={{
        name: '',
        params: formValues(template.form.params, {}),
        inputs: formValues(template.form.structuralInputs, {}),
      }}
    />,
  );

  it('has no value filled in for the owner', () => {
    expect(html).not.toMatch(/<input[^>]* value="[^"]+"/);
    expect(html).not.toMatch(/<option value="[^"]+" selected=""/);
  });

  it('asks for the structural inputs, and says they may be left for later', () => {
    expect(html).toContain('Beam species and grade');
    expect(html).toContain('Swing hanger rated working load');
    expect(html).toContain('Input needed');
  });
});

describe('starting a new project (#98)', () => {
  const earlier = projectFrom(storedSnapshots[0] ?? null, { name: 'First swing set' });

  it('starts empty with no start chosen', () => {
    const start = startValues(template, undefined, null);
    if (!start.ok) throw new Error(start.message);
    expect(Object.values(start.initial.params).every((v) => v === '')).toBe(true);
    expect(Object.values(start.initial.inputs).every((v) => v === '')).toBe(true);
    expect(start.copied).toBeUndefined();
  });

  it('offers worked examples, filling in neither hardware nor structural inputs (rule 3)', () => {
    const confirm = confirmedPaths(sections);
    expect(confirm.has('hardware.legBoltDiameter')).toBe(true);
    const offered = template.examples.flatMap((e, index) => (e.start ? [index] : []));
    expect(offered.length).toBeGreaterThan(0);
    for (const index of offered) {
      const start = startValues(template, { kind: 'example', index }, null);
      if (!start.ok) throw new Error(start.message);
      const { params, inputs } = start.initial;
      expect(params['beamLength']).not.toBe('');
      for (const path of confirm) expect(params[path]).toBe('');
      // Only the hardware is missing: filled in, the example's parameters are what core reads.
      const example = template.examples[index];
      const filled = { ...formValues(sections, example?.params), ...params };
      for (const path of confirm) filled[path] = formValues(sections, example?.params)[path] ?? '';
      expect(template.params.safeParse(buildFromForm(sections, filled)).success).toBe(true);
      expect(Object.values(inputs).every((v) => v === '')).toBe(true);
      expect(start.copied).toBeUndefined();
    }
  });

  it('refuses an example that is not offered as a start', () => {
    const notOffered = template.examples.findIndex((e) => !e.start);
    expect(startValues(template, { kind: 'example', index: notOffered }, null).ok).toBe(false);
    expect(startValues(template, { kind: 'example', index: 99 }, null).ok).toBe(false);
  });

  it("copies an earlier project's values, its hardware and structural inputs to confirm", () => {
    const start = startValues(template, { kind: 'project', id: earlier.id }, earlier);
    if (!start.ok) throw new Error(start.message);
    expect(start.initial.name).toBe('');
    expect(start.initial.params['beamLength']).toBe('120');
    expect(start.initial.params['hardware.legBoltDiameter']).toBe('0.5');
    expect(start.initial.inputs['beamSpeciesGrade']).toBe('southern-pine-no2');
    expect(start.copied?.from).toBe('First swing set');
    expect(start.copied?.inputs).toEqual(start.initial.inputs);
    expect(Object.keys(start.copied?.params ?? {})).toEqual([...confirmedPaths(sections)]);
  });

  it('refuses a project of another template, or one whose plan cannot be read', () => {
    const other = { ...earlier, templateId: 'bookshelf' };
    expect(startValues(template, { kind: 'project', id: earlier.id }, other).ok).toBe(false);
    const unreadable = projectFrom(null, { name: 'Broken' });
    const start = startValues(template, { kind: 'project', id: unreadable.id }, unreadable);
    expect(start).toEqual({
      ok: false,
      message: "Broken's stored plan cannot be read, so it cannot be copied.",
    });
  });

  it('marks each copied hardware value and structural input to confirm, and asks for it', () => {
    const start = startValues(template, { kind: 'project', id: earlier.id }, earlier);
    if (!start.ok) throw new Error(start.message);
    const editor = (
      <ProjectEditor template={template} initial={start.initial} copied={start.copied} />
    );
    const text = renderText(editor);
    expect(text).toContain('The values marked "Copied, confirm" are from First swing set.');
    expect(text).toContain('The copied values are right for this project');
    const html = render(editor);
    expect(html).toMatch(/Leg-to-beam bolt diameter<\/span><span class="k-needed">Copied, confirm/);
    // Every shown hardware field and every entered structural input, and nothing else.
    const hardware = [...confirmedPaths(sections)].filter((p) => html.includes(`id="p-${p}"`));
    const inputs = Object.values(start.initial.inputs).filter((v) => v !== '').length;
    expect(html.match(/class="k-needed">Copied, confirm/g)).toHaveLength(hardware.length + inputs);
  });

  it('shows a preview beside a new form, waiting until the entries can be read', () => {
    const start = startValues(template, undefined, null);
    if (!start.ok) throw new Error(start.message);
    const text = renderText(<ProjectEditor template={template} initial={start.initial} />);
    expect(text).toContain('show here when every dimension and hardware entry can be read');
  });
});

describe('an existing project in the form', () => {
  it('shows its stored values', () => {
    const example = template.examples[0];
    if (!example) throw new Error('needs a worked example');
    const html = render(
      <ProjectEditor
        template={template}
        initial={{
          name: 'Backyard',
          params: formValues(template.form.params, example.params),
          inputs: formValues(template.form.structuralInputs, example.structuralInputs),
        }}
      />,
    );
    expect(html).toMatch(/id="p-beamLength"[^>]* value="120"/);
    // The beam length, read back through core's formatter.
    expect(html).toContain('10&#x27; 0&quot;');
    expect(html).toMatch(/<option value="southern-pine-no2" selected="">Southern Pine No.2</);
  });
});

describe('a project made with an older template version', () => {
  it('says, as information rather than a problem, that saving regenerates it', () => {
    const snapshot = storedSnapshots[0] ?? null;
    const version = {
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: { ok: true, changes: [], truncated: false },
    } as Project['version'];
    const project = projectFrom(snapshot, { version, templateBehind: true });
    const editor = (
      <ProjectEditor
        template={template}
        project={project}
        initial={{
          name: project.name,
          params: formValues(template.form.params, snapshot?.params),
          inputs: formValues(template.form.structuralInputs, snapshot?.structuralInputs),
        }}
      />
    );
    expect(render(editor)).toMatch(/<div class="k-info" role="status">/);
    expect(renderText(editor)).toContain(
      'Saving changed parameters or structural inputs regenerates this plan with template version 2. It was made with version 1.',
    );
  });
});

describe('typing a length', () => {
  const html = render(
    <ProjectEditor
      template={template}
      initial={{
        name: '',
        params: { ...formValues(template.form.params, {}), beamHeight: "8'", beamLength: '11 6' },
        inputs: formValues(template.form.structuralInputs, {}),
      }}
    />,
  );

  it("echoes core's reading under the field: feet and inches, then inches", () => {
    expect(html).toContain('8&#x27; 0&quot; · 96&quot;');
  });

  it('says plainly when the text is not a length yet, without marking it as an error', () => {
    expect(html).toContain('Not a length yet');
    expect(html).not.toMatch(/id="p-beamLength"[^>]*aria-invalid/);
  });

  it('gives lengths the full keyboard, with autocorrect off, and no inch unit', () => {
    expect(html).toMatch(
      /id="p-beamHeight"[^>]*inputMode="text" autoCapitalize="off" autoCorrect="off"/,
    );
    expect(html).toContain('Inches, or feet and inches.');
  });
});

describe('issues', () => {
  it("words the schema's problems by what was typed", () => {
    const values = { beamLength: '10', beamHeight: '', 'swings.seatWidth': 'wide' };
    const parsed = template.params.safeParse(buildFromForm(sections, values));
    if (parsed.success) throw new Error('should not parse');
    const byField = Object.fromEntries(
      schemaIssues(parsed.error, values, sections, template.params).map((i) => [
        i.field,
        i.message,
      ]),
    );
    // The schema allows a beam length of 48" to 240": 4' 0" to 20' 0".
    expect(byField.beamLength).toBe(`Beam length must be from 4' 0" to 20' 0".`);
    expect(byField.beamHeight).toBe('Enter a length.');
    expect(byField['swings.seatWidth']).toBe('Enter a length.');
  });

  it("places the API's top-level issues on the first visible field they name", () => {
    const values = { 'splay.kind': 'footprint' };
    const placed = placeIssues(sections, values, [
      { field: 'splay', message: 'Too steep' },
      { field: 'swings', message: 'Swings overlap' },
      { field: 'nothing', message: 'Something else' },
      { field: '', message: 'Whole plan' },
    ]);
    expect(placed.fields).toEqual({
      'splay.kind': 'Too steep',
      'swings.centers.0': 'Swings overlap',
    });
    expect(placed.general).toEqual(['Something else', 'Whole plan']);
  });

  it('places an issue under a hidden field on the visible field that controls it', () => {
    const placed = placeIssues(sections, { 'splay.kind': 'angle' }, [
      { field: 'splay.degrees', message: 'Must be at most 35.' },
    ]);
    expect(placed.fields).toEqual({ 'splay.degrees': 'Must be at most 35.' });
  });
});

describe('changesFor', () => {
  const example = template.examples[0];
  if (!example) throw new Error('needs a worked example');
  const project = {
    id: 'p',
    name: 'Backyard',
    snapshot: { params: example.params, structuralInputs: example.structuralInputs },
  } as unknown as Parameters<typeof changesFor>[0];
  const fromForm = (p: unknown, i: unknown) =>
    [
      buildFromForm(template.form.params, formValues(template.form.params, p)),
      buildFromForm(template.form.structuralInputs, formValues(template.form.structuralInputs, i)),
    ] as const;

  it('sends only the name for a rename, so the plan is not regenerated', () => {
    const [p, i] = fromForm(example.params, example.structuralInputs);
    expect(changesFor(project, 'Swing set', p, i)).toEqual({ name: 'Swing set' });
    expect(changesFor(project, 'Backyard', p, i)).toEqual({});
  });

  it('sends the parameters when one changes', () => {
    const [p, i] = fromForm(
      { ...(example.params as object), beamLength: 132 },
      example.structuralInputs,
    );
    expect(Object.keys(changesFor(project, 'Backyard', p, i))).toEqual(['params']);
  });
});

import { buildFromForm, findTemplate, formValues, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { render } from '../../test/render.tsx';
import { placeIssues, schemaIssues } from './issues.ts';
import { changesFor, lengthEcho, ProjectEditor } from './ProjectEditor.tsx';

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
    expect(html).toContain('input needed');
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

describe('lengthEcho', () => {
  it("reads a typed length back through core's formatter", () => {
    expect(lengthEcho('96')).toBe(`8' 0"`);
    expect(lengthEcho('100.1875')).toBe(`8' 4-3/16"`);
    expect(lengthEcho('')).toBeNull();
    expect(lengthEcho('-2')).toBeNull();
    expect(lengthEcho('abc')).toBeNull();
  });
});

describe('issues', () => {
  it("words the schema's problems by what was typed", () => {
    const values = { beamLength: '10', beamHeight: '', 'swings.seatWidth': 'wide' };
    const parsed = template.params.safeParse(buildFromForm(sections, values));
    if (parsed.success) throw new Error('should not parse');
    const byField = Object.fromEntries(
      schemaIssues(parsed.error, values).map((i) => [i.field, i.message]),
    );
    expect(byField.beamLength).toBe('Must be at least 48.');
    expect(byField.beamHeight).toBe('Enter a value.');
    expect(byField['swings.seatWidth']).toBe('Enter a number.');
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

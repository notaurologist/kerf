import {
  buildFromForm,
  confirmedPaths,
  createSnapshot,
  findTemplate,
  formValues,
  readSnapshot,
  TEMPLATES,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import cabinetV7 from '../../../../../packages/core/src/templates/record-cabinet/snapshots/v7.json';
import { fieldId } from '../../lib/fieldIds.ts';
import type { Project } from '../../lib/types.ts';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, renderText, textOf } from '../../test/render.tsx';
import { EditProject } from './EditProject.tsx';
import { placeIssues, schemaIssues } from './issues.ts';
import { ProjectEditor } from './ProjectEditor.tsx';
import { changesFor, editorValues } from './save.ts';
import { startValues } from './start.ts';

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

describe('the form’s layout (#164)', () => {
  const example = startValues(template, { kind: 'example', index: 0 }, null);
  if (!example.ok) throw new Error(example.message);
  const editor = <ProjectEditor template={template} initial={example.initial} />;
  const html = render(editor);
  const text = renderText(editor);

  it('shows the fields by part, with each part’s parameters and structural inputs together', () => {
    const legends = [...html.matchAll(/<legend>([^<]*)<\/legend>/g)].map((m) => m[1]);
    expect(legends).toEqual(['Beam', 'Legs', 'Crossbars', 'Gussets', 'Site', 'Swings', 'Loads']);
    const beam = html.slice(html.indexOf('<legend>Beam'), html.indexOf('<legend>Legs'));
    expect(beam).toContain('id="p-beamLength"');
    expect(beam).toContain('id="s-beamSpeciesGrade"');
  });

  it('marks empty hardware as input needed, as it does structural inputs (rule 3)', () => {
    expect(html).toMatch(
      /Leg-to-beam bolt diameter<\/span><span class="k-tag" data-tone="needed">/,
    );
    expect(html).not.toMatch(/Beam length<\/span><span class="k-tag" data-tone="needed">/);
  });

  it('says how much is entered and which parts have empty fields, linking to the first of each', () => {
    // The worked example's start: 32 fields shown, its 5 hardware fields and 9 structural
    // inputs left empty (spec, Parameters; rule 3).
    expect(text).toContain('18 of 32 entered');
    expect(text).toContain('Still empty: Beam, Legs, Crossbars, Gussets, Swings, and Loads.');
    expect(html).toContain('href="#s-beamSpeciesGrade"');
    expect(html).toContain('href="#p-hardware.legBoltDiameter"');
  });

  it('does not count an empty optional field, such as a fourth length sold, as still to enter', () => {
    const cabinet = findTemplate('record-cabinet') as TemplateDefinition;
    const start = startValues(cabinet, { kind: 'example', index: 0 }, null);
    if (!start.ok) throw new Error(start.message);
    const progress = (initial: typeof start.initial) => {
      const shown = renderText(<ProjectEditor template={cabinet} initial={initial} />);
      return shown.slice(
        shown.indexOf(' entered') - 10,
        shown.indexOf('Create project', shown.indexOf(' entered')),
      );
    };
    // The worked example sells three lengths, so the fourth box is empty.
    expect(start.initial.params['board.lengths.3']).toBe('');
    const three = progress(start.initial);
    expect(three).not.toContain('Lumber');
    const four = progress({
      ...start.initial,
      params: { ...start.initial.params, 'board.lengths.3': '10' },
    });
    const counts = (text: string) =>
      text
        .match(/(\d+) of (\d+) entered/)
        ?.slice(1)
        .map(Number);
    const [entered, total] = counts(three) ?? [];
    expect(counts(four)).toEqual([(entered ?? 0) + 1, (total ?? 0) + 1]);
  });

  it('offers Create in the header and beside the form', () => {
    expect(html.match(/<button type="submit"[^>]*>[\s\S]*?Create project/g)).toHaveLength(2);
    const header = html.slice(0, html.indexOf('</header>'));
    expect(header).toContain('Create project');
  });

  it('gives numbers and lengths a short input and choices a medium one', () => {
    expect(html).toMatch(
      /<div class="k-field"[^>]*data-width="short"[^>]*><label[^>]*for="p-beamLength"/,
    );
    expect(html).toMatch(
      /<div class="k-field"[^>]*data-width="medium"[^>]*><label[^>]*for="p-beamStock"/,
    );
  });
});

describe('starting a new project (#98)', () => {
  const earlier = projectFrom(storedSnapshots[0] ?? null, { name: 'First swing set' });

  it('starts empty from an empty form (#358)', () => {
    const start = startValues(template, { kind: 'empty' }, null);
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
      expect(params.beamLength).not.toBe('');
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
    expect(start.initial.params.beamLength).toBe('120');
    expect(start.initial.params['hardware.legBoltDiameter']).toBe('0.5');
    expect(start.initial.inputs.beamSpeciesGrade).toBe('southern-pine-no2');
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
    expect(html).toMatch(
      /Leg-to-beam bolt diameter<\/span><span class="k-tag" data-tone="needed">Copied, confirm/,
    );
    // Every shown hardware field and every entered structural input, and nothing else.
    const hardware = [...confirmedPaths(sections)].filter((p) => html.includes(`id="p-${p}"`));
    const inputs = Object.values(start.initial.inputs).filter((v) => v !== '').length;
    expect(html.match(/class="k-tag" data-tone="needed">Copied, confirm/g)).toHaveLength(
      hardware.length + inputs,
    );
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

describe('a structural input with a break-even value (#401)', () => {
  // A plan made now: the stored fixture predates the break-even factor.
  const [stored] = storedSnapshots;
  const made = createSnapshot(template, stored?.params, stored?.structuralInputs);
  if (!made.ok) throw new Error('worked example should generate');
  const complete = JSON.parse(JSON.stringify(made.output));
  const project = projectFrom(complete);
  const html = render(
    <ProjectEditor
      template={template}
      project={project}
      initial={{
        name: project.name,
        params: formValues(template.form.params, complete.params),
        inputs: formValues(template.form.structuralInputs, complete.structuralInputs),
      }}
    />,
  );

  // The worked example's break-even factors: 2.164, 7.195, and 8.0 (spec, Structural model).
  it('shows under the dynamic factor where each strength check reaches margin 1.0', () => {
    const id = fieldId('structuralInputs', 'dynamicFactor');
    expect(html).toMatch(new RegExp(`id="${id}"[^>]*aria-describedby="[^"]*${id}-compare`));
    const start = html.indexOf(`id="${id}-compare"`);
    const table = html.slice(start, html.indexOf('</table>', start));
    expect(textOf(table)).toContain(
      'With the other inputs as entered, each check has margin 1.0 or more while the dynamic factor is:',
    );
    // One check per row, the factor in its own column.
    const rows = [...table.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((m) => textOf(m[1] ?? ''));
    expect(rows).toEqual([
      'Check Dynamic factor',
      'Top beam, 4x6, bending 2.1 or less',
      'Top beam, 4x6, shear 7.1 or less',
      'Swing hanger, rated load 8.0 or less',
    ]);
  });

  it('shows it under no other field', () => {
    expect(html.match(/-compare"/g)).toHaveLength(2);
  });
});

describe('the Edit screen’s status (#355)', () => {
  const [complete] = storedSnapshots;
  if (!complete) throw new Error('fixture has the worked examples');

  it('offers the status, set to the project’s, with what it follows', () => {
    const html = render(
      <EditProject
        project={projectFrom(complete, { status: 'in-progress' })}
        onReload={() => {}}
      />,
    );
    expect(html).toContain(
      '<label class="k-field__label" for="project-status"><span>Status</span></label>',
    );
    expect(html).toContain('<option value="in-progress" selected="">In progress</option>');
    expect(html).not.toContain('Choose…</option><option value="planned"');
    expect(textOf(html)).toContain('Follows your progress');
  });
});

describe('deleting from the Edit screen', () => {
  const [complete] = storedSnapshots;
  if (!complete) throw new Error('fixture has the worked examples');

  it('puts Delete after the form, outside it, so Enter in its name field never saves', () => {
    const html = render(<EditProject project={projectFrom(complete)} onReload={() => {}} />);
    const formEnd = html.indexOf('</form>');
    expect(formEnd).toBeGreaterThan(html.indexOf('Save changes'));
    expect(html.indexOf('Delete this project')).toBeGreaterThan(formEnd);
  });

  it('still offers Delete when the plan cannot be edited', () => {
    const text = renderText(
      <EditProject
        project={projectFrom(null, {
          unreadable: { reason: 'malformed', message: 'The stored snapshot is not a snapshot.' },
          version: null,
        })}
        onReload={() => {}}
      />,
    );
    expect(text).toContain('so it cannot be edited.');
    expect(text).toContain('Delete this project Delete project');
  });
});

describe('a project made with an older template version', () => {
  it('says, as information rather than a problem, that saving regenerates it', () => {
    const snapshot = storedSnapshots[0] ?? null;
    const version = {
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: { ok: true, outputs: snapshot?.outputs, changes: [], truncated: false },
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
    expect(render(editor)).toMatch(/<div class="k-callout" data-tone="info" role="status">/);
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

  it('gives lengths the number pad, with autocorrect off, and no inch unit', () => {
    expect(html).toMatch(
      /id="p-beamHeight"[^>]*inputMode="decimal" autoCapitalize="off" autoCorrect="off"/,
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
    status: 'planned',
    snapshot: { params: example.params, structuralInputs: example.structuralInputs },
  } as unknown as Parameters<typeof changesFor>[0];
  const fromForm = (p: unknown, i: unknown) =>
    [
      buildFromForm(template.form.params, formValues(template.form.params, p)),
      buildFromForm(template.form.structuralInputs, formValues(template.form.structuralInputs, i)),
    ] as const;

  const edited = (name: string, params: unknown, inputs: unknown, status = 'planned' as const) =>
    ({ name, status, params, inputs }) as Parameters<typeof changesFor>[1];

  it('sends only the name for a rename, so the plan is not regenerated', () => {
    const [p, i] = fromForm(example.params, example.structuralInputs);
    expect(changesFor(project, edited('Swing set', p, i))).toEqual({ name: 'Swing set' });
    expect(changesFor(project, edited('Backyard', p, i))).toEqual({});
  });

  it('sends only the status when it is set by hand (#355)', () => {
    const [p, i] = fromForm(example.params, example.structuralInputs);
    const built = { name: 'Backyard', status: 'built' as const, params: p, inputs: i };
    expect(changesFor(project, built)).toEqual({ status: 'built' });
  });

  it('sends the parameters when one changes', () => {
    const [p, i] = fromForm(
      { ...(example.params as object), beamLength: 132 },
      example.structuralInputs,
    );
    expect(Object.keys(changesFor(project, edited('Backyard', p, i)))).toEqual(['params']);
  });
});

describe('editing a plan stored before a parameter existed (#429)', () => {
  const read = readSnapshot(TEMPLATES, cabinetV7[0]);
  if (!read.ok) throw new Error(read.message);
  const project = projectFrom(read.snapshot as NonNullable<Project['snapshot']>, {
    name: 'Record cabinet',
    templateId: 'record-cabinet',
  });

  it('starts the leg base from Kerf’s suggestions, saying so under each field', () => {
    expect(read.snapshot.params).not.toHaveProperty('legShowing');
    const text = renderText(<EditProject project={project} onReload={() => {}} />);
    expect(text).toContain(
      'Rule of thumb: about 5" of leg below the aprons, as you chose for this cabinet. Your plan was saved before Kerf asked for this, so Kerf suggests it.',
    );
    const html = render(<EditProject project={project} onReload={() => {}} />);
    const input = html.match(
      new RegExp(`<input[^>]*id="${fieldId('params', 'legShowing')}"[^>]*>`),
    );
    expect(input?.[0]).toContain('value="5"');
  });

  it('sends nothing but the name for a rename, so the stored plan is kept', () => {
    const values = editorValues(project);
    if (!values) throw new Error('readable');
    expect(values.params).toMatchObject({ legShowing: 5, tenonLength: 1 });
    const edited = {
      name: 'Hall cabinet',
      status: project.status,
      params: values.params as Record<string, unknown>,
      inputs: values.structuralInputs as Record<string, unknown>,
    };
    expect(changesFor(project, edited)).toEqual({ name: 'Hall cabinet' });
  });
});

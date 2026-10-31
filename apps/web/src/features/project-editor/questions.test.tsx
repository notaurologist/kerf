import {
  confirmedPaths,
  findTemplate,
  formValues,
  type StartingQuestions,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { render, renderText } from '../../test/render.tsx';
import { ProjectEditor } from './ProjectEditor.tsx';
import { answer, StartQuestions } from './StartQuestions.tsx';

// Starting a new project from a few questions (#163).

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const questions = template.questions as StartingQuestions;

const answers = {
  riders: 'kids-and-adults',
  'riderWeights.0': '200',
  'riderWeights.1': '90',
  'area.length': "21'",
  'area.depth': "28'",
  'ground.kind': 'level',
  'ground.slope': '',
  feet: 'buried',
};

describe('the starting questions', () => {
  const screen = (
    <StartQuestions
      template={template}
      questions={questions}
      title="New swing set"
      starts={null}
      editor={() => null}
    />
  );

  it('asks each question empty, with nothing chosen for the owner', () => {
    const html = render(screen);
    expect(html).not.toMatch(/<input[^>]* value="[^"]+"/);
    expect(html).not.toMatch(/<option value="[^"]+" selected=""/);
    const text = renderText(screen);
    expect(text).toContain('Who will ride');
    expect(text).toContain('Length along the beam');
    expect(text).toContain('Suggest dimensions');
    // The slope is asked only once the ground is sloped.
    expect(html).not.toContain('id="q-ground.slope"');
  });

  it('says what is missing or cannot be read', () => {
    const result = answer(template, questions, { ...answers, 'area.depth': '28 6', riders: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.field).sort()).toEqual(['area.depth', 'riders']);
  });

  it('suggests values from complete answers', () => {
    const result = answer(template, questions, answers);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.value.params['beamHeight']).toBe('84');
    expect(result.value.params['beamLength']).toBe('108');
    expect(result.value.inputs['riderWeights.0']).toBe('200');
  });
});

describe('the form filled in from the answers', () => {
  const result = answer(template, questions, answers);
  if (!result.ok) throw new Error('answers refused');
  const { params, inputs, about } = result.value;
  const editor = (
    <ProjectEditor template={template} initial={{ name: '', params, inputs }} suggested={about} />
  );
  const html = render(editor);
  const text = renderText(editor);

  it('says where each suggested value came from', () => {
    expect(text).toContain(
      `Source: CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), pp. 2 and 7. The usual height is 10' 0"`,
    );
    expect(text).toContain("From the template's worked example.");
    expect(text).toContain('Rule of thumb: each swing at a third of the beam');
    expect(html).toMatch(/id="p-beamHeight"[^>]*aria-describedby="[^"]*p-beamHeight-about/);
  });

  it('leaves hardware and every structural input but rider weight empty (rule 3)', () => {
    for (const path of confirmedPaths(template.form.params)) expect(params[path]).toBe('');
    const filled = Object.entries(inputs).filter(([, t]) => t !== '');
    expect(filled.map(([path]) => path)).toEqual(['riderWeights.0', 'riderWeights.1']);
    expect(html).toMatch(/Leg-to-beam bolt diameter<\/span><span class="k-needed">/);
  });

  it('stops saying where a value came from once the owner changes it', () => {
    const changed = { ...params, beamHeight: '90' };
    const edited = render(
      <ProjectEditor
        template={template}
        initial={{ name: '', params: changed, inputs }}
        suggested={about}
      />,
    );
    expect(edited).not.toContain('id="p-beamHeight-about"');
    expect(edited).toContain('id="p-beamLength-about"');
  });

  it('starts from the answers, not from empty', () => {
    expect(params).not.toEqual(formValues(template.form.params, {}));
  });
});

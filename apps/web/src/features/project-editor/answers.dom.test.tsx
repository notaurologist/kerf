// @vitest-environment happy-dom
import { findTemplate, formValues, type TemplateDefinition } from '@kerf/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle } from '../../test/dom.tsx';
import { ProjectEditor } from './ProjectEditor.tsx';

// A project started from the questions sends its answers with Create, so the server can tell which
// values are still Kerf's suggestions (#417). The form holds the worked example's values here.

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const example = template.examples[0];
const answers = template.questions?.examples[0];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('creating a project started from the questions', () => {
  it('sends the answers with Create and with the preview', async () => {
    const sent: { path: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      const raw = input instanceof Request ? await input.text() : String(init?.body ?? '');
      sent.push({ path: new URL(url, 'http://localhost').pathname, body: JSON.parse(raw) });
      return new Response(JSON.stringify({ error: 'boom' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    });
    const { container } = mount(
      <ProjectEditor
        template={template}
        initial={{
          name: 'From answers',
          params: formValues(template.form.params, example?.params),
          inputs: formValues(template.form.structuralInputs, example?.structuralInputs),
        }}
        answers={answers}
      />,
    );
    // The preview is asked for a moment after the form is filled.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await settle();
    const preview = sent.find((s) => s.path === '/api/projects/preview');
    expect(preview?.body.answers).toEqual(answers);
    // Create is in the header and beside the form; both submit the same form.
    const create = container.querySelector('button[type="submit"]');
    if (!create) throw new Error('no Create button');
    await click(create);
    for (let i = 0; i < 3; i++) await settle();
    const created = sent.find((s) => s.path === '/api/projects');
    expect(created?.body.answers).toEqual(answers);
    expect(created?.body.params).toBeDefined();
  });
});

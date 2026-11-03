// @vitest-environment happy-dom
import { findTemplate, type StartingQuestions, type TemplateDefinition } from '@kerf/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, click, mount, settle } from '../../test/dom.tsx';
import { type FromAnswers, StartQuestions } from './StartQuestions.tsx';

// The answers go to the API, which makes the suggestions (#420); a fake server stands in for it.

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const questions = template.questions as StartingQuestions;

const answers: Record<string, string> = {
  riders: 'kids',
  'riderWeights.0': '90',
  'riderWeights.1': '110',
  'area.length': "30'",
  'area.depth': "40'",
  'ground.kind': 'level',
  feet: 'pads',
};

async function type(id: string, value: string) {
  const control = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  const proto = control instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(control, value);
    control.dispatchEvent(
      new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
}

/** Answers every question, submits, and returns what the editor opened with, if it did. */
async function submit(respond: (body: unknown) => Response) {
  const sent: { path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const raw = input instanceof Request ? await input.text() : String(init?.body ?? '');
    const body = JSON.parse(raw);
    sent.push({ path: new URL(url, 'http://localhost').pathname, body });
    return respond(body);
  });
  let opened: FromAnswers | null = null;
  const { container } = mount(
    <StartQuestions
      template={template}
      questions={questions}
      title="New swing set"
      starts={null}
      editor={(from) => {
        opened = from;
        return <p>Editor</p>;
      }}
    />,
  );
  for (const [path, value] of Object.entries(answers)) await type(`q-${path}`, value);
  await click(byText(container, 'button', 'Suggest dimensions'));
  for (let i = 0; i < 3; i++) await settle();
  return { sent, opened: opened as FromAnswers | null, container };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('suggesting from the answers', () => {
  it('sends the answers to the API and opens the editor with what it suggests', async () => {
    const { sent, opened } = await submit(() =>
      json({
        suggestions: [
          { from: 'params', path: 'beamLength', value: 120, basis: { kind: 'example' } },
        ],
      }),
    );
    expect(sent).toEqual([
      {
        path: '/api/templates/swing-set-a-frame/suggestions',
        body: { answers: questions.examples[0] },
      },
    ]);
    expect(opened?.params['beamLength']).toBe('120');
    expect(opened?.about.get('params beamLength')?.about).toBe(
      "From the template's worked example.",
    );
    // Create sends them on, so the server can tell which values are still suggestions (#417).
    expect(opened?.answers).toEqual(questions.examples[0]);
  });

  it('places what the API refuses under the question it concerns', async () => {
    const { opened, container } = await submit(() =>
      json(
        {
          error: 'invalid-request',
          issues: [{ path: ['answers', 'area', 'depth'], message: 'Too shallow.' }],
        },
        400,
      ),
    );
    expect(opened).toBeNull();
    expect(container.textContent).toContain('Too shallow.');
  });

  it('keeps the answers when the server cannot answer', async () => {
    const { opened, container } = await submit(() => json({ error: 'boom' }, 500));
    expect(opened).toBeNull();
    expect(container.textContent).toContain('No suggestions.');
    expect(container.textContent).toContain('Your answers are still here.');
    expect((document.getElementById('q-area.length') as HTMLInputElement).value).toBe("30'");
  });
});

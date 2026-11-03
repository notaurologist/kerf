// @vitest-environment happy-dom
import { findTemplate } from '@kerf/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { href } from './lib/route.ts';
import { byText, click, goTo, mount, settle } from './test/dom.tsx';
import { projectFrom, storedSnapshots } from './test/projects.ts';

// Each form screen, typed into and then left: a change not saved asks first, and a saved one
// does not. A fake server stands in for the API.

const project = projectFrom(storedSnapshots[0] ?? null, { name: 'Backyard swing set' });

function server() {
  let current = project;
  let tools = { tools: [{ toolTypeId: 'miter-saw', capabilities: {} }], revision: 1 };
  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
      .pathname;
    const method = (input instanceof Request ? input.method : init?.method) ?? 'GET';
    const raw = input instanceof Request ? await input.text() : String(init?.body ?? '');
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (path === '/api/session') return json({ expiresAt: '2026-11-04T12:00:00.000Z' });
    if (path === '/api/templates') return json({ templates: [] });
    // Suggests as the API does, from core.
    if (path === `/api/templates/${project.templateId}/suggestions`) {
      return json({
        suggestions: findTemplate(project.templateId)?.questions?.suggest(body.answers),
      });
    }
    if (path === '/api/tools') {
      if (method === 'PUT') tools = { ...tools, ...body, revision: tools.revision + 1 };
      return json(tools);
    }
    if (path === '/api/projects') {
      if (method === 'POST') current = { ...current, name: String(body.name) };
      return method === 'POST' ? json(current) : json({ projects: [] });
    }
    if (path === `/api/projects/${project.id}`) {
      if (method === 'PUT') current = { ...current, ...body, revision: current.revision + 1 };
      return json(current);
    }
    return json({ error: 'not-found' }, 404);
  });
}

async function loaded() {
  for (let i = 0; i < 5; i++) await settle();
}

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

/** Follows the Workshop link, as the owner leaving the form would. */
const toWorkshop = () => click(document.querySelector('a[href="#/workshop"]') as Element);

const asking = () =>
  [...document.querySelectorAll('dialog')].some(
    (d) => d.open && d.textContent?.includes('Leave without saving?'),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('leaving the project form', () => {
  it('asks with a change not saved, and not once it is saved', async () => {
    server();
    await goTo(href({ screen: 'edit-project', id: project.id }));
    const { container } = mount(<App />);
    await loaded();
    await type('project-name', 'Swing set for the oak');
    await toWorkshop();
    expect(asking()).toBe(true);
    expect(window.location.hash).toBe(`#/projects/${project.id}/edit`);

    await click(byText(container, 'button', 'Keep editing'));
    await click(container.querySelector('button[type="submit"]') as Element);
    await loaded();
    expect(window.location.hash).toBe(`#/projects/${project.id}`);
    await toWorkshop();
    expect(asking()).toBe(false);
    expect(window.location.hash).toBe('#/workshop');
  });
});

describe('leaving My toolbox', () => {
  it('asks with a change not saved, and not once it is saved', async () => {
    server();
    await goTo(href({ screen: 'tools' }));
    mount(<App />);
    await loaded();
    await type('tool-tools-0-capabilities-cutDepth', '4');
    await toWorkshop();
    expect(asking()).toBe(true);
    expect(window.location.hash).toBe('#/tools');

    await click(byText(document.body, 'button', 'Keep editing'));
    // Typing saves after a pause.
    await act(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    await loaded();
    expect(document.body.textContent).toContain('Saved.');
    await toWorkshop();
    expect(asking()).toBe(false);
    expect(window.location.hash).toBe('#/workshop');
  });
});

describe('leaving a new project started from the questions', () => {
  const answers = {
    'q-riders': 'kids-and-adults',
    'q-riderWeights.0': '200',
    'q-riderWeights.1': '90',
    'q-area.length': "21'",
    'q-area.depth': "28'",
    'q-ground.kind': 'level',
    'q-feet': 'buried',
  };

  async function suggested() {
    server();
    await goTo(
      href({ screen: 'new-project', templateId: project.templateId, start: { kind: 'questions' } }),
    );
    const { container } = mount(<App />);
    await loaded();
    for (const [id, value] of Object.entries(answers)) await type(id, value);
    await click(byText(container, 'button', 'Suggest dimensions'));
    await loaded();
    return container;
  }

  it('asks before leaving answers typed but not yet used', async () => {
    server();
    await goTo(
      href({ screen: 'new-project', templateId: project.templateId, start: { kind: 'questions' } }),
    );
    mount(<App />);
    await loaded();
    await type('q-riderWeights.0', '200');
    await toWorkshop();
    expect(asking()).toBe(true);
  });

  it('asks before Change your answers drops a change, and keeps the change on Keep editing', async () => {
    const container = await suggested();
    await type('project-name', 'Swing set for the oak');
    await click(byText(container, 'button', 'Change your answers'));
    expect(asking()).toBe(true);
    await click(byText(container, 'button', 'Keep editing'));
    expect((document.getElementById('project-name') as HTMLInputElement).value).toBe(
      'Swing set for the oak',
    );

    await click(byText(container, 'button', 'Change your answers'));
    await click(byText(container, 'button', 'Leave without saving'));
    expect(document.getElementById('project-name')).toBeNull();
    expect((document.getElementById('q-riderWeights.0') as HTMLInputElement).value).toBe('200');
  });

  it('goes back to the answers at once when nothing was changed', async () => {
    const container = await suggested();
    await click(byText(container, 'button', 'Change your answers'));
    expect(asking()).toBe(false);
    expect((document.getElementById('q-riderWeights.0') as HTMLInputElement).value).toBe('200');
  });

  it('asks with a change not saved, and not once the project is created', async () => {
    const container = await suggested();
    await type('project-name', 'Swing set for the oak');
    await toWorkshop();
    expect(asking()).toBe(true);

    await click(byText(container, 'button', 'Keep editing'));
    await click(container.querySelector('button[type="submit"]') as Element);
    await loaded();
    expect(window.location.hash).toBe(`#/projects/${project.id}`);
    await toWorkshop();
    expect(asking()).toBe(false);
    expect(window.location.hash).toBe('#/workshop');
  });
});

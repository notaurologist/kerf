// @vitest-environment happy-dom
import { shoppingGroups } from '@kerf/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeScreen, ModeView } from '../features/modes/modes.tsx';
import { ProjectScreen } from '../features/project/ProjectScreen.tsx';
import { mount, settle } from '../test/dom.tsx';
import { loadedDrawings, projectFrom, storedSnapshots } from '../test/projects.ts';
import { readPlan } from './plan.ts';
import { projectStore } from './projectStore.ts';
import { SessionReturns } from './session.ts';
import type { Project } from './types.ts';

// Ticks the server accepted in a mode stay done on the plan after leaving it (#703): the kept
// project takes them, and a project read before they were accepted does not put older ones back.
// When the plan shows the kept copy because refreshing it failed, a line says so.

const [worked] = storedSnapshots;
if (!worked) throw new Error('fixture has a worked example');
const complete = worked;
const plan = readPlan(projectFrom(complete));
if (!plan.ok) throw new Error(plan.message);
const lines = shoppingGroups(plan.plan).flatMap((g) => g.lines).length;

let ids = 0;
/** A project of its own for each test: each project's ticks live for the page's life. */
const fresh = () =>
  projectFrom(complete, { id: `6f1c2a3e-0000-4000-8000-${String(++ids).padStart(12, '0')}` });

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

/**
 * A server that saves ticks and answers each project GET with `get` (others are refused as if
 * offline). Returns the ticks it holds.
 */
function server(get: (project: Project) => Promise<Response> = () => Promise.reject(offline())) {
  const ticks: { kind: string; key: string; doneAt: string }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const path = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'PATCH' && path.endsWith('/progress')) {
      const body = (await request.json()) as {
        changes: { kind: string; key: string; done: boolean }[];
      };
      for (const c of body.changes) {
        const at = ticks.findIndex((t) => t.kind === c.kind && t.key === c.key);
        if (at >= 0) ticks.splice(at, 1);
        if (c.done) ticks.push({ kind: c.kind, key: c.key, doneAt: '2026-11-05T12:00:00.000Z' });
      }
      return json({ ticks: [...ticks], status: 'in-progress' });
    }
    const id = /^\/api\/projects\/([^/]+)$/.exec(path)?.[1];
    if (request.method === 'GET' && id) return get(projectFrom(complete, { id }));
    throw offline();
  });
  return ticks;
}
const offline = () => new TypeError('Failed to fetch');

const lineBoxes = (root: ParentNode) => [
  ...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ticks accepted in a mode', () => {
  it('show as done on the plan after Exit, with the refresh failing', async () => {
    const project = fresh();
    projectStore.set(project);
    const saved = server();
    const shop = mount(<ModeScreen route={{ screen: 'shop', id: project.id }} />);
    await settle();
    const [first] = lineBoxes(shop.container);
    if (!first) throw new Error('the shopping list has lines');
    first.click();
    await settle();
    expect(saved).toHaveLength(1);
    expect(shop.container.textContent).not.toContain('not saved yet');
    expect(projectStore.get(project.id)?.status).toBe('in-progress');
    shop.unmount();

    const { container } = mount(<ProjectScreen id={project.id} />);
    await settle();
    expect(container.textContent).toContain(`1 of ${lines} bought`);
    expect(container.textContent).toContain('In progress');
  });

  it('are not undone by a project request that was out when they were accepted', async () => {
    const project = fresh();
    projectStore.set(project);
    let answer: (r: Response) => void = () => {};
    server(() => new Promise((resolve) => (answer = resolve)));
    const shop = mount(<ModeScreen route={{ screen: 'shop', id: project.id }} />);
    await settle();
    const box = () => lineBoxes(shop.container)[0] as HTMLInputElement;
    box().click();
    await settle();
    expect(box().checked).toBe(true);

    // The project as the server read it before the tick: no ticks, still planned.
    answer(json(project));
    await settle();
    expect(box().checked).toBe(true);
    expect(projectStore.get(project.id)?.ticks).toHaveLength(1);
    expect(projectStore.get(project.id)?.status).toBe('in-progress');
  });

  it('are not undone by a screen showing a copy read before them', async () => {
    const project = fresh();
    server(() => Promise.resolve(json(project)));
    const shop = mount(<ModeScreen route={{ screen: 'shop', id: project.id }} />);
    await settle();
    const before = projectStore.get(project.id);
    if (!before) throw new Error('the project loaded');
    lineBoxes(shop.container)[0]?.click();
    await settle();
    shop.unmount();

    const { container } = mount(
      <ModeView
        route={{ screen: 'shop', id: project.id }}
        project={before}
        drawings={loadedDrawings(before)}
      />,
    );
    expect(lineBoxes(container)[0]?.checked).toBe(true);
  });

  it('give way to a project read after they were accepted', async () => {
    const project = fresh();
    projectStore.set(project);
    const answers: ((r: Response) => void)[] = [];
    server(() => new Promise((resolve) => answers.push(resolve)));
    const shop = mount(<ModeScreen route={{ screen: 'shop', id: project.id }} />);
    await settle();
    lineBoxes(shop.container)[0]?.click();
    await settle();
    answers.shift()?.(json(project));
    await settle();
    shop.unmount();

    // Cleared on another device since: the plan's own request, sent after the tick, says so.
    const { container } = mount(<ProjectScreen id={project.id} />);
    await settle();
    answers.shift()?.(json(project));
    await settle();
    expect(container.textContent).toContain(`${lines} to buy`);
  });
});

describe('the kept copy after a failed refresh', () => {
  it('says so, and goes once the session comes back and the project loads', async () => {
    const project = fresh();
    projectStore.set(project);
    let online = false;
    server(() => (online ? Promise.resolve(json(project)) : Promise.reject(offline())));
    const at = (returns: number) => (
      <SessionReturns value={returns}>
        <ProjectScreen id={project.id} />
      </SessionReturns>
    );
    const { container, rerender } = mount(at(0));
    await settle();
    expect(container.textContent).toContain(
      'Showing the copy loaded earlier. Kerf could not reach the server. Check your connection, then try again.',
    );
    expect(container.textContent).toContain(project.name);

    online = true;
    rerender(at(1));
    await settle();
    expect(container.textContent).not.toContain('Showing the copy loaded earlier.');
  });

  it('says so in a mode too', async () => {
    const project = fresh();
    projectStore.set(project);
    server();
    const { container } = mount(<ModeScreen route={{ screen: 'shop', id: project.id }} />);
    await settle();
    expect(container.textContent).toContain('Showing the copy loaded earlier.');
  });
});

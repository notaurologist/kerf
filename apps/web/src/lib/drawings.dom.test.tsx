// @vitest-environment happy-dom
import { createSnapshot, TEMPLATES } from '@kerf/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeScreen } from '../features/modes/modes.tsx';
import { ProjectScreen } from '../features/project/ProjectScreen.tsx';
import { mount, settle } from '../test/dom.tsx';
import { drawingsFor, loadedStepDrawing, projectFrom, storedSnapshots } from '../test/projects.ts';
import { projectStore } from './projectStore.ts';
import type { Project } from './types.ts';

// The plan's drawings come in a request of their own (#422), loaded where they are shown and
// kept, like the project, for the modes and for a dropped connection.

const project = projectFrom(storedSnapshots[0] ?? null, { name: 'Backyard swing set' });
const drawings = drawingsFor(project.snapshot);

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

/** A server that answers the project and its drawings, and records what was asked for. */
function server(answer: (path: string) => Promise<Response>) {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const path = new URL(String(input instanceof Request ? input.url : input), 'http://kerf.test')
      .pathname;
    asked.push(path);
    return answer(path);
  });
  return asked;
}

/** Lets requests answer and the screen take their values. */
async function arrive() {
  for (let i = 0; i < 3; i++) await settle();
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
}

afterEach(() => {
  projectStore.forget(project.id);
  vi.unstubAllGlobals();
});

describe('the plan’s drawings', () => {
  it('come apart from the project, and stay for the modes with the connection gone', async () => {
    const asked = server((path) =>
      path.endsWith('/drawings') ? json({ drawings }) : json(project),
    );
    const plan = mount(<ProjectScreen id={project.id} section="diagrams" />);
    await arrive();
    expect(asked).toContain(`/api/projects/${project.id}`);
    expect(asked).toContain(`/api/projects/${project.id}/drawings`);
    expect(plan.container.textContent).toContain('Cut details');
    expect(plan.container.querySelectorAll('svg').length).toBeGreaterThan(1);

    server(() => Promise.reject(new TypeError('Failed to fetch')));
    const build = mount(
      <ModeScreen route={{ screen: 'build-step', id: project.id, step: 'board-1' }} />,
    );
    await arrive();
    expect(build.container.textContent).not.toContain('could not be loaded');
    expect(build.container.querySelector('svg')).not.toBeNull();
  });

  it('say why they did not load, and ask again', async () => {
    projectStore.set({ ...project, revision: project.revision + 1 });
    let fail = true;
    server((path) =>
      path.endsWith('/drawings')
        ? fail
          ? json({ error: 'internal' }, 500)
          : json({ drawings })
        : json({ ...project, revision: project.revision + 1 }),
    );
    const plan = mount(<ProjectScreen id={project.id} section="diagrams" />);
    await arrive();
    expect(plan.container.textContent).toContain('The drawings could not be loaded.');
    fail = false;
    const retry = [...plan.container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Try again',
    );
    await act(async () => retry?.click());
    await arrive();
    expect(plan.container.textContent).not.toContain('could not be loaded');
    expect(plan.container.textContent).toContain('Cut details');
  });
});

describe('a build step’s action drawing', () => {
  // Generated now, since a plan stored before placements has no action drawings.
  const [template] = TEMPLATES;
  const example = template?.examples[0];
  const made =
    template && example && createSnapshot(template, example.params, example.structuralInputs);
  if (!made?.ok) throw new Error('worked example does not generate');
  const project = projectFrom(JSON.parse(JSON.stringify(made.output)) as Project['snapshot'], {
    id: '6f1c2a3e-0000-4000-8000-000000000635',
  });
  const drawings = drawingsFor(project.snapshot);
  afterEach(() => projectStore.forget(project.id));

  it('comes when its step opens, the next step’s behind it, and is not asked for twice', async () => {
    const frames = loadedStepDrawing(project, 'frames');
    if (frames.state !== 'ready' || !frames.value) throw new Error('frames has no drawing');
    const asked = server((path) => {
      if (path.endsWith('/drawings')) return json({ drawings });
      const step = path.match(/\/steps\/([^/]+)\/drawing$/)?.[1];
      if (step) return json({ drawing: step === 'frames' ? frames.value : null });
      return json(project);
    });
    const stepAsks = () => asked.filter((p) => p.includes('/steps/'));

    // A cutting step is drawn as its board, so it asks for no step drawing.
    mount(<ModeScreen route={{ screen: 'build-step', id: project.id, step: 'board-1' }} />);
    await arrive();
    expect(stepAsks()).toEqual([]);

    mount(<ModeScreen route={{ screen: 'build-step', id: project.id, step: 'site' }} />);
    await arrive();
    expect(stepAsks()).toEqual([
      `/api/projects/${project.id}/steps/site/drawing`,
      `/api/projects/${project.id}/steps/frames/drawing`,
    ]);

    const build = mount(
      <ModeScreen route={{ screen: 'build-step', id: project.id, step: 'frames' }} />,
    );
    await arrive();
    expect(build.container.innerHTML).toContain(frames.value.description);
    // Frames was loaded ahead, so only the step after it is asked for.
    expect(stepAsks().slice(2)).toEqual([`/api/projects/${project.id}/steps/hanger-holes/drawing`]);
  });
});

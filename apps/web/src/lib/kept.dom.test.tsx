// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolPage } from '../features/inventory/ToolPage.tsx';
import { keptTools, ToolsScreen } from '../features/inventory/ToolsScreen.tsx';
import { EditProjectScreen } from '../features/project-editor/ProjectEditor.tsx';
import { ProjectsScreen } from '../features/projects/ProjectsScreen.tsx';
import { mount, settle } from '../test/dom.tsx';
import { projectFrom, storedSnapshots } from '../test/projects.ts';
import { projectList, projectStore } from './projectStore.ts';
import { type Kept, keep, useLoad } from './useLoad.ts';

// A screen visited before shows its last value in the first frame and refreshes it quietly (#253).

const project = projectFrom(storedSnapshots[0] ?? null, { name: 'Backyard swing set' });
const inventory = {
  tools: [{ toolTypeId: 'rafter-square', name: 'Rafter square', capabilities: {} }],
  other: [],
};

/** A server that never answers, so only what was kept can be on screen. */
const silent = () => vi.stubGlobal('fetch', () => new Promise(() => {}));
const answering = (body: unknown) =>
  vi.stubGlobal('fetch', async () => Response.json(body as object));

afterEach(() => {
  projectStore.forget(project.id);
  projectList.forget();
  keptTools.forget();
  vi.unstubAllGlobals();
});

describe('a screen visited before', () => {
  it('shows the projects list at once', () => {
    silent();
    projectList.set({ projects: [project], templates: [] });
    const { container } = mount(<ProjectsScreen />);
    expect(container.textContent).toContain('Backyard swing set');
    expect(container.textContent).not.toContain('Loading projects');
  });

  it('shows the tools and a tool page at once', () => {
    silent();
    keptTools.set(inventory as never);
    const tools = mount(<ToolsScreen />).container;
    const page = mount(<ToolPage id="rafter-square" />).container;
    expect(tools.querySelector('input[type="checkbox"]:checked')).not.toBeNull();
    expect(page.textContent).toContain('In your tool list.');
    expect(page.textContent).not.toContain('Checking your tools');
  });

  it('opens the editor at once from the open project', () => {
    silent();
    projectStore.set(project);
    const { container } = mount(<EditProjectScreen id={project.id} />);
    expect(container.querySelector('input')?.value).toBe('Backyard swing set');
    expect(container.textContent).not.toContain('Loading project');
  });

  it('starts the editor again from a newer project saved elsewhere', async () => {
    projectStore.set(project);
    answering({ ...project, name: 'Renamed', updatedAt: '2030-01-01T00:00:00.000Z' });
    const { container } = mount(<EditProjectScreen id={project.id} />);
    await settle();
    expect(container.querySelector('input')?.value).toBe('Renamed');
  });
});

/** Loads `{ n: 1 }`, records each value it shows, and adds one to it when pressed. */
function Probe(props: { kept: Kept<{ n: number }>; seen: { n: number }[] }) {
  const { loaded, update } = useLoad(
    async () => ({ ok: true, value: { n: 1 } }),
    'probe',
    props.kept,
  );
  if (loaded.state === 'ready') props.seen.push(loaded.value);
  return (
    <button type="button" onClick={() => update((v) => ({ n: v.n + 1 }))}>
      {loaded.state === 'ready' ? loaded.value.n : 'loading'}
    </button>
  );
}

describe('useLoad with a kept value', () => {
  it('leaves the screen as it is when the refresh brings the same value', async () => {
    const kept = keep<{ n: number }>();
    const shown = { n: 1 };
    kept.set(shown);
    const seen: { n: number }[] = [];
    mount(<Probe kept={kept} seen={seen} />);
    await settle();
    expect(seen.every((value) => value === shown)).toBe(true);
  });

  it('shows a different value the refresh brings', async () => {
    const kept = keep<{ n: number }>();
    kept.set({ n: 0 });
    const { container } = mount(<Probe kept={kept} seen={[]} />);
    expect(container.textContent).toBe('0');
    await settle();
    expect(container.textContent).toBe('1');
    expect(kept.get()).toEqual({ n: 1 });
  });

  it('keeps a change made on screen for the next visit', async () => {
    const kept = keep<{ n: number }>();
    const { container } = mount(<Probe kept={kept} seen={[]} />);
    await settle();
    container.querySelector('button')?.click();
    await settle();
    expect(kept.get()).toEqual({ n: 2 });
  });
});

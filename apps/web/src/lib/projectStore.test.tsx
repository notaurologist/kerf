import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeScreen } from '../features/modes/modes.tsx';
import { ProjectScreen } from '../features/project/ProjectScreen.tsx';
import { projectFrom, storedSnapshots } from '../test/projects.ts';
import { renderText } from '../test/render.tsx';
import { projectStore } from './projectStore.ts';
import { settled } from './useLoad.ts';

const project = projectFrom(storedSnapshots[0] ?? null, { name: 'Backyard swing set' });
const offline = { kind: 'failed' as const, status: 0, message: 'The server could not be reached.' };

afterEach(() => {
  projectStore.forget(project.id);
  vi.unstubAllGlobals();
});

describe('an open project', () => {
  it('stays readable from the plan to building and back with the connection gone', () => {
    projectStore.set(project);
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const plan = renderText(<ProjectScreen id={project.id} />);
    const build = renderText(<ModeScreen route={{ screen: 'build', id: project.id }} />);
    const back = renderText(<ProjectScreen id={project.id} />);
    for (const text of [plan, build, back]) {
      expect(text).toContain('Backyard swing set');
      expect(text).not.toContain('Loading project');
      expect(text).not.toContain('could not be reached');
    }
    expect(plan).toContain('131-1/2"');
    expect(build).toContain('Building · Backyard swing set');
  });

  it('loads a project it has not kept', () => {
    projectStore.set(project);
    expect(renderText(<ProjectScreen id="another" />)).not.toContain('Backyard swing set');
  });

  it('is forgotten when deleted', () => {
    projectStore.set(project);
    projectStore.forget(project.id);
    expect(projectStore.get(project.id)).toBeUndefined();
  });
});

describe('settled', () => {
  it('shows a newer value when the request succeeds', () => {
    const newer = { ...project, name: 'Renamed' };
    expect(settled({ ok: true, value: newer }, project)).toEqual({ state: 'ready', value: newer });
  });

  it('keeps the kept value when the request fails', () => {
    expect(settled({ ok: false, error: offline }, project)).toEqual({
      state: 'ready',
      value: project,
    });
  });

  it('shows the problem when nothing was kept', () => {
    expect(settled({ ok: false, error: offline }, undefined)).toEqual({
      state: 'error',
      error: offline,
    });
  });
});

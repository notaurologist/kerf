import { describe, expect, it } from 'vitest';
import type { ProjectSummary } from '../../lib/types.ts';
import { render as renderHtml, textOf } from '../../test/render.tsx';
import { ProjectList, savedFirst, withStatus } from './ProjectsScreen.tsx';

const templates = [{ id: 'swing-set-a-frame', version: 2, name: 'Two-swing A-frame swing set' }];

const project = (overrides: Partial<ProjectSummary> = {}): ProjectSummary => ({
  id: '6f1c2a3e-0000-4000-8000-000000000001',
  name: 'Backyard swing set',
  status: 'in-progress',
  templateId: 'swing-set-a-frame',
  templateVersion: 2,
  templateBehind: false,
  progress: null,
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
  ...overrides,
});

const render = (projects: ProjectSummary[]) =>
  renderHtml(<ProjectList projects={projects} templates={templates} onStatus={() => {}} />);

describe('ProjectList', () => {
  it('says when there are no projects, and offers a new one for each template', () => {
    const html = render([]);
    expect(html).toContain('No projects yet.');
    expect(html).toContain('New two-swing A-frame swing set');
    expect(html).toContain('href="#/projects/new?template=swing-set-a-frame"');
  });

  it('shows each project with its template, version, and status', () => {
    const html = render([project()]);
    expect(html).toContain('href="#/projects/6f1c2a3e-0000-4000-8000-000000000001"');
    expect(html).toContain('Two-swing A-frame swing set, version 2');
    expect(html).toMatch(/<option value="in-progress" selected="">In progress<\/option>/);
    expect(html).not.toContain('newer version');
  });

  it('marks a project whose template version is behind', () => {
    expect(render([project({ templateVersion: 1, templateBehind: true })])).toContain(
      'The template has a newer version.',
    );
  });
});

describe('changing a status', () => {
  const first = project();
  const second = project({ id: '6f1c2a3e-0000-4000-8000-000000000002', name: 'Bench' });

  it('shows the new status in place at once', () => {
    expect(withStatus([first, second], second.id, 'built')).toEqual([
      first,
      { ...second, status: 'built' },
    ]);
  });

  it('moves the saved project to the top, as the API orders the list', () => {
    const saved = { ...second, status: 'built' as const };
    expect(savedFirst([first, second], saved)).toEqual([saved, first]);
  });

  it('says on the row why a change did not go through', () => {
    const html = renderHtml(
      <ProjectList
        projects={[first, second]}
        templates={templates}
        errors={{ [second.id]: 'The server could not be reached.' }}
        onStatus={() => {}}
      />,
    );
    const rows = html.split('<li').slice(1).map(textOf);
    expect(rows[0]).not.toContain('Status not changed');
    expect(rows[1]).toContain('Status not changed. The server could not be reached.');
    expect(html).toContain('role="alert"');
  });
});

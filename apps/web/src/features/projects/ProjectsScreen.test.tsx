import { describe, expect, it } from 'vitest';
import type { ProjectSummary } from '../../lib/types.ts';
import { render as renderHtml } from '../../test/render.tsx';
import { ProjectList } from './ProjectsScreen.tsx';

const templates = [{ id: 'swing-set-a-frame', version: 2, name: 'Two-swing A-frame swing set' }];

const project = (overrides: Partial<ProjectSummary> = {}): ProjectSummary => ({
  id: '6f1c2a3e-0000-4000-8000-000000000001',
  name: 'Backyard swing set',
  status: 'in-progress',
  templateId: 'swing-set-a-frame',
  templateVersion: 2,
  templateBehind: false,
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

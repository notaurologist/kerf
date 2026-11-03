import { describe, expect, it } from 'vitest';
import type { ProjectSummary } from '../../lib/types.ts';
import { render as renderHtml, textOf } from '../../test/render.tsx';
import { ProjectList } from './ProjectsScreen.tsx';

const templates = [
  {
    id: 'swing-set-a-frame',
    version: 2,
    name: 'Two-swing A-frame swing set',
    description: 'A backyard swing set.',
  },
];

const project = (overrides: Partial<ProjectSummary> = {}): ProjectSummary => ({
  id: '6f1c2a3e-0000-4000-8000-000000000001',
  name: 'Backyard swing set',
  status: 'in-progress',
  templateId: 'swing-set-a-frame',
  templateVersion: 2,
  revision: 1,
  templateBehind: false,
  progress: null,
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
  ...overrides,
});

const render = (projects: ProjectSummary[]) =>
  renderHtml(<ProjectList projects={projects} templates={templates} />);

describe('ProjectList', () => {
  it('says when there are no projects, and offers one New project whatever the templates', () => {
    const html = render([]);
    expect(html).toContain('No projects yet.');
    expect(html.match(/class="k-button"/g)).toHaveLength(1);
    expect(html).toContain('href="#/projects/new">New project</a>');
    expect(html).not.toContain('New two-swing');
  });

  it('says what Delete did, and leaves the trash and the download to Workshop', () => {
    const html = render([project()]);
    expect(html).not.toContain('href="#/trash"');
    expect(html).not.toContain('/api/export');
    const flashed = renderHtml(
      <ProjectList
        projects={[]}
        templates={templates}
        flash="Moved “Shed” to Deleted projects in Workshop."
      />,
    );
    expect(textOf(flashed)).toContain('Moved “Shed” to Deleted projects in Workshop.');
  });

  it('shows each project with its template, its status as a label, and no version', () => {
    const html = render([project()]);
    expect(html).toContain('href="#/projects/6f1c2a3e-0000-4000-8000-000000000001"');
    expect(textOf(html)).toContain('Two-swing A-frame swing set. Updated');
    expect(html).toContain(
      '<span class="k-tag" data-tone="status" data-status="in-progress">In progress</span>',
    );
    expect(html).not.toContain('<select');
    expect(textOf(html)).not.toContain('version');
  });

  it('names each project as a row link, not an underlined link', () => {
    expect(render([project()])).toContain(
      '<a class="k-row-link" href="#/projects/6f1c2a3e-0000-4000-8000-000000000001">Backyard swing set',
    );
  });

  it('makes New the primary button only while there is nothing to resume', () => {
    expect(render([])).toContain('data-variant="primary" href="#/projects/new"');
    const resuming = project({
      progress: {
        shopping: { done: 1, total: 3 },
        pieces: { done: 0, total: 2 },
        steps: { done: 0, total: 2 },
        nextStep: { id: 's1', number: 1, title: 'Cut' },
        resumeStep: null,
      },
    });
    expect(render([resuming])).toContain('data-variant="secondary" href="#/projects/new"');
  });

  it('leaves a template version that is behind to the project itself', () => {
    expect(render([project({ templateVersion: 1, templateBehind: true })])).not.toContain(
      'newer version',
    );
  });
});

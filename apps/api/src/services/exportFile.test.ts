import { describe, expect, it } from 'vitest';
import { exportJson } from './exportFile.ts';
import { EXPORT_FORMAT_VERSION, type ProjectsExport } from './projects.ts';

const project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Swing set "A"',
  status: 'planned' as const,
  templateId: 'swing-set-a-frame',
  templateVersion: 3,
  revision: 2,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
  snapshot: { outputs: { parts: [1, 2] } },
  ticks: [],
  resets: [],
};

function exported(
  projects: ProjectsExport['projects'],
  deletedProjects: ProjectsExport['deletedProjects'] = [],
): ProjectsExport {
  return {
    kind: 'kerf-export',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: '2026-11-02T12:00:00.000Z',
    projects,
    deletedProjects,
    tools: { tools: [] },
  };
}

describe('exportJson', () => {
  it('joins to the same text as stringifying the whole export, one piece per project', () => {
    for (const projects of [[], [project], [project, { ...project, id: 'second' }]]) {
      const whole = exported(projects);
      const pieces = [...exportJson(whole)];
      expect(pieces.join('')).toBe(JSON.stringify(whole));
      expect(pieces).toHaveLength(projects.length + 3);
    }
  });

  it('streams the trashed projects too', () => {
    const trashed = { ...project, id: 'trashed', deletedAt: '2026-11-01T00:00:00.000Z' };
    const whole = exported([project], [trashed, { ...trashed, id: 'second' }]);
    const pieces = [...exportJson(whole)];
    expect(pieces.join('')).toBe(JSON.stringify(whole));
    expect(pieces).toHaveLength(6);
  });
});

import { useState } from 'react';
import { Notice } from '../../components/Shell.tsx';
import { api, describeError, send } from '../../lib/api.ts';
import { href } from '../../lib/route.ts';
import {
  type Project,
  type ProjectStatus,
  type ProjectSummary,
  STATUS_LABELS,
  STATUSES,
  type TemplateSummary,
} from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';

// Projects with their status (PRODUCT.md, MVP features 2 and 8), most recently updated first.

export function ProjectsScreen() {
  const { loaded, set } = useLoad(async () => {
    const [projects, templates] = await Promise.all([
      send(api.api.projects.$get()),
      send(api.api.templates.$get()),
    ]);
    if (!projects.ok) return projects;
    if (!templates.ok) return templates;
    return {
      ok: true,
      value: { projects: projects.value.projects, templates: templates.value.templates },
    };
  }, 'projects');
  const [error, setError] = useState<string | null>(null);

  if (loaded.state === 'loading') return <Notice>Loading projects…</Notice>;
  if (loaded.state === 'error') return <Notice tone="error">{describeError(loaded.error)}</Notice>;
  const { projects, templates } = loaded.value;

  const changeStatus = async (id: string, status: ProjectStatus) => {
    setError(null);
    const result = await send(api.api.projects[':id'].$put({ param: { id }, json: { status } }));
    if (!result.ok) {
      setError(describeError(result.error));
      return;
    }
    // The API moves an updated project to the top; keep the list in the order it would return.
    set({ templates, projects: [toSummary(result.value), ...projects.filter((p) => p.id !== id)] });
  };

  return (
    <ProjectList
      projects={projects}
      templates={templates}
      error={error}
      onStatus={(id, status) => void changeStatus(id, status)}
    />
  );
}

export function toSummary(project: Project): ProjectSummary {
  const { id, name, status, templateId, templateVersion, templateBehind, createdAt, updatedAt } =
    project;
  return { id, name, status, templateId, templateVersion, templateBehind, createdAt, updatedAt };
}

export function ProjectList(props: {
  projects: ProjectSummary[];
  templates: TemplateSummary[];
  error?: string | null;
  onStatus: (id: string, status: ProjectStatus) => void;
}) {
  const templateName = (id: string) => props.templates.find((t) => t.id === id)?.name ?? id;
  return (
    <>
      <h1>Projects</h1>
      <div className="row">
        {props.templates.map((t) => (
          <a
            key={t.id}
            className="button primary"
            href={href({ screen: 'new-project', templateId: t.id })}
          >
            New {t.name.charAt(0).toLowerCase() + t.name.slice(1)}
          </a>
        ))}
      </div>
      {props.error && <Notice tone="error">{props.error}</Notice>}
      {props.projects.length === 0 ? (
        <Notice>No projects yet.</Notice>
      ) : (
        <ul className="plain stack projects">
          {props.projects.map((p) => (
            <li key={p.id} className="card">
              <div className="row spread">
                <a className="project-name" href={href({ screen: 'project', id: p.id })}>
                  {p.name}
                </a>
                <label className="inline">
                  <span className="visually-hidden">Status of {p.name}</span>
                  <select
                    value={p.status}
                    onChange={(e) => props.onStatus(p.id, e.target.value as ProjectStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="muted">
                {templateName(p.templateId)}, version {p.templateVersion}. Updated{' '}
                {new Date(p.updatedAt).toLocaleDateString()}.
              </p>
              {p.templateBehind && (
                <p className="notice">
                  The template has a newer version. Open the project to see what regenerating would
                  change.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import { api, send } from './api.ts';
import type { Project, ProjectSummary, TemplateSummary } from './types.ts';
import { type Kept, keep, useLoad } from './useLoad.ts';

// The last project the API returned. Moving between the plan and a mode shows it at once and
// keeps it readable when the request to refresh it fails, as an open project should when the
// connection drops briefly (decision 0005). Only one is kept: a project is large.

let last: Project | undefined;

export const projectStore = {
  get: (id: string): Project | undefined => (last?.id === id ? last : undefined),
  set: (project: Project) => {
    last = project;
  },
  forget: (id: string) => {
    if (last?.id === id) last = undefined;
  },
};

export type Listed = { projects: ProjectSummary[]; templates: TemplateSummary[] };

/**
 * The last projects list shown, so coming back to Projects shows it at once while it refreshes.
 * Creating, saving, or deleting a project forgets it, so the list never shows a project that is
 * gone or a name that has changed.
 */
export const projectList = keep<Listed>();

/** The project, from the store at once if it is there, refreshed from the API. */
export function useProject(id: string) {
  const kept: Kept<Project> = { get: () => projectStore.get(id), set: projectStore.set };
  return useLoad(() => send(api.api.projects[':id'].$get({ param: { id } })), id, kept);
}

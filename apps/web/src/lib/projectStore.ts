import { api, send } from './api.ts';
import type { Project } from './types.ts';
import { type Kept, useLoad } from './useLoad.ts';

// The last project the API returned. Moving between the plan and a mode shows it at once and
// keeps it readable when the request to refresh it fails, as an open project should when the
// connection drops briefly (decision 0005). Only one is kept: a project is large.

let last: Project | undefined;

// Ticks saved in Shopping, Building and the structural review. Each project's ticks are marked
// with how many tick saves the server had accepted for it when they were read. Ticks read before
// the latest accepted save are older than the screen's, such as a project request that was out
// while a tick was saved, or a copy of a project from before it; they give way to that save's
// ticks and status. A counter rather than a time: the browser's clock and the server's need not
// agree, and a cleared tick leaves no time behind.

type Accepted = Pick<Project, 'ticks' | 'status'>;

const accepted = new Map<string, Accepted & { count: number }>();
const readAt = new WeakMap<readonly unknown[], number>();
const acceptedCount = (id: string) => accepted.get(id)?.count ?? 0;

/** True when `ticks` were read before the latest tick save accepted for project `id`. */
export function ticksAreOlder(id: string, ticks: readonly unknown[]): boolean {
  const at = readAt.get(ticks);
  return at !== undefined && at < acceptedCount(id);
}

/** The project with the latest accepted ticks and status, when its own are older. */
function current(project: Project): Project {
  const latest = accepted.get(project.id);
  if (!latest || !ticksAreOlder(project.id, project.ticks)) return project;
  return { ...project, ticks: latest.ticks, status: latest.status };
}

export const projectStore = {
  get: (id: string): Project | undefined => (last?.id === id ? last : undefined),
  set: (project: Project) => {
    last = current(project);
  },
  forget: (id: string) => {
    if (last?.id === id) last = undefined;
  },
  /** Ticks and status the server accepted for project `id`, as other changes are kept. */
  accept: (id: string, value: Accepted) => {
    const count = acceptedCount(id) + 1;
    accepted.set(id, { ...value, count });
    readAt.set(value.ticks, count);
    if (last?.id === id) last = { ...last, ticks: value.ticks, status: value.status };
  },
};

/** Reads project `id`, its ticks marked as read after the tick saves accepted so far. */
async function loadProject(id: string) {
  const count = acceptedCount(id);
  const result = await send(api.api.projects[':id'].$get({ param: { id } }));
  if (!result.ok) return result;
  readAt.set(result.value.ticks, count);
  return { ok: true as const, value: current(result.value) };
}

/** The project, from the store at once if it is there, refreshed from the API. */
export function useProject(id: string) {
  const kept: Kept<Project> = { get: () => projectStore.get(id), set: projectStore.set };
  return useLoad(() => loadProject(id), id, kept);
}

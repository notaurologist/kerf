import type { ProjectsExport } from './projects.ts';

/**
 * The backup as JSON text, one project at a time, so the route can stream it: Vercel holds a
 * function's response to 4.5 MB unless it streams, and a few dozen snapshots pass that. Joined,
 * the pieces are exactly `JSON.stringify(exported)`.
 */
export function* exportJson(exported: ProjectsExport): Generator<string> {
  const { projects, tools, ...head } = exported;
  yield `${JSON.stringify(head).slice(0, -1)},"projects":[`;
  for (const [index, project] of projects.entries()) {
    yield `${index > 0 ? ',' : ''}${JSON.stringify(project)}`;
  }
  yield `],"tools":${JSON.stringify(tools)}}`;
}

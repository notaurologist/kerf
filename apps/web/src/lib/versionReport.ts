import type { InferResponseType } from 'hono/client';
import { useMemo } from 'react';
import { type ApiResult, api, send } from './api.ts';
import type { Project } from './types.ts';
import { type Kept, type LoadState, useLoad } from './useLoad.ts';

// What regenerating an out-of-date plan would change comes in a request of its own, apart from the
// project: working it out generates the whole plan, which takes most of a second for a large one.
// The version notice asks for it when it shows. The last one loaded is kept in memory, so showing
// the same plan again does not ask again.

const route = api.api.projects[':id'].version;

/**
 * The report, with the template version and settings revision it was worked out with, which a
 * regeneration names so that a change to either since is refused (#700).
 */
export type LoadedReport = InferResponseType<typeof route.$get, 200>;

/** A plan's version status, with what regenerating would change when it can be regenerated. */
export type VersionReport = NonNullable<LoadedReport['version']>;

async function loadReport(id: string): Promise<ApiResult<LoadedReport>> {
  return send(route.$get({ param: { id } }));
}

/** The report a screen has so far, and how to ask for it again. Null when none is asked for. */
export type VersionReportState = LoadState<LoadedReport | null> & { retry?: () => void };

/**
 * The plan it was worked out for: the same project at the same revision, with the same status,
 * which a change to the owner's carry length changes. `attempt` counts regenerations refused
 * because the report was out of date, so each one asks again.
 */
const keyOf = (project: Pick<Project, 'id' | 'revision' | 'version'>, attempt: number) =>
  `${project.id}/${project.revision}/${JSON.stringify(project.version)}/${attempt}`;

let last: { key: string; report: LoadedReport | null } | undefined;

const kept = (key: string, asks: boolean): Kept<LoadedReport | null> => ({
  get: () => (!asks ? null : last?.key === key ? last.report : undefined),
  set: (report) => {
    if (asks) last = { key, report };
  },
});

/** Whether a plan with this status can be regenerated, and so has a report to ask for. */
const regenerable = (project: Pick<Project, 'version'>) =>
  project.version?.status === 'behind' || project.version?.status === 'carry-length';

/**
 * What regenerating the project's plan would change, loaded when the notice shows and again when
 * the plan, its status, or `attempt` changes. A plan that cannot be regenerated has none, so none
 * is asked for.
 */
export function useVersionReport(project: Project, attempt = 0): VersionReportState {
  const key = keyOf(project, attempt);
  const asks = regenerable(project);
  const keep = kept(key, asks);
  // A report does not change within one revision and status unless a regeneration was refused
  // for it, so one loaded is not asked for again: asking regenerates the whole plan on the server.
  const { loaded, reload } = useLoad<LoadedReport | null>(
    (): Promise<ApiResult<LoadedReport | null>> => {
      const known = keep.get();
      return known !== undefined
        ? Promise.resolve({ ok: true, value: known })
        : loadReport(project.id);
    },
    `${key}/${asks}`,
    keep,
  );
  return useMemo(() => ({ ...loaded, retry: reload }), [loaded, reload]);
}

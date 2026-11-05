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

/** A plan's version status, with what regenerating would change when it can be regenerated. */
export type VersionReport = NonNullable<InferResponseType<typeof route.$get, 200>['version']>;

async function loadReport(id: string): Promise<ApiResult<VersionReport | null>> {
  const result = await send(route.$get({ param: { id } }));
  return result.ok ? { ok: true, value: result.value.version } : result;
}

/** The report a screen has so far, and how to ask for it again. Null when the API has none. */
export type VersionReportState = LoadState<VersionReport | null> & { retry?: () => void };

/**
 * The plan it was worked out for: the same project at the same revision, with the same status,
 * which a change to the owner's carry length changes.
 */
const keyOf = (project: Pick<Project, 'id' | 'revision' | 'version'>) =>
  `${project.id}/${project.revision}/${JSON.stringify(project.version)}`;

let last: { key: string; report: VersionReport | null } | undefined;

const kept = (key: string, asks: boolean): Kept<VersionReport | null> => ({
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
 * the plan or its status changes. A plan that cannot be regenerated has none, so none is asked for.
 */
export function useVersionReport(project: Project): VersionReportState {
  const key = keyOf(project);
  const asks = regenerable(project);
  const keep = kept(key, asks);
  // A report does not change within one revision and status, so one loaded is not asked for
  // again: asking regenerates the whole plan on the server.
  const { loaded, reload } = useLoad<VersionReport | null>(
    (): Promise<ApiResult<VersionReport | null>> => {
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

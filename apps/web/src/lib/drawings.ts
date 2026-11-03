import { geometry } from '@kerf/core';
import { useMemo } from 'react';
import { type ApiResult, api, send } from './api.ts';
import type { Project } from './types.ts';
import { type Kept, type LoadState, useLoad } from './useLoad.ts';

// A plan's drawings come in a request of their own, apart from the project: a large plan's are
// megabytes, and most screens show none of them. The last ones loaded are kept in memory, like
// the project (`projectStore`), so the plan and the modes show them at once.

const Response = geometry.Drawings.nullable();

/**
 * The plan's drawings (#91), drawn by the API from the stored snapshot and parsed with core's
 * schema (hard rule 8). Null when the API has none, as for a plan whose snapshot cannot be read.
 */
async function loadDrawings(id: string): Promise<ApiResult<geometry.Drawings | null>> {
  const result = await send(api.api.projects[':id'].drawings.$get({ param: { id } }));
  if (!result.ok) return result;
  const parsed = Response.safeParse(result.value.drawings);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        error: {
          kind: 'failed',
          status: 200,
          message: 'The drawings the server sent could not be read.',
        },
      };
}

/** The drawings a screen has so far, and how to ask for them again. */
export type DrawingsState = LoadState<geometry.Drawings | null> & { retry?: () => void };

/** The plan they were drawn from: the same project at the same revision. */
const keyOf = (project: Pick<Project, 'id' | 'revision'>) => `${project.id}/${project.revision}`;

let last: { key: string; drawings: geometry.Drawings | null } | undefined;

const kept = (key: string): Kept<geometry.Drawings | null> => ({
  get: () => (last?.key === key ? last.drawings : undefined),
  set: (drawings) => {
    last = { key, drawings };
  },
});

/**
 * The project's drawings, loaded when it is shown and again whenever its plan changes. A plan
 * that cannot be read has none, so none are asked for.
 */
export function useDrawings(project: Project): DrawingsState {
  const key = keyOf(project);
  const readable = project.snapshot !== null;
  const { loaded, reload } = useLoad(
    () =>
      readable ? loadDrawings(project.id) : Promise.resolve({ ok: true, value: null } as const),
    `${key}/${readable}`,
    kept(key),
  );
  return useMemo(() => ({ ...loaded, retry: reload }), [loaded, reload]);
}

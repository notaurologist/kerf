import { type BuildStep, geometry } from '@kerf/core';
import { useEffect, useMemo } from 'react';
import { type ApiResult, api, send } from './api.ts';
import type { Project } from './types.ts';
import { type Kept, type LoadState, useLoad } from './useLoad.ts';

// A plan's drawings come in a request of their own, apart from the project: a large plan's are
// megabytes, and most screens show none of them. The last ones loaded are kept in memory, like
// the project (`projectStore`), so the plan and the modes show them at once. Each build step's
// action drawing comes in a request of its own again, when Building mode opens that step, since
// together they are most of a large plan's drawings (#635).

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

const StepResponse = geometry.Drawing.nullable();

/** One build step's action drawing, drawn by the API and parsed with core's schema. */
async function loadStepDrawing(
  id: string,
  stepId: string,
): Promise<ApiResult<geometry.Drawing | null>> {
  const result = await send(
    api.api.projects[':id'].steps[':stepId'].drawing.$get({ param: { id, stepId } }),
  );
  if (!result.ok) return result;
  const parsed = StepResponse.safeParse(result.value.drawing);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        error: {
          kind: 'failed',
          status: 200,
          message: 'The drawing the server sent could not be read.',
        },
      };
}

/** The open step's action drawing so far, and how to ask for it again. */
export type StepDrawingState = LoadState<geometry.Drawing | null> & { retry?: () => void };

/** The step drawings loaded for one plan, by step ID; another plan's are dropped. */
let steps: { key: string; drawings: Map<string, geometry.Drawing | null> } | undefined;

const stepsOf = (key: string) => {
  if (steps?.key !== key) steps = { key, drawings: new Map() };
  return steps.drawings;
};

/** A cutting step is drawn as its board, from the plan's drawings, so it has none to ask for. */
const asks = (step: BuildStep | undefined): step is BuildStep => step !== undefined && !step.board;

/**
 * The open build step's action drawing, loaded when the step opens, with the next step's loaded
 * behind it so moving on shows it at once. Null for a step that has none.
 */
export function useStepDrawing(
  project: Project,
  step: BuildStep | undefined,
  next: BuildStep | undefined,
): StepDrawingState {
  const key = keyOf(project);
  const stepId = asks(step) ? step.id : undefined;
  // A step's drawing does not change within one revision of the plan, so one loaded is not asked
  // for again.
  const { loaded, reload } = useLoad(
    () => {
      const known = stepId ? stepsOf(key).get(stepId) : null;
      if (known !== undefined || !stepId) {
        return Promise.resolve({ ok: true, value: known ?? null } as const);
      }
      return loadStepDrawing(project.id, stepId);
    },
    `${key}/${stepId ?? ''}`,
    {
      get: () => (stepId ? stepsOf(key).get(stepId) : null),
      set: (drawing) => {
        if (stepId) stepsOf(key).set(stepId, drawing);
      },
    },
  );
  const ahead = asks(next) ? next.id : undefined;
  useEffect(() => {
    if (loaded.state !== 'ready' || !ahead || stepsOf(key).has(ahead)) return;
    void loadStepDrawing(project.id, ahead).then((result) => {
      if (result.ok) stepsOf(key).set(ahead, result.value);
    });
  }, [loaded.state, ahead, key, project.id]);
  return useMemo(() => ({ ...loaded, retry: reload }), [loaded, reload]);
}

import {
  BuildSteps,
  findTemplate,
  type Plan,
  type SuggestedValue,
  withSuggested,
} from '@kerf/core';
import { useMemo } from 'react';
import type { Project } from './types.ts';

// A stored project's outputs as a Plan, parsed with its template's schema (hard rule 8). The
// mapping only picks values out of the snapshot the API returned; nothing is computed here. Core
// labels each quantity taken from a suggested value with its basis (#417).

export type PlanResult = { ok: true; plan: Plan } | { ok: false; message: string };

export function readPlan(project: Project): PlanResult {
  if (!project.snapshot) {
    return {
      ok: false,
      message: `The stored plan cannot be read: ${project.unreadable?.message ?? 'no reason given'}.`,
    };
  }
  return planOf(project.templateId, project.snapshot.outputs, project.snapshot.suggested);
}

/** Outputs from any snapshot the API returned, such as a preview's, as a Plan. */
export function planOf(
  templateId: string,
  outputs: unknown,
  suggested: readonly SuggestedValue[] = [],
): PlanResult {
  const template = findTemplate(templateId);
  if (!template) return { ok: false, message: 'This project’s template is no longer offered.' };
  const parsed = template.storedOutputs.safeParse(outputs);
  if (!parsed.success) {
    return { ok: false, message: 'The plan the server sent does not match this template’s shape.' };
  }
  return { ok: true, plan: withSuggested(template.plan(parsed.data), suggested) };
}

/**
 * The plan's build steps from the API (#52), parsed with core's schema (hard rule 8): chosen from
 * the tool inventory the key names. Null when the API sent none.
 */
export function readSteps(project: Project): BuildSteps | null {
  const parsed = BuildSteps.safeParse(project.steps);
  return parsed.success ? parsed.data : null;
}

/** The project's plan and build steps, parsed once for each response, not each render. */
export function useReadProject(project: Project) {
  return useMemo(() => ({ plan: readPlan(project), steps: readSteps(project) }), [project]);
}

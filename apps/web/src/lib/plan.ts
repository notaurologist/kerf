import { findTemplate, geometry, type Plan } from '@kerf/core';
import type { Project } from './types.ts';

// A stored project's outputs as a Plan, parsed with its template's schema (hard rule 8). The
// mapping only picks values out of the snapshot the API returned; nothing is computed here.

export type PlanResult = { ok: true; plan: Plan } | { ok: false; message: string };

export function readPlan(project: Project): PlanResult {
  if (!project.snapshot) {
    return {
      ok: false,
      message: `The stored plan cannot be read: ${project.unreadable?.message ?? 'no reason given'}.`,
    };
  }
  return planOf(project.templateId, project.snapshot.outputs);
}

/** Outputs from any snapshot the API returned, such as a preview's, as a Plan. */
export function planOf(templateId: string, outputs: unknown): PlanResult {
  const template = findTemplate(templateId);
  if (!template) return { ok: false, message: 'This project’s template is no longer offered.' };
  const parsed = template.outputs.safeParse(outputs);
  if (!parsed.success) {
    return { ok: false, message: 'The plan the server sent does not match this template’s shape.' };
  }
  return { ok: true, plan: template.plan(parsed.data) };
}

/**
 * The plan's drawings from the API (#91), parsed with core's schema (hard rule 8). Null when
 * the API sent none, as for a plan whose snapshot cannot be read.
 */
export function readDrawings(project: Project): geometry.Drawings | null {
  const parsed = geometry.Drawings.safeParse(project.drawings);
  return parsed.success ? parsed.data : null;
}

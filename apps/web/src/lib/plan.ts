import { findTemplate, type Plan } from '@kerf/core';
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
  const template = findTemplate(project.templateId);
  if (!template) return { ok: false, message: 'This project’s template is no longer offered.' };
  const parsed = template.outputs.safeParse(project.snapshot.outputs);
  if (!parsed.success) {
    return { ok: false, message: 'The plan the server sent does not match this template’s shape.' };
  }
  return { ok: true, plan: template.plan(parsed.data) };
}

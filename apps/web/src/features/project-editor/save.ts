import { fillMissing, findTemplate } from '@kerf/core';
import { api, send } from '../../lib/api.ts';
import type { Project, ProjectStatus } from '../../lib/types.ts';
import { sameJson } from '../../ui/sameJson.ts';

/** What the editor holds for an existing project, as it would be saved. */
export interface Edited {
  name: string;
  status: ProjectStatus;
  params: Record<string, unknown>;
  inputs: Record<string, unknown>;
}

/** The values the editor starts from: the stored ones, with what an older plan lacks filled. */
export function editorValues(project: Project) {
  const stored = project.snapshot;
  if (!stored) return undefined;
  const template = findTemplate(project.templateId);
  return template ? fillMissing(template, stored) : { ...stored, filled: [] };
}

/**
 * What to send for an edit: only what changed from what the editor started with, so renaming a
 * project never regenerates it (and never moves it to a newer template version without the owner
 * changing a value).
 */
export function changesFor(project: Project, edited: Edited) {
  const { name, status, params, inputs } = edited;
  const stored = editorValues(project);
  return {
    ...(name !== project.name ? { name } : {}),
    ...(status !== project.status ? { status } : {}),
    ...(stored && !sameJson(params, stored.params) ? { params } : {}),
    ...(stored && !sameJson(inputs, stored.structuralInputs) ? { structuralInputs: inputs } : {}),
  };
}

/**
 * Saves what changed against `revision`. Name and status go on their own, but parameters and
 * structural inputs each go whole when any value in them changed. So saving over another device's
 * save keeps its name or status unless this one changed it, and replaces all of its parameters or
 * structural inputs when this one changed any.
 */
export async function save(project: Project, revision: number, edited: Edited) {
  const changes = changesFor(project, edited);
  if (Object.keys(changes).length === 0) return { ok: true as const, value: project };
  return send(
    api.api.projects[':id'].$put({ param: { id: project.id }, json: { ...changes, revision } }),
  );
}

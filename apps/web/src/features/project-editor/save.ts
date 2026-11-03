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

/** Saves the changed fields against `revision`; another device's other changes stand. */
export async function save(project: Project, revision: number, edited: Edited) {
  const changes = changesFor(project, edited);
  if (Object.keys(changes).length === 0) return { ok: true as const, value: project };
  return send(
    api.api.projects[':id'].$put({ param: { id: project.id }, json: { ...changes, revision } }),
  );
}

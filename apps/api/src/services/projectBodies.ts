import { SuggestedChange } from '@kerf/core';
import { z } from 'zod';
import { PROJECT_STATUSES } from '../db/schema.ts';

// The request bodies the project routes take. Parameters and structural inputs stay unknown here:
// the template's own schemas parse them in core, so a bad value comes back as core's issues.

export const ProjectStatus = z.enum(PROJECT_STATUSES);

export const NewProject = z.object({
  name: z.string().trim().min(1).max(200),
  templateId: z.string().max(100),
  status: ProjectStatus.default('planned'),
  params: z.unknown(),
  /** Structural inputs have no defaults; an empty object leaves every check "input needed". */
  structuralInputs: z.unknown(),
  /**
   * The answers to the template's starting questions, when the project started from them. The
   * server suggests from them again to record which values are still Kerf's suggestions (#417).
   */
  answers: z.unknown().optional(),
});
export type NewProject = z.infer<typeof NewProject>;

/** What a new project's preview needs (#98): a create body without its name and status. */
export const NewProjectPreview = NewProject.pick({
  templateId: true,
  params: true,
  structuralInputs: true,
  answers: true,
});
export type NewProjectPreview = z.infer<typeof NewProjectPreview>;

const Revision = z.number().int().positive();

export const ProjectChanges = z
  .object({
    name: z.string().trim().min(1).max(200),
    status: ProjectStatus,
    params: z.unknown(),
    structuralInputs: z.unknown(),
    /** The project's revision the changes were made against. */
    revision: Revision,
  })
  .partial()
  .refine(
    (c) => [c.name, c.status, c.params, c.structuralInputs].some((v) => v !== undefined),
    'changes nothing',
  );
export type ProjectChanges = z.infer<typeof ProjectChanges>;

/** True when a save changes the plan, so it must say which revision it was made against. */
export const changesPlan = (c: ProjectChanges) =>
  c.name !== undefined || c.params !== undefined || c.structuralInputs !== undefined;

/** A save: changes to the plan name the revision they were made against (#207). */
export const ProjectSave = ProjectChanges.refine(
  (c) => !changesPlan(c) || c.revision !== undefined,
  { message: 'revision is required to change the name, parameters, or inputs', path: ['revision'] },
);

/** Suggestions confirmed or unconfirmed in the structural review, on one revision (#417). */
export const SuggestedChanges = z.object({
  revision: Revision,
  changes: z.array(SuggestedChange).min(1).max(100),
});
export type SuggestedChanges = z.infer<typeof SuggestedChanges>;

/**
 * A regeneration names what the version notice the owner was shown was worked out from: the
 * project's revision (#425), the template version, and the settings revision (#700). Each is an
 * input to the plan it stores, so a change to any of them since is refused (0018).
 */
export const ProjectRegenerate = z.object({
  revision: Revision,
  templateVersion: z.number().int().positive(),
  settingsRevision: Revision,
});
export type ProjectRegenerate = z.infer<typeof ProjectRegenerate>;

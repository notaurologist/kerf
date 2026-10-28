import { z } from 'zod';
import type { TemplateDefinition } from '../templates/definition.ts';
import type { GenerateResult, Issue } from '../templates/types.ts';
import { type Diff, diff } from './diff.ts';

// A project snapshot: the template and version that generated it, the parameters and structural
// inputs used, and every generated output, as one JSON value (ARCHITECTURE.md, Generation
// pipeline). The API stores it and parses it back with the template's schemas.

export interface ProjectSnapshot<Params = unknown, Inputs = unknown, Outputs = unknown> {
  templateId: string;
  templateVersion: number;
  params: Params;
  structuralInputs: Inputs;
  outputs: Outputs;
}

/** Same shape as a template's own issues: the top-level parameter or input name. */
function zodIssues(error: z.ZodError): Issue[] {
  return error.issues.map((issue) => ({
    code: `invalid-${issue.code}`,
    message: issue.message,
    params: issue.path.length > 0 ? [String(issue.path[0])] : [],
  }));
}

/** Generates a snapshot with the template's current version. */
export function createSnapshot(
  template: TemplateDefinition,
  params: unknown,
  structuralInputs: unknown,
): GenerateResult<ProjectSnapshot> {
  const p = template.params.safeParse(params);
  const i = template.structuralInputs.safeParse(structuralInputs);
  if (!p.success || !i.success) {
    return {
      ok: false,
      issues: [...(p.success ? [] : zodIssues(p.error)), ...(i.success ? [] : zodIssues(i.error))],
    };
  }
  const generated = template.generate(p.data, i.data);
  if (!generated.ok) return generated;
  return {
    ok: true,
    output: {
      templateId: template.id,
      templateVersion: template.version,
      params: p.data,
      structuralInputs: i.data,
      outputs: generated.output,
    },
  };
}

const Envelope = z.object({
  templateId: z.string(),
  templateVersion: z.number().int().positive(),
  params: z.unknown(),
  structuralInputs: z.unknown(),
  outputs: z.unknown(),
});

export type ReadResult =
  | { ok: true; snapshot: ProjectSnapshot }
  | { ok: false; reason: 'malformed' | 'unknown-template' | 'unreadable-version'; message: string };

/**
 * Parses a stored snapshot. Only the current version's schema exists, so a snapshot from an
 * earlier version whose shape has since changed cannot be read; the owner regenerates it.
 */
export function readSnapshot(
  templates: readonly TemplateDefinition[],
  stored: unknown,
): ReadResult {
  const envelope = Envelope.safeParse(stored);
  if (!envelope.success) {
    return { ok: false, reason: 'malformed', message: 'The stored snapshot is not a snapshot.' };
  }
  const { templateId, templateVersion } = envelope.data;
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return {
      ok: false,
      reason: 'unknown-template',
      message: `No template has the ID "${templateId}".`,
    };
  }
  const schema = z.object({
    templateId: z.literal(template.id),
    templateVersion: z.number().int().positive(),
    params: template.params,
    structuralInputs: template.structuralInputs,
    outputs: template.outputs,
  });
  const parsed = schema.safeParse(stored);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'unreadable-version',
      message: `This snapshot was generated with version ${templateVersion} of the template and cannot be read by version ${template.version}. Regenerate it to see the plan.`,
    };
  }
  return { ok: true, snapshot: parsed.data };
}

export type VersionReport =
  | { status: 'current'; version: number }
  | { status: 'ahead'; storedVersion: number; currentVersion: number }
  | {
      status: 'behind';
      storedVersion: number;
      currentVersion: number;
      /** What regenerating with the current version would change, or why it cannot. */
      regenerated: ({ ok: true } & Diff) | { ok: false; issues: Issue[] };
    };

/**
 * Compares a stored snapshot with what the template's current version produces from the same
 * parameters and inputs. Works on the stored JSON, so it reports even when the snapshot itself
 * cannot be read.
 */
export function compareWithCurrent(
  template: TemplateDefinition,
  stored: Pick<ProjectSnapshot, 'templateVersion' | 'params' | 'structuralInputs' | 'outputs'>,
): VersionReport {
  if (stored.templateVersion === template.version) {
    return { status: 'current', version: template.version };
  }
  if (stored.templateVersion > template.version) {
    return {
      status: 'ahead',
      storedVersion: stored.templateVersion,
      currentVersion: template.version,
    };
  }
  const current = createSnapshot(template, stored.params, stored.structuralInputs);
  return {
    status: 'behind',
    storedVersion: stored.templateVersion,
    currentVersion: template.version,
    regenerated: current.ok
      ? { ok: true, ...diff(stored.outputs, JSON.parse(JSON.stringify(current.output.outputs))) }
      : { ok: false, issues: current.issues },
  };
}

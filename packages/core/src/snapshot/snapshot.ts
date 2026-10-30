import { z } from 'zod';
import type { TemplateDefinition } from '../templates/definition.ts';
import type { GenerateResult, Issue } from '../templates/types.ts';
import { type Diff, diff } from './diff.ts';

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

// A project snapshot: the template and version that generated it, the shape it is stored in, the
// parameters and structural inputs used, and every generated output, as one JSON value
// (ARCHITECTURE.md, Generation pipeline). The API stores it and reads it back with the template's
// upgrades and schemas (decision 0014).

export interface ProjectSnapshot<Params = unknown, Inputs = unknown, Outputs = unknown> {
  templateId: string;
  /** The template version whose numbers this is (decision 0008). */
  templateVersion: number;
  /** The shape it is stored in (decision 0014). */
  snapshotVersion: number;
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
      snapshotVersion: template.snapshotVersion,
      params: p.data,
      structuralInputs: i.data,
      outputs: generated.output,
    },
  };
}

const Envelope = z.looseObject({
  templateId: z.string(),
  snapshotVersion: z.number().int().positive(),
});

export type ReadResult =
  | {
      ok: true;
      snapshot: ProjectSnapshot;
      /** The shape version it was stored in, when it had to be upgraded to read it. */
      upgradedFrom?: number;
    }
  | {
      ok: false;
      reason: 'malformed' | 'unknown-template' | 'newer-snapshot' | 'missing-upgrade';
      message: string;
    };

/**
 * Parses a stored snapshot, first upgrading it step by step if it was stored in an older shape
 * (decision 0014). Upgrades restructure only, so the plan keeps the numbers it was made with.
 */
export function readSnapshot(
  templates: readonly TemplateDefinition[],
  stored: unknown,
): ReadResult {
  const envelope = Envelope.safeParse(stored);
  if (!envelope.success) {
    return { ok: false, reason: 'malformed', message: 'The stored snapshot is not a snapshot.' };
  }
  const { templateId, snapshotVersion } = envelope.data;
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return {
      ok: false,
      reason: 'unknown-template',
      message: `No template has the ID "${templateId}".`,
    };
  }
  if (snapshotVersion > template.snapshotVersion) {
    return {
      ok: false,
      reason: 'newer-snapshot',
      message: `This snapshot was stored in shape ${snapshotVersion}, newer than this code reads (${template.snapshotVersion}).`,
    };
  }

  let current: Record<string, unknown> = envelope.data;
  for (let v = snapshotVersion; v < template.snapshotVersion; v++) {
    const upgrade = template.snapshotUpgrades[v];
    if (!upgrade) {
      return {
        ok: false,
        reason: 'missing-upgrade',
        message: `No upgrade from snapshot shape ${v} to ${v + 1}.`,
      };
    }
    current = { ...upgrade(current), snapshotVersion: v + 1 };
  }

  const schema = z.object({
    templateId: z.literal(template.id),
    templateVersion: z.number().int().positive(),
    snapshotVersion: z.literal(template.snapshotVersion),
    params: template.params,
    structuralInputs: template.structuralInputs,
    outputs: template.outputs,
  });
  const parsed = schema.safeParse(current);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'malformed',
      message: `The stored snapshot does not match shape ${template.snapshotVersion}.`,
    };
  }
  return {
    ok: true,
    snapshot: parsed.data,
    ...(snapshotVersion < template.snapshotVersion ? { upgradedFrom: snapshotVersion } : {}),
  };
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
 * Compares a snapshot, already read (and so in the current shape), with what the template's
 * current version produces from the same parameters and inputs. The limit matches
 * `compareSnapshots`: a plan several versions behind can differ in more than a hundred places.
 */
export function compareWithCurrent(
  template: TemplateDefinition,
  snapshot: ProjectSnapshot,
  limit = 1000,
): VersionReport {
  if (snapshot.templateVersion === template.version) {
    return { status: 'current', version: template.version };
  }
  if (snapshot.templateVersion > template.version) {
    return {
      status: 'ahead',
      storedVersion: snapshot.templateVersion,
      currentVersion: template.version,
    };
  }
  const current = createSnapshot(template, snapshot.params, snapshot.structuralInputs);
  return {
    status: 'behind',
    storedVersion: snapshot.templateVersion,
    currentVersion: template.version,
    regenerated: current.ok
      ? { ok: true, ...diff(asJson(snapshot.outputs), asJson(current.output.outputs), limit) }
      : { ok: false, issues: current.issues },
  };
}

/**
 * What a preview changes from a saved snapshot: both read through the template's `plan`, so the
 * paths are the ones every display shares (such as 'cutList[0].length' or 'checks[0].margin')
 * and the template's internal design data does not crowd out what the owner sees. Both snapshots
 * must already be read (and so in the current shape); they may come from different versions.
 */
export function compareSnapshots(
  template: TemplateDefinition,
  saved: ProjectSnapshot,
  preview: ProjectSnapshot,
  limit = 1000,
): Diff {
  // Key results repeat values the plan already holds (#119), so they are left out rather than
  // counted twice.
  const plan = (s: ProjectSnapshot) => {
    const { keyResults: _, ...rest } = template.plan(template.outputs.parse(s.outputs));
    return asJson(rest);
  };
  return diff(plan(saved), plan(preview), limit);
}

import { z } from 'zod';
import type { SnapshotUpgrade, TemplateDefinition } from '../model/definition.ts';
import { fillMissing, SuggestedValue } from '../model/suggested.ts';
import type { GenerateResult, Issue } from '../model/types.ts';
import { leaveOutDefaults } from './defaults.ts';
import { type Diff, diff } from './diff.ts';

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

// A project snapshot: the template and version that generated it, the shape it is stored in, the
// parameters and structural inputs used, which of them are Kerf's suggestions, and every generated
// output, as one JSON value
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
  /**
   * The structural inputs and confirmed parameters Kerf suggested, with their basis and whether
   * the owner confirmed them (#417). Every value not listed was entered.
   */
  suggested: SuggestedValue[];
  outputs: Outputs;
}

/**
 * The upgrade to the shape that adds `suggested`, for every template: a plan stored before it
 * holds only entered values.
 */
export const noSuggestions: SnapshotUpgrade = (snapshot) => ({ ...snapshot, suggested: [] });

/** Same shape as a template's own issues: the top-level parameter or input name. */
function zodIssues(error: z.ZodError): Issue[] {
  return error.issues.map((issue) => ({
    code: `invalid-${issue.code}`,
    message: issue.message,
    params: issue.path.length > 0 ? [String(issue.path[0])] : [],
  }));
}

/**
 * The template's output, or an issue if it throws. A throw is a combination of values the
 * template's checks missed, so it reaches the owner as an issue on the values entered, not as
 * an error from the server.
 */
function generateOrIssue(
  template: TemplateDefinition,
  params: unknown,
  structuralInputs: unknown,
): GenerateResult<unknown> {
  try {
    return template.generate(params, structuralInputs);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      issues: [
        {
          code: 'generation-error',
          message: `Kerf couldn't make a plan from these values (${reason}). Its checks missed this combination; try changing the values you entered last.`,
          params: [],
        },
      ],
    };
  }
}

/**
 * Generates a snapshot with the template's current version, as stored: its outputs leave out each
 * field still at its schema default, which reading fills back in. `suggested` is computed by the
 * caller (`suggestedFor`, `carrySuggested`); generating never depends on it.
 */
export function createSnapshot(
  template: TemplateDefinition,
  params: unknown,
  structuralInputs: unknown,
  suggested: readonly SuggestedValue[] = [],
): GenerateResult<ProjectSnapshot> {
  const p = template.params.safeParse(params);
  const i = template.structuralInputs.safeParse(structuralInputs);
  if (!p.success || !i.success) {
    return {
      ok: false,
      issues: [...(p.success ? [] : zodIssues(p.error)), ...(i.success ? [] : zodIssues(i.error))],
    };
  }
  const generated = generateOrIssue(template, p.data, i.data);
  if (!generated.ok) return generated;
  return {
    ok: true,
    output: {
      templateId: template.id,
      templateVersion: template.version,
      snapshotVersion: template.snapshotVersion,
      params: p.data,
      structuralInputs: i.data,
      suggested: [...suggested],
      outputs: leaveOutDefaults(template.outputs, generated.output),
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
 * (decision 0014). Upgrades restructure only, so the plan keeps the numbers it was made with, and
 * a parameter added since stays missing.
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
    try {
      current = { ...upgrade(current), snapshotVersion: v + 1 };
    } catch {
      return {
        ok: false,
        reason: 'malformed',
        message: `The stored snapshot could not be upgraded from shape ${v} to ${v + 1}.`,
      };
    }
  }

  const schema = z.object({
    templateId: z.literal(template.id),
    templateVersion: z.number().int().positive(),
    snapshotVersion: z.literal(template.snapshotVersion),
    params: template.storedParams,
    structuralInputs: template.structuralInputs,
    suggested: z.array(SuggestedValue),
    outputs: template.storedOutputs,
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
      /**
       * What regenerating with the current version would change, in the paths of the plan every
       * display shares, with the outputs it would store; or why it cannot.
       */
      regenerated: ({ ok: true; outputs: unknown } & Diff) | { ok: false; issues: Issue[] };
    };

/**
 * Compares a snapshot, already read (and so in the current shape), with what the template's
 * current version produces from the same parameters and inputs, with what an older plan lacks
 * filled as regenerating would. The limit matches
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
  const filled = fillMissing(template, snapshot);
  const current = createSnapshot(template, filled.params, filled.structuralInputs);
  return {
    status: 'behind',
    storedVersion: snapshot.templateVersion,
    currentVersion: template.version,
    regenerated: current.ok
      ? {
          ok: true,
          outputs: current.output.outputs,
          ...compareSnapshots(template, snapshot, current.output, limit),
        }
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
  const plan = (s: ProjectSnapshot) =>
    asJson(template.plan(template.storedOutputs.parse(s.outputs)));
  return diff(plan(saved), plan(preview), limit);
}

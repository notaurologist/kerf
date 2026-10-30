import { z } from 'zod';
import { Citation } from '../design-values/sources.ts';
import type { Inventory } from '../inventory/tools.ts';
import { FlagCategory, findExpertCheckCategory } from '../knowledge/categories.ts';
import { fillMethodText, findMethod, type Method } from '../knowledge/methods.ts';
import { SkillIdSchema } from '../knowledge/skills.ts';
import type { TemplateDefinition } from '../templates/definition.ts';
import { Operation } from '../templates/operations.ts';
import type { Flag } from '../templates/types.ts';
import {
  describeChoice,
  type MethodFit,
  meetingTool,
  type RequirementGap,
  selectMethod,
} from './select.ts';

// Build steps (#105; ARCHITECTURE.md, Generation pipeline): a template's operations, grouped and
// ordered by the template's outline, each with the method chosen from the inventory. Steps are
// made on read from the stored operations and the current inventory and knowledge base, like
// drawings, so they are not stored.

/**
 * One step as the template orders it: which operations it does, by ID, and the expert-check
 * categories the work falls in beyond what its methods raise (DOMAIN.md, Expert-check categories).
 */
export interface StepOutline {
  id: string;
  /** In the content guide's voice: a verb and the thing it acts on. */
  title: string;
  operationIds: readonly string[];
  categories: readonly FlagCategory[];
}

/** An expert check shown on a step. */
export const StepFlag = z.object({
  category: FlagCategory,
  ask: z.string(),
  why: z.string(),
  sources: z.array(Citation),
});
export type StepFlag = z.infer<typeof StepFlag>;

/** The chosen method with its text filled from the operation. */
export const FilledMethod = z.object({
  id: z.string(),
  name: z.string(),
  /** For each requirement: what it is used for and the owned tool type that meets it. */
  tools: z.array(z.object({ use: z.string(), toolTypeId: z.string() })),
  setup: z.array(z.string()),
  technique: z.array(z.string()),
  mistakes: z.array(z.string()),
  safety: z.array(z.object({ text: z.string(), sources: z.array(Citation) })),
});
export type FilledMethod = z.infer<typeof FilledMethod>;

/**
 * A requirement a method lacks, in words: what the tool is for, and each tool type that would
 * meet it, described by `describeChoice` with core's formatters.
 */
export const Gap = z.object({ use: z.string(), anyOf: z.array(z.string()).min(1) });
export type Gap = z.infer<typeof Gap>;

/** A method and what it lacks. */
export const MethodGaps = z.object({
  methodId: z.string(),
  methodName: z.string(),
  gaps: z.array(Gap),
});
export type MethodGaps = z.infer<typeof MethodGaps>;

export const StepOperation = z.object({
  operation: Operation,
  /** The parts the operation works on; empty for site work. */
  partIds: z.array(z.string()),
  method: FilledMethod.optional(),
  skills: z.array(SkillIdSchema),
  /** With no method: the method closest to supported and what it lacks. */
  needed: MethodGaps.optional(),
  /** Better methods that wait only on capabilities not entered. */
  inputNeeded: z.array(MethodGaps),
  /** Methods the tools do not support that are easier or more accurate than the chosen one. */
  suggestions: z.array(
    MethodGaps.extend({ better: z.array(z.enum(['easier', 'more accurate'])).min(1) }),
  ),
});
export type StepOperation = z.infer<typeof StepOperation>;

export const BuildStep = z.object({
  id: z.string(),
  title: z.string(),
  operations: z.array(StepOperation),
  /** Every part the step uses, in order of first use. */
  partIds: z.array(z.string()),
  flags: z.array(StepFlag),
});
export type BuildStep = z.infer<typeof BuildStep>;

function partIdsOf(op: Operation): string[] {
  if ('partId' in op) return [op.partId];
  if ('partIds' in op) return [...op.partIds];
  return [];
}

function fill(method: Method, op: Operation, inventory: Inventory): FilledMethod {
  return {
    id: method.id,
    name: method.name,
    tools: method.tools.map((r) => ({
      use: r.use,
      toolTypeId: meetingTool(r, op, inventory) ?? '',
    })),
    setup: method.setup.map((t) => fillMethodText(t, op)),
    technique: method.technique.map((t) => fillMethodText(t, op)),
    mistakes: method.mistakes.map((t) => fillMethodText(t, op)),
    safety: method.safety.map((s) => ({ text: fillMethodText(s.text, op), sources: s.sources })),
  };
}

const inWords = (gaps: RequirementGap[]): Gap[] =>
  gaps.map((g) => ({ use: g.use, anyOf: g.anyOf.map(describeChoice) }));

function methodGaps(methodId: string, gaps: RequirementGap[]): MethodGaps {
  return { methodId, methodName: findMethod(methodId)?.name ?? methodId, gaps: inWords(gaps) };
}

const gapsOf = (f: MethodFit) => methodGaps(f.method.id, f.gaps);

function stepOperation(op: Operation, inventory: Inventory): [StepOperation, Method | undefined] {
  const selection = selectMethod(op, inventory);
  const { chosen } = selection;
  return [
    {
      operation: op,
      partIds: partIdsOf(op),
      ...(chosen ? { method: fill(chosen, op, inventory) } : {}),
      skills: chosen ? [...chosen.skills] : [],
      ...(selection.needed ? { needed: gapsOf(selection.needed) } : {}),
      inputNeeded: selection.inputNeeded.map(gapsOf),
      suggestions: selection.suggestions.map((x) => ({
        ...methodGaps(x.methodId, x.gaps),
        better: x.better,
      })),
    },
    chosen ?? selection.needed?.method,
  ];
}

/**
 * The step a plan flag is shown on (#51): the first that drills for hardware it names, or else
 * the first that works on a part it names, so it is asked before the work it concerns. A flag
 * that names neither, or was stored before flags named them, stays on the plan only.
 */
function stepForFlag(flag: Flag, steps: readonly { operations: StepOperation[] }[]): number {
  const hardware = flag.hardwareIds ?? [];
  const parts = flag.partIds ?? [];
  const drills = steps.findIndex((s) =>
    s.operations.some(
      (o) => 'hardwareId' in o.operation && hardware.includes(o.operation.hardwareId),
    ),
  );
  if (drills >= 0) return drills;
  return steps.findIndex((s) =>
    s.operations.some((o) => o.partIds.some((id) => parts.includes(id))),
  );
}

/**
 * The build steps for a plan's operations, in the outline's order. Every operation must be in
 * exactly one step: an operation left out, listed twice, or not in the plan is a template bug.
 * Each of the plan's flags is shown on one step (`stepForFlag`).
 */
export function buildSteps(
  outline: readonly StepOutline[],
  operations: readonly Operation[],
  inventory: Inventory,
  planFlags: readonly Flag[],
): BuildStep[] {
  const byId = new Map(operations.map((op) => [op.id, op]));
  const placed = outline.flatMap((s) => s.operationIds);
  const missing = operations.filter((op) => !placed.includes(op.id)).map((op) => op.id);
  const unknown = placed.filter((id) => !byId.has(id));
  const twice = placed.filter((id, i) => placed.indexOf(id) !== i);
  if (missing.length + unknown.length + twice.length > 0) {
    throw new Error(
      `step outline does not match the operations: missing [${missing}], unknown [${unknown}], twice [${twice}]`,
    );
  }
  const done = outline.map((s) =>
    s.operationIds.map((id) => stepOperation(byId.get(id) as Operation, inventory)),
  );
  const onStep = done.map((): StepFlag[] => []);
  const operationsOf = done.map((d) => ({ operations: d.map(([op]) => op) }));
  for (const flag of planFlags) {
    const i = stepForFlag(flag, operationsOf);
    if (i >= 0)
      onStep[i]?.push({ category: flag.category, ask: flag.ask, why: flag.why, sources: [] });
  }
  return outline.map((s, i) => {
    const ops = done[i] ?? [];
    const flags: StepFlag[] = [
      ...ops.flatMap(([, method]) => method?.flags ?? []),
      ...(onStep[i] ?? []),
      ...s.categories.map((id) => {
        const { ask, why, sources } = findExpertCheckCategory(id);
        return { category: id, ask, why, sources: [...sources] };
      }),
    ];
    const seen = new Set<string>();
    return {
      id: s.id,
      title: s.title,
      operations: ops.map(([op]) => op),
      partIds: [...new Set(ops.flatMap(([op]) => op.partIds))],
      flags: flags.filter((f) => {
        const key = `${f.category}\n${f.ask}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    };
  });
}

/**
 * A short key for the tools an inventory has and their capabilities, in any order, so a step list
 * can say which inventory it was chosen from and a client can tell when it is stale (#52). Tools
 * outside the library are left out: methods ignore them. FNV-1a over a canonical JSON form.
 */
export function inventoryKey(inventory: Inventory): string {
  const canonical = JSON.stringify(
    [...inventory.tools]
      .sort((a, b) => a.toolTypeId.localeCompare(b.toolTypeId))
      .map((t) => [
        t.toolTypeId,
        Object.entries(t.capabilities).sort(([a], [b]) => a.localeCompare(b)),
      ]),
  );
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** A plan's build steps and the inventory they were chosen from. */
export const BuildSteps = z.object({
  inventoryKey: z.string(),
  steps: z.array(BuildStep),
});
export type BuildSteps = z.infer<typeof BuildSteps>;

/** The build steps for a template's stored outputs and an inventory. */
export function planSteps<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'steps' | 'plan'>,
  outputs: O,
  inventory: Inventory,
): BuildSteps {
  const plan = template.plan(outputs);
  return {
    inventoryKey: inventoryKey(inventory),
    steps: buildSteps(template.steps(outputs), plan.operations, inventory, plan.flags),
  };
}

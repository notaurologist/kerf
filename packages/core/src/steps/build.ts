import type { Citation } from '../design-values/sources.ts';
import type { Inventory } from '../inventory/tools.ts';
import { type FlagCategory, findExpertCheckCategory } from '../knowledge/categories.ts';
import { fillMethodText, type Method } from '../knowledge/methods.ts';
import type { SkillId } from '../knowledge/skills.ts';
import type { Operation } from '../templates/operations.ts';
import {
  type MethodFit,
  meetingTool,
  type RequirementGap,
  selectMethod,
  type ToolSuggestion,
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
export interface StepFlag {
  category: FlagCategory;
  ask: string;
  why: string;
  sources: Citation[];
}

/** The chosen method with its text filled from the operation. */
export interface FilledMethod {
  id: string;
  name: string;
  /** For each requirement: what it is used for and the owned tool type that meets it. */
  tools: { use: string; toolTypeId: string }[];
  setup: string[];
  technique: string[];
  mistakes: string[];
  safety: { text: string; sources: Citation[] }[];
}

export interface StepOperation {
  operation: Operation;
  /** The parts the operation works on; empty for site work. */
  partIds: string[];
  method?: FilledMethod;
  skills: SkillId[];
  /** With no method: the method closest to supported and what it lacks. */
  needed?: { methodId: string; gaps: RequirementGap[] };
  /** Better methods that wait only on capabilities not entered. */
  inputNeeded: { methodId: string; gaps: RequirementGap[] }[];
  suggestions: ToolSuggestion[];
}

export interface BuildStep {
  id: string;
  title: string;
  operations: StepOperation[];
  /** Every part the step uses, in order of first use. */
  partIds: string[];
  flags: StepFlag[];
}

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

const gapsOf = (f: MethodFit) => ({ methodId: f.method.id, gaps: f.gaps });

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
      suggestions: selection.suggestions,
    },
    chosen ?? selection.needed?.method,
  ];
}

/**
 * The build steps for a plan's operations, in the outline's order. Every operation must be in
 * exactly one step: an operation left out, listed twice, or not in the plan is a template bug.
 */
export function buildSteps(
  outline: readonly StepOutline[],
  operations: readonly Operation[],
  inventory: Inventory,
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
  return outline.map((s) => {
    const done = s.operationIds.map((id) => stepOperation(byId.get(id) as Operation, inventory));
    const flags: StepFlag[] = [
      ...done.flatMap(([, method]) => method?.flags ?? []),
      ...s.categories.map((id) => {
        const { ask, why, sources } = findExpertCheckCategory(id);
        return { category: id, ask, why, sources: [...sources] };
      }),
    ];
    const seen = new Set<string>();
    return {
      id: s.id,
      title: s.title,
      operations: done.map(([op]) => op),
      partIds: [...new Set(done.flatMap(([op]) => op.partIds))],
      flags: flags.filter((f) => {
        const key = `${f.category}\n${f.ask}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    };
  });
}

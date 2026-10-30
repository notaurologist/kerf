import type { Inventory } from '../inventory/tools.ts';
import {
  METHOD_VALUES,
  type Method,
  methodsFor,
  type ToolRequirement,
} from '../knowledge/methods.ts';
import { findToolType } from '../knowledge/tools.ts';
import type { Operation, OperationType } from '../templates/operations.ts';
import { formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';

// Method selection (ARCHITECTURE.md, Method selection): for one operation and an inventory, which
// methods the tools support, which one to use, what would allow one when none fits, and which
// tools would allow an easier or more accurate method. Generic: it reads only the operation, the
// knowledge base, and the inventory.

/** A capability a tool choice needs, with the value it must reach for this operation. */
export interface CapabilityShort {
  capability: string;
  /** The operation's value divided by the passes: the least the capability must be. */
  atLeast: number;
  /** What the owner entered, or undefined when it is not entered (input needed). */
  entered?: number;
}

/** One tool type that would meet a requirement, and what it lacks in this inventory. */
export interface ChoiceGap {
  toolTypeId: string;
  /** False when the inventory has no tool of this type. */
  owned: boolean;
  /** Capabilities below what the operation needs, or not entered. Empty when only not owned. */
  short: CapabilityShort[];
}

/** A requirement the inventory does not meet, with each tool type that would meet it. */
export interface RequirementGap {
  use: string;
  anyOf: ChoiceGap[];
}

export interface MethodFit {
  method: Method;
  /** Requirements not met. Empty when the inventory supports the method. */
  gaps: RequirementGap[];
}

/** Whether every gap is an owned tool whose only shortfall is a capability not entered. */
export function onlyInputNeeded(fit: MethodFit): boolean {
  return (
    fit.gaps.length > 0 &&
    fit.gaps.every((g) =>
      g.anyOf.some(
        (c) => c.owned && c.short.length > 0 && c.short.every((s) => s.entered === undefined),
      ),
    )
  );
}

/**
 * A tool choice in words, with each number from core's formatters: "Circular saw", or "Circular
 * saw with depth of cut with the blade square at least 1-3/4" (you entered 1-1/2")". What the
 * owner entered is shown only for a tool they have.
 */
export function describeChoice(choice: ChoiceGap): string {
  const type = findToolType(choice.toolTypeId);
  if (!type) throw new Error(`${choice.toolTypeId} is not in the tool library`);
  const shorts = choice.short.map((s) => {
    const field = type.capabilities.find((c) => c.id === s.capability);
    if (!field) throw new Error(`${type.id} has no capability ${s.capability}`);
    const show = (n: number) => (field.kind === 'angle' ? formatAngle(n) : formatLength(n));
    const need = `${field.label.toLowerCase()} at least ${show(s.atLeast)}`;
    if (!choice.owned) return need;
    return `${need} (${s.entered === undefined ? 'not entered' : `you entered ${show(s.entered)}`})`;
  });
  return shorts.length === 0 ? type.name : `${type.name} with ${shorts.join(' and ')}`;
}

function operationValue(op: Operation, name: string): number {
  const values = METHOD_VALUES[op.type] as Record<string, { of: (op: never) => number }>;
  const value = values[name];
  if (!value) throw new Error(`${op.type} has no value ${name}`);
  return value.of(op as never);
}

function requirementChoices(
  requirement: ToolRequirement,
  op: Operation,
  inventory: Inventory,
): ChoiceGap[] {
  return requirement.anyOf.map((choice) => {
    const tool = inventory.tools.find((t) => t.toolTypeId === choice.tool);
    const short: CapabilityShort[] = [];
    for (const need of choice.needs) {
      const atLeast = operationValue(op, need.atLeast) / need.passes;
      const entered = tool?.capabilities[need.capability];
      if (typeof entered === 'number' && entered >= atLeast) continue;
      short.push({
        capability: need.capability,
        atLeast,
        ...(typeof entered === 'number' ? { entered } : {}),
      });
    }
    return { toolTypeId: choice.tool, owned: tool !== undefined, short };
  });
}

const meets = (c: ChoiceGap) => c.owned && c.short.length === 0;

/** The first tool type in the inventory that meets a requirement, if any. */
export function meetingTool(
  requirement: ToolRequirement,
  op: Operation,
  inventory: Inventory,
): string | undefined {
  return requirementChoices(requirement, op, inventory).find(meets)?.toolTypeId;
}

/** How well the inventory supports one method for one operation. */
export function fitMethod(method: Method, op: Operation, inventory: Inventory): MethodFit {
  const gaps: RequirementGap[] = [];
  for (const requirement of method.tools) {
    const choices = requirementChoices(requirement, op, inventory);
    if (!choices.some(meets)) gaps.push({ use: requirement.use, anyOf: choices });
  }
  return { method, gaps };
}

/** Every method for the operation's type, in preference order, with how well each fits. */
export function fitMethods(op: Operation, inventory: Inventory): MethodFit[] {
  return methodsFor(op.type as OperationType).map((m) => fitMethod(m, op, inventory));
}

/** A tool type that would allow a method the inventory does not support, and why to want it. */
export interface ToolSuggestion {
  methodId: string;
  /** What the method is better at than the one chosen. */
  better: ('easier' | 'more accurate')[];
  gaps: RequirementGap[];
}

export interface Selection {
  /** The first method in preference order the inventory supports, if any. */
  chosen?: Method;
  /**
   * With no method chosen: the gaps of the method closest to supported (fewest requirements
   * missing, then preference order), naming the tools that would allow it.
   */
  needed?: MethodFit;
  /** Methods preferred over the chosen one (or all, with none chosen) that wait only on input. */
  inputNeeded: MethodFit[];
  /** Methods the inventory does not support that are easier or more accurate than the chosen. */
  suggestions: ToolSuggestion[];
}

export function selectMethod(op: Operation, inventory: Inventory): Selection {
  const fits = fitMethods(op, inventory);
  const index = fits.findIndex((f) => f.gaps.length === 0);
  const chosen = index >= 0 ? fits[index]?.method : undefined;
  if (!chosen) {
    const needed = fits.reduce((best, f) => (f.gaps.length < best.gaps.length ? f : best));
    return { needed, inputNeeded: fits.filter(onlyInputNeeded), suggestions: [] };
  }
  const betterThanChosen = (f: MethodFit): ToolSuggestion['better'] => [
    ...(f.method.easierThan.includes(chosen.id) ? (['easier'] as const) : []),
    ...(f.method.moreAccurateThan.includes(chosen.id) ? (['more accurate'] as const) : []),
  ];
  const inputNeeded = fits.filter(
    (f, i) => onlyInputNeeded(f) && (i < index || betterThanChosen(f).length > 0),
  );
  const suggestions = fits.flatMap((f): ToolSuggestion[] => {
    if (f.gaps.length === 0 || onlyInputNeeded(f)) return [];
    const better = betterThanChosen(f);
    return better.length > 0 ? [{ methodId: f.method.id, better, gaps: f.gaps }] : [];
  });
  return { chosen, inputNeeded, suggestions };
}

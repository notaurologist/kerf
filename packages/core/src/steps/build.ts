import { z } from 'zod';
import { Citation } from '../design-values/sources.ts';
import type { Inventory } from '../inventory/tools.ts';
import { FlagCategory, findExpertCheckCategory } from '../knowledge/categories.ts';
import { fillMethodText, findMethod, type Method } from '../knowledge/methods.ts';
import { SkillIdSchema } from '../knowledge/skills.ts';
import type { Plan } from '../outputs/plan.ts';
import { PlannedBoard } from '../outputs/shoppingList.ts';
import type { TemplateDefinition } from '../templates/definition.ts';
import { CUTTING_OPERATION_TYPES, Operation } from '../templates/operations.ts';
import type { Flag } from '../templates/types.ts';
import {
  describeChoice,
  type MethodFit,
  meetingTool,
  type RequirementGap,
  selectMethod,
} from './select.ts';

// Build steps (#105; ARCHITECTURE.md, Generation pipeline): a plan's operations in steps, each
// with the method chosen from the inventory. Cutting goes board by board, in the board plan's
// order (#58); the template's outline orders the rest, which follows. Steps are made on read from
// the stored plan and the current inventory and knowledge base, like drawings, so they are not
// stored.

/**
 * One step as the template orders it: which operations it does, by ID, and the expert-check
 * categories the work falls in beyond what its methods raise (DOMAIN.md, Expert-check categories).
 * Cutting operations (`CUTTING_OPERATION_TYPES`) are not in the outline: the board steps do them.
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

/** A piece on a board, in the order it comes off (#58). */
export const BoardPiece = z.object({
  partId: z.string(),
  /** Which of the part's pieces this is, from 0, counted through the boards in order. */
  instance: z.number().int().nonnegative(),
  length: z.number(),
  /** The cutting operations on the piece's part, done to it before the next piece. */
  operationIds: z.array(z.string()),
});
export type BoardPiece = z.infer<typeof BoardPiece>;

/** The board a cutting step breaks down, with the trim and kerf it was planned with. */
export const StepBoard = z.object({
  /** From 1, in the board plan's order. */
  number: z.number().int().positive(),
  nominal: PlannedBoard.shape.nominal,
  feet: z.number(),
  trimPerEnd: z.number(),
  kerf: z.number(),
  offcut: z.number(),
  pieces: z.array(BoardPiece),
});
export type StepBoard = z.infer<typeof StepBoard>;

export const BuildStep = z.object({
  id: z.string(),
  title: z.string(),
  /** For a cutting step: the board and its pieces. */
  board: StepBoard.optional(),
  /**
   * In a cutting step, the cutting operations on its pieces' parts, each with its count for this
   * board. A part whose pieces are on two boards has its operations in both steps.
   */
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

const isCutting = (op: Operation): op is Extract<Operation, { partId: string }> =>
  CUTTING_OPERATION_TYPES.includes(op.type) && 'partId' in op;

interface Draft extends StepOutline {
  board?: StepBoard;
  /** In a cutting step, how many times each operation is done on this board's pieces. */
  counts?: ReadonlyMap<string, number>;
}

/**
 * One cutting step per board, in the board plan's order (#58), each listing its pieces as they
 * come off it. An operation is done on a board's pieces its share of times: an end cut done twice
 * for a part with two pieces is done once on a board that holds one of them. A cutting operation
 * whose part is on no board, because no buyable board holds it (the board plan's issues), gets a
 * step of its own after them, so no cut is left out.
 */
function boardSteps(plan: Pick<Plan, 'operations' | 'lumber'>): Draft[] {
  const cuts = plan.operations.filter(isCutting);
  if (cuts.length === 0) return [];
  const cutsOf = (partId: string) => cuts.filter((op) => op.partId === partId).map((op) => op.id);
  const { boards, trimPerEnd, kerf } = plan.lumber;
  const total = new Map<string, number>();
  for (const piece of boards.flatMap((b) => b.pieces)) {
    total.set(piece.partId, (total.get(piece.partId) ?? 0) + 1);
  }
  const share = (op: (typeof cuts)[number], onBoard: number) => {
    const pieces = total.get(op.partId) ?? 1;
    return op.count % pieces === 0 ? (op.count / pieces) * onBoard : op.count;
  };
  const counted = new Map<string, number>();
  const steps: Draft[] = boards.map((board, i) => {
    const pieces = board.pieces.map((piece) => {
      const instance = counted.get(piece.partId) ?? 0;
      counted.set(piece.partId, instance + 1);
      return {
        partId: piece.partId,
        instance,
        length: piece.length,
        operationIds: cutsOf(piece.partId),
      };
    });
    const counts = new Map<string, number>();
    for (const op of cuts) {
      const onBoard = pieces.filter((p) => p.partId === op.partId).length;
      if (onBoard > 0) counts.set(op.id, share(op, onBoard));
    }
    return {
      id: `board-${i + 1}`,
      counts,
      title: `Cut board ${i + 1}, a ${board.nominal} ${board.feet}' long`,
      operationIds: [...new Set(pieces.flatMap((p) => p.operationIds))],
      categories: [],
      board: {
        number: i + 1,
        nominal: board.nominal,
        feet: board.feet,
        trimPerEnd,
        kerf,
        offcut: board.offcut,
        pieces,
      },
    };
  });
  const unplanned = cuts.filter((op) => !counted.has(op.partId)).map((op) => op.id);
  if (unplanned.length > 0) {
    steps.push({
      id: 'cut-unplanned',
      title: 'Cut the parts no board in the plan holds',
      operationIds: unplanned,
      categories: [],
    });
  }
  return steps;
}

/**
 * The build steps for a plan: cutting board by board (`boardSteps`), then the template's outline.
 * The outline must hold every other operation exactly once: an operation left out, listed twice,
 * not in the plan, or a cutting operation is a template bug. Each of the plan's flags is shown on
 * one step (`stepForFlag`).
 */
export function buildSteps(
  outline: readonly StepOutline[],
  plan: Pick<Plan, 'operations' | 'flags' | 'lumber'>,
  inventory: Inventory,
): BuildStep[] {
  const { operations } = plan;
  if (operations.length === 0) return [];
  const byId = new Map(operations.map((op) => [op.id, op]));
  const assembly = operations.filter((op) => !isCutting(op));
  const placed = outline.flatMap((s) => s.operationIds);
  const missing = assembly.filter((op) => !placed.includes(op.id)).map((op) => op.id);
  const unknown = placed.filter((id) => !assembly.some((op) => op.id === id));
  const twice = placed.filter((id, i) => placed.indexOf(id) !== i);
  if (missing.length + unknown.length + twice.length > 0) {
    throw new Error(
      `step outline does not match the operations: missing [${missing}], unknown or cutting [${unknown}], twice [${twice}]`,
    );
  }
  const drafts: Draft[] = [...boardSteps(plan), ...outline];
  const done = drafts.map((s) =>
    s.operationIds.map((id) => {
      const op = byId.get(id) as Operation;
      const count = s.counts?.get(id);
      return stepOperation(count === undefined ? op : { ...op, count }, inventory);
    }),
  );
  const onStep = done.map((): StepFlag[] => []);
  const operationsOf = done.map((d) => ({ operations: d.map(([op]) => op) }));
  for (const flag of plan.flags) {
    const i = stepForFlag(flag, operationsOf);
    if (i >= 0)
      onStep[i]?.push({ category: flag.category, ask: flag.ask, why: flag.why, sources: [] });
  }
  return drafts.map((s, i) => {
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
      ...(s.board ? { board: s.board } : {}),
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
  return {
    inventoryKey: inventoryKey(inventory),
    steps: buildSteps(template.steps(outputs), template.plan(outputs), inventory),
  };
}

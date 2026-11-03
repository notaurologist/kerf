import { z } from 'zod';
import type { TemplateDefinition } from '../model/definition.ts';
import type { Plan } from '../outputs/plan.ts';
import { boardIds } from '../outputs/shoppingList.ts';
import { type StepContent, stepContents } from '../steps/build.ts';
import { formatBoardLength, formatLength, formatLimit, toSixteenths } from '../units/length.ts';
import {
  checklistProgressKey,
  flagProgressKey,
  hardwareProgressKey,
  lumberProgressKey,
  type ProgressKind,
  type ProgressReset,
  partProgressKey,
} from './progress.ts';

// What a change made mid-build undid (#444). A regeneration clears the ticks whose item is gone
// or has other numbers (`progressToReset`), but the work behind a tick is still done: a leg cut at
// one length, a beam already bought. So each cleared tick is recorded with what it was done
// against, read from the plan before the change, and the record stays until the owner dismisses
// it. Each time it is shown, it is compared with the current plan, so its note says what the work
// now needs even after further changes: a piece cut short needs a new board, a piece cut long can
// be cut down, and a bought line the plan now needs more of needs only the difference. Bolts bought
// for a line the plan no longer has are compared with the lengths that fit the bolts that replace
// them (#514).

const ResetReason = z.enum(['removed', 'changed']);

/** A cleared tick and what its item was when the owner ticked it. */
export const ResetRecord = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('part'),
    key: z.string(),
    reason: ResetReason,
    was: z.object({
      letter: z.string(),
      name: z.string(),
      instance: z.number().int().nonnegative(),
      /** The piece's exact length on its board, or null when no board held it. */
      length: z.number().nullable(),
    }),
  }),
  z.object({
    kind: z.literal('shopping-line'),
    key: z.string(),
    reason: ResetReason,
    was: z.union([
      z.object({ nominal: z.string(), feet: z.number(), count: z.number().int() }),
      z.object({
        description: z.string(),
        quantity: z.number().int().optional(),
        /** A bolt line's bolt as bought, and the items it was bought for (`HardwareLine.bolt`). */
        bolt: z
          .object({ diameter: z.number(), length: z.number(), items: z.array(z.string()) })
          .optional(),
      }),
    ]),
  }),
  z.object({
    kind: z.literal('board'),
    key: z.string(),
    reason: ResetReason,
    was: z.object({ number: z.number().int().positive(), nominal: z.string(), feet: z.number() }),
  }),
  z.object({
    kind: z.literal('step'),
    key: z.string(),
    reason: ResetReason,
    was: z.object({ number: z.number().int().positive(), title: z.string() }),
  }),
  z.object({
    kind: z.literal('flag'),
    key: z.string(),
    reason: ResetReason,
    was: z.object({ ask: z.string() }),
  }),
  z.object({
    kind: z.literal('checklist-item'),
    key: z.string(),
    reason: ResetReason,
    was: z.object({ element: z.string() }),
  }),
]);
export type ResetRecord = z.infer<typeof ResetRecord>;

/** A board to buy for a piece cut shorter than the plan now needs. */
export interface Replacement {
  nominal: string;
  feet: number;
  /** The piece it replaces, as the note names it: "C Front leg, piece 1". */
  piece: string;
}

/** A cleared tick as the owner reads it, against the current plan. */
export interface ResetNote {
  kind: ProgressKind;
  key: string;
  /** What was done, named as the plan names it: "C Front leg, piece 1". */
  item: string;
  /** What it was done to and what the plan has now: `cut at 147-5/8", now 149-7/16"`. */
  change: string;
  /** What to do about it, when there is something to do. */
  action?: string;
  /** The build steps in the current plan the note concerns, by ID. */
  stepIds: string[];
  replacement?: Replacement;
}

/** A plan read the way the records and notes need it. */
interface PlanView {
  plan: Pick<Plan, 'cutList' | 'lumber' | 'hardware' | 'flags' | 'checklist'>;
  steps: readonly StepContent[];
}

function viewOf<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'steps' | 'plan'>,
  outputs: O,
): PlanView {
  const plan = template.plan(outputs);
  return { plan, steps: stepContents(template.steps(outputs), plan) };
}

/** Each part's pieces on the boards, in order, with the board holding each. */
function piecesOf(plan: PlanView['plan']) {
  const pieces = new Map<string, { length: number; nominal: string; feet: number }[]>();
  for (const board of plan.lumber.boards) {
    for (const piece of board.pieces) {
      const list = pieces.get(piece.partId) ?? [];
      list.push({ length: piece.length, nominal: board.nominal, feet: board.feet });
      pieces.set(piece.partId, list);
    }
  }
  return pieces;
}

const lumberName = (line: { nominal: string; feet: number }) =>
  `${line.nominal} × ${formatBoardLength(line.feet)}`;

/**
 * The records for the ticks a regeneration clears (`progressToReset`), each with what its item was
 * in the plan before the change. A tick on an item the old plan lacked has nothing to record.
 */
export function recordResets<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'steps' | 'plan'>,
  before: O,
  reset: readonly ProgressReset[],
): ResetRecord[] {
  const { plan, steps } = viewOf(template, before);
  const pieces = piecesOf(plan);
  const ids = boardIds(plan.lumber.boards);
  return reset.flatMap(({ kind, key, reason }): ResetRecord[] => {
    switch (kind) {
      case 'part': {
        const [partId, n] = splitPartKey(key);
        const row = plan.cutList.find((r) => r.partId === partId);
        if (!row || n === undefined) return [];
        const was = {
          letter: row.letter,
          name: row.name,
          instance: n,
          length: pieces.get(partId)?.[n]?.length ?? null,
        };
        return [{ kind, key, reason, was }];
      }
      case 'shopping-line': {
        const lumber = plan.lumber.lines.find((l) => lumberProgressKey(l) === key);
        if (lumber) {
          const was = { nominal: lumber.nominal, feet: lumber.feet, count: lumber.count };
          return [{ kind, key, reason, was }];
        }
        const hardware = plan.hardware.find((l) => hardwareProgressKey(l.description) === key);
        if (!hardware) return [];
        const bolt = hardware.bolt;
        const was = {
          description: hardware.description,
          ...(hardware.quantity === undefined ? {} : { quantity: hardware.quantity }),
          ...(bolt?.length === undefined
            ? {}
            : { bolt: { diameter: bolt.diameter, length: bolt.length, items: bolt.items } }),
        };
        return [{ kind, key, reason, was }];
      }
      case 'board': {
        const i = ids.indexOf(key);
        const board = plan.lumber.boards[i];
        if (!board) return [];
        return [
          { kind, key, reason, was: { number: i + 1, nominal: board.nominal, feet: board.feet } },
        ];
      }
      case 'step': {
        const i = steps.findIndex((s) => s.id === key);
        const step = steps[i];
        if (!step) return [];
        return [{ kind, key, reason, was: { number: i + 1, title: step.title } }];
      }
      case 'flag': {
        const flag = plan.flags.find((f) => flagProgressKey(f) === key);
        return flag ? [{ kind, key, reason, was: { ask: flag.ask } }] : [];
      }
      default: {
        const item = plan.checklist.find((c) => checklistProgressKey(c) === key);
        return item ? [{ kind, key, reason, was: { element: item.element } }] : [];
      }
    }
  });
}

/** A part's piece key split into its part ID and instance (`partProgressKey`). */
function splitPartKey(key: string): [string, number | undefined] {
  const at = key.lastIndexOf('/');
  const n = Number(key.slice(at + 1));
  return [key.slice(0, at), at > 0 && Number.isInteger(n) && n >= 0 ? n : undefined];
}

/**
 * Each record as a note against the current plan, in the records' order. Every number in a note
 * comes from the records or the plan, through core's formatters.
 */
export function resetNotes<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'steps' | 'plan'>,
  outputs: O,
  records: readonly ResetRecord[],
): ResetNote[] {
  const view = viewOf(template, outputs);
  return records.map((record) => noteFor(view, record));
}

function noteFor(view: PlanView, record: ResetRecord): ResetNote {
  const { plan, steps } = view;
  const base = { kind: record.kind, key: record.key };
  switch (record.kind) {
    case 'part':
      return partNote(view, record);
    case 'shopping-line': {
      const { was } = record;
      if ('nominal' in was) {
        const item = lumberName(was);
        const now = plan.lumber.lines.find((l) => l.nominal === was.nominal && l.feet === was.feet);
        return { ...base, item, stepIds: [], ...bought(was.count, now?.count) };
      }
      const now = plan.hardware.find((l) => l.description === was.description);
      const replaced = now || !was.bolt ? undefined : boltsNow(plan, was, was.bolt);
      if (replaced) return { ...base, item: was.description, stepIds: [], ...replaced };
      return {
        ...base,
        item: was.description,
        stepIds: [],
        ...(was.quantity === undefined
          ? { change: now ? 'bought; the number to buy changed' : 'bought; no longer in the plan' }
          : bought(was.quantity, now ? (now.quantity ?? null) : undefined)),
      };
    }
    case 'board': {
      const { was } = record;
      const item = `Board ${was.number}, ${lumberName(was)}`;
      const step = steps.find((s) => s.board?.id === record.key);
      if (!step)
        return { ...base, item, change: 'marked done; no longer in the plan', stepIds: [] };
      return {
        ...base,
        item,
        change: 'marked done; its pieces changed',
        action: 'Check each piece against the new lengths before cutting more.',
        stepIds: [step.id],
      };
    }
    case 'step': {
      const { was } = record;
      const i = steps.findIndex((s) => s.id === record.key);
      const step = steps[i];
      if (!step) {
        return {
          ...base,
          item: `Step ${was.number}, ${was.title}`,
          change: 'marked done; no longer in the plan',
          stepIds: [],
        };
      }
      return {
        ...base,
        item: `Step ${i + 1}, ${step.title}`,
        change: 'marked done; its numbers changed',
        action: 'Check the work against the step as it is now.',
        stepIds: [step.id],
      };
    }
    case 'flag': {
      const still = plan.flags.some((f) => flagProgressKey(f) === record.key);
      return {
        ...base,
        item: `Expert check: ${record.was.ask}`,
        change: still ? 'asked; its details changed' : 'asked; the plan no longer asks this',
        action: 'Ask again about the numbers in the structural review.',
        stepIds: [],
      };
    }
    case 'checklist-item': {
      const still = plan.checklist.some((c) => checklistProgressKey(c) === record.key);
      return {
        ...base,
        item: record.was.element,
        change: still ? 'confirmed; its details changed' : 'confirmed; no longer in the plan',
        ...(still ? { action: 'Confirm it again in the structural review.' } : {}),
        stepIds: [],
      };
    }
  }
}

/**
 * A bought line against what the plan now needs of it: undefined when the plan no longer has it,
 * null when its quantity waits for an input.
 */
function bought(
  had: number,
  needs: number | null | undefined,
): Pick<ResetNote, 'change' | 'action'> {
  const was = `bought ${had}`;
  if (needs === undefined) return { change: `${was}; no longer in the plan` };
  if (needs === null) return { change: `${was}; the number to buy waits for an input` };
  const change = `${was}, now ${needs}`;
  if (needs > had) return { change, action: `Buy ${needs - had} more.` };
  if (needs < had) return { change, action: `${had - needs} left over.` };
  return { change };
}

/**
 * Bolts bought for a line the plan no longer has, against the lines that now hold the bolts they
 * were bought for: whether a bolt of that diameter and length fits each one's grip. Undefined when
 * the plan no longer has those bolts.
 */
function boltsNow(
  plan: PlanView['plan'],
  was: { quantity?: number },
  bolt: { diameter: number; length: number; items: string[] },
): Pick<ResetNote, 'change' | 'action'> | undefined {
  const lines = plan.hardware.filter((l) => l.bolt?.items.some((id) => bolt.items.includes(id)));
  if (lines.length === 0) return undefined;
  const had = was.quantity === undefined ? 'bought' : `bought ${was.quantity}`;
  const change = `${had}; now ${lines.map((l) => l.description).join(' and ')}`;
  const actions = lines.flatMap((line) => {
    const now = line.bolt;
    if (!now) return [];
    if (now.diameter !== bolt.diameter) {
      return [
        `The bolts bought are ${formatLength(bolt.diameter)}; the plan now takes ${formatLength(now.diameter)}.`,
      ];
    }
    if (!now.fits) return [];
    const { min, max } = now.fits;
    const range = `any length from ${formatLimit(min, 'min')} to ${formatLimit(max, 'max')} fits`;
    const grip = `grip ${formatLength(now.grip)}`;
    const bought = `A ${formatLength(bolt.length)} bolt`;
    const eps = 1e-9;
    const buy = `Buy the ${line.description} instead.`;
    if (bolt.length < min - eps) return [`${bought} is too short for ${grip}: ${range}. ${buy}`];
    if (bolt.length > max + eps) return [`${bought} is too long for ${grip}: ${range}. ${buy}`];
    return [
      `${bought} still fits ${grip}: ${range}. Use the ones bought in place of the ${line.description}.`,
    ];
  });
  return { change, ...(actions.length === 0 ? {} : { action: actions.join(' ') }) };
}

function partNote(view: PlanView, record: Extract<ResetRecord, { kind: 'part' }>): ResetNote {
  const { plan, steps } = view;
  const { was } = record;
  const [partId] = splitPartKey(record.key);
  const row = plan.cutList.find((r) => r.partId === partId);
  const item = `${row?.letter ?? was.letter} ${row?.name ?? was.name}, piece ${was.instance + 1}`;
  const base = { kind: record.kind, key: record.key, item };
  const cut = was.length === null ? 'cut' : `cut at ${formatLength(was.length)}`;
  if (!row || was.instance >= row.quantity) {
    return { ...base, change: `${cut}; no longer in the plan`, stepIds: [] };
  }
  const piece = piecesOf(plan).get(partId)?.[was.instance];
  const stepIds = steps
    .filter((s) =>
      s.board?.pieces.some((p) => partProgressKey(p.partId, p.instance) === record.key),
    )
    .map((s) => s.id);
  if (!piece || was.length === null) {
    return {
      ...base,
      change: `${cut}; its numbers changed`,
      action: 'Check it against the cut list before using it.',
      stepIds,
    };
  }
  const change = `${cut}, now ${formatLength(piece.length)}`;
  // Compared at the sixteenth it was cut to, so a difference too small to mark is no difference.
  const diff = toSixteenths(piece.length) - toSixteenths(was.length);
  if (diff > 0) {
    const replacement = { nominal: piece.nominal, feet: piece.feet, piece: item };
    return {
      ...base,
      change,
      action: `It is ${formatLength(piece.length - was.length)} short. Cut a new one from another board: the shopping list adds a ${lumberName(piece)} for it.`,
      stepIds,
      replacement,
    };
  }
  if (diff < 0) {
    return {
      ...base,
      change,
      action: `It is ${formatLength(was.length - piece.length)} long. Cut it down to ${formatLength(piece.length)}, and check its end cuts and marks against the cut list.`,
      stepIds,
    };
  }
  return {
    ...base,
    change: `${cut}, the same length now; its end cuts, marks, or holes changed`,
    action: 'Check it against its cut card.',
    stepIds,
  };
}

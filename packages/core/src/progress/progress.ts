import { z } from 'zod';
import type { Drawings } from '../geometry/index.ts';
import type { TemplateDefinition } from '../model/definition.ts';
import { CUTTING_OPERATION_TYPES } from '../model/operations.ts';
import type { ChecklistItem, Flag } from '../model/types.ts';
import type { Plan } from '../outputs/plan.ts';
import { boardIds, lumberLineKey } from '../outputs/shoppingList.ts';
import { type StepOutline, stepContents } from '../steps/build.ts';

// Saved progress (#57): what can be ticked off in a plan, each under a key that stays the same
// across regenerations, with the numbers it was ticked against. When a project regenerates, a
// tick stays only if its key is still in the plan with the same numbers; a tick on a board whose
// pieces moved, or a step whose holes moved, would say work is done that was done to other
// numbers. The comparison is made once, at regeneration, with both plans read by the same code, so
// it can include drawings: a part's cut detail holds its holes and marks, which the cut list does
// not. The structural review's expert checks and confirmation checklist are ticked too (#393): a
// tick there says the owner asked or confirmed it, never that the design is adequate.

export const PROGRESS_KINDS = [
  'shopping-line',
  'board',
  'part',
  'step',
  'flag',
  'checklist-item',
] as const;
export const ProgressKind = z.enum(PROGRESS_KINDS);
export type ProgressKind = z.infer<typeof ProgressKind>;

/** A tick set or cleared, as a client sends it to the server and keeps it while it waits. */
export const ProgressChange = z.object({
  kind: ProgressKind,
  key: z.string().min(1),
  done: z.boolean(),
});
export type ProgressChange = z.infer<typeof ProgressChange>;

/** Changes waiting to be sent, each with the revision of the plan it was made on (0018). */
export const WaitingProgressChanges = z.array(
  ProgressChange.extend({ revision: z.number().int().positive() }),
);

/**
 * The kinds ticked in the structural review rather than in Shopping or Building. They record what
 * was asked and confirmed, not work done on the project, so they never move its status.
 */
export const REVIEW_PROGRESS_KINDS = ['flag', 'checklist-item'] as const satisfies ProgressKind[];
export const isReviewProgress = (kind: ProgressKind) =>
  (REVIEW_PROGRESS_KINDS as readonly ProgressKind[]).includes(kind);

/** Something in a plan that can be ticked off. */
export interface ProgressItem {
  kind: ProgressKind;
  /**
   * Stable across regenerations: a lumber line by its stock's name and length ("lumber/2x6/12"),
   * a hardware line by its description ("hardware/..."), a board by its ID in the board plan
   * (`boardIds`), a part's piece by part ID and instance from 0 ("post/3"), a step by its ID, an
   * expert check by its category and what to ask, a checklist item by its category and element.
   */
  key: string;
  /** The numbers the item was made with, as canonical JSON, compared exactly. */
  numbers: string;
}

/** The item's kind and key in one string, for sets and maps. */
export const progressId = (item: Pick<ProgressItem, 'kind' | 'key'>) => `${item.kind}:${item.key}`;

/** A part's piece key: its part ID and which of its pieces it is, from 0. */
export const partProgressKey = (partId: string, instance: number) => `${partId}/${instance}`;

/** A shopping line's key; lumber and hardware lines never share one. */
const lumberProgressKey = (line: Parameters<typeof lumberLineKey>[0]) =>
  `lumber/${lumberLineKey(line)}`;
const hardwareProgressKey = (description: string) => `hardware/${description}`;

/**
 * An expert check's key: its category and what to ask. The ask carries the design's numbers, so
 * a flag asked about other numbers is another item.
 */
export const flagProgressKey = (flag: Pick<Flag, 'category' | 'ask'>) =>
  `${flag.category}/${flag.ask}`;

/** A confirmation checklist item's key: its category and the design element it is about. */
export const checklistProgressKey = (item: Pick<ChecklistItem, 'category' | 'element'>) =>
  `${item.category}/${item.element}`;

const json = (value: unknown) => JSON.stringify(value);

/** Items with the first of each key, so two with one key share a tick. */
function firstByKey<T>(items: readonly T[], key: (item: T) => string): { key: string; item: T }[] {
  const seen = new Map<string, T>();
  for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
  return [...seen].map(([k, item]) => ({ key: k, item }));
}

/**
 * The shopping lines as they are ticked: lumber, then hardware, each with its key. Two hardware
 * lines with one description would share a tick, so only the first is kept.
 */
function shoppingLines(
  plan: Pick<Plan, 'lumber' | 'hardware'>,
): { key: string; line: Plan['lumber']['lines'][number] | Plan['hardware'][number] }[] {
  const lines: { key: string; line: Plan['lumber']['lines'][number] | Plan['hardware'][number] }[] =
    plan.lumber.lines.map((line) => ({ key: lumberProgressKey(line), line }));
  for (const line of plan.hardware) {
    const key = hardwareProgressKey(line.description);
    if (!lines.some((l) => l.key === key)) lines.push({ key, line });
  }
  return lines;
}

/**
 * Every item in a plan that can be ticked off, in the plan's order: shopping lines (lumber, then
 * hardware), boards, each part's pieces, the build steps, then the expert checks and checklist
 * items. A piece's numbers include its part's cut detail, and a step's the cut details of the
 * parts it works on and, for site work, the site layout. An expert check's or checklist item's
 * numbers are the whole item, so a tick clears when its wording or the parts it concerns change.
 * Needs no inventory: which method does a step does not change what the step is.
 */
function planProgressItems(
  outline: readonly StepOutline[],
  plan: Pick<Plan, 'operations' | 'lumber' | 'hardware' | 'cutList' | 'flags' | 'checklist'>,
  drawings: Pick<Drawings, 'cutDetails' | 'siteLayout'>,
): ProgressItem[] {
  const { lumber } = plan;
  const detail = (partId: string) => drawings.cutDetails.find((d) => d.partId === partId) ?? null;
  const items: ProgressItem[] = [];
  // A line's numbers are what is bought: its store group can move without undoing a tick.
  for (const { key, line } of shoppingLines(plan)) {
    const bought =
      'nominal' in line
        ? { nominal: line.nominal, feet: line.feet, count: line.count }
        : { description: line.description, quantity: line.quantity };
    items.push({ kind: 'shopping-line', key, numbers: json(bought) });
  }
  const ids = boardIds(lumber.boards);
  lumber.boards.forEach((board, i) => {
    items.push({
      kind: 'board',
      key: ids[i] ?? '',
      numbers: json({ board, kerf: lumber.kerf, trimPerEnd: lumber.trimPerEnd }),
    });
  });
  // A piece's numbers: its exact length on a board (if one holds it), the cut list's row, the
  // cutting operations on its part, and its part's cut detail.
  const lengths = new Map<string, number[]>();
  for (const piece of lumber.boards.flatMap((b) => b.pieces)) {
    lengths.set(piece.partId, [...(lengths.get(piece.partId) ?? []), piece.length]);
  }
  for (const row of plan.cutList) {
    const cuts = plan.operations.filter(
      (op) =>
        CUTTING_OPERATION_TYPES.includes(op.type) && 'partId' in op && op.partId === row.partId,
    );
    for (let instance = 0; instance < row.quantity; instance++) {
      items.push({
        kind: 'part',
        key: partProgressKey(row.partId, instance),
        numbers: json({
          row,
          cuts,
          length: lengths.get(row.partId)?.[instance] ?? null,
          detail: detail(row.partId),
        }),
      });
    }
  }
  for (const step of stepContents(outline, plan)) {
    const partIds = [
      ...new Set(
        step.operations.flatMap((op) =>
          'partId' in op ? [op.partId] : 'partIds' in op ? op.partIds : [],
        ),
      ),
    ];
    const onSite = step.operations.some((op) => !('partId' in op) && !('partIds' in op));
    items.push({
      kind: 'step',
      key: step.id,
      numbers: json({
        step,
        details: partIds.map(detail),
        site: onSite ? drawings.siteLayout : null,
      }),
    });
  }
  for (const { key, item } of firstByKey(plan.flags, flagProgressKey)) {
    items.push({ kind: 'flag', key, numbers: json(item) });
  }
  for (const { key, item } of firstByKey(plan.checklist, checklistProgressKey)) {
    items.push({ kind: 'checklist-item', key, numbers: json(item) });
  }
  return items;
}

/** The progress items for a template's stored outputs. */
export function progressItems<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'steps' | 'plan' | 'drawings'>,
  outputs: O,
): ProgressItem[] {
  return planProgressItems(
    template.steps(outputs),
    template.plan(outputs),
    template.drawings(outputs),
  );
}

/** Why a tick was cleared when its project regenerated. */
export type ProgressResetReason = 'removed' | 'changed';

/** A tick cleared because its project regenerated, and why. */
export interface ProgressReset {
  kind: ProgressKind;
  key: string;
  reason: ProgressResetReason;
}

/**
 * Which ticks a regeneration clears: each ticked item whose key is no longer in the plan
 * (`removed`) or is there with other numbers (`changed`). The rest stay. A tick on a key the old
 * plan did not have either is cleared as `removed`.
 */
export function progressToReset(
  ticked: readonly Pick<ProgressItem, 'kind' | 'key'>[],
  before: readonly ProgressItem[],
  after: readonly ProgressItem[],
): ProgressReset[] {
  const was = new Map(before.map((i) => [progressId(i), i.numbers]));
  const now = new Map(after.map((i) => [progressId(i), i.numbers]));
  return ticked.flatMap(({ kind, key }): ProgressReset[] => {
    const id = progressId({ kind, key });
    const numbers = now.get(id);
    if (numbers === undefined || !was.has(id)) return [{ kind, key, reason: 'removed' }];
    if (numbers !== was.get(id)) return [{ kind, key, reason: 'changed' }];
    return [];
  });
}

/** A heading on the store checklist (#59) and the shopping lines under it. */
export interface ShoppingGroup {
  title: string;
  lines: ReturnType<typeof shoppingLines>;
}

/** The heading for hardware a plan made before store groups did not place (#59). */
const UNGROUPED_HARDWARE = 'Hardware';

/**
 * The shopping lines as the store checklist shows them (#59): lumber first, then each hardware
 * group in the order its first line comes. The groups are the template's words; this only keeps
 * their order.
 */
export function shoppingGroups(plan: Pick<Plan, 'lumber' | 'hardware'>): ShoppingGroup[] {
  const lines = shoppingLines(plan);
  const lumber = lines.filter((l) => 'nominal' in l.line);
  const hardware = lines.filter((l) => !('nominal' in l.line));
  return [
    ...(lumber.length > 0 ? [{ title: 'Lumber', lines: lumber }] : []),
    ...groupHardware(hardware, (l) => ('group' in l.line ? l.line.group : undefined)),
  ];
}

/**
 * Hardware under its store groups, each in the order its first item comes; items a plan made
 * before groups did not place go under `UNGROUPED_HARDWARE`.
 */
export function groupHardware<T>(
  items: readonly T[],
  groupOf: (item: T) => string | undefined,
): { title: string; lines: T[] }[] {
  const groups: { title: string; lines: T[] }[] = [];
  for (const item of items) {
    const title = groupOf(item) ?? UNGROUPED_HARDWARE;
    const group = groups.find((g) => g.title === title);
    if (group) group.lines.push(item);
    else groups.push({ title, lines: [item] });
  }
  return groups;
}

/** How far a project has got (#61): for the plan's mode cards and the projects list. */
export interface ProgressSummary {
  shopping: { done: number; total: number };
  /** Parts' pieces cut (#135): cutting a piece counts as building, before any step is done. */
  pieces: { done: number; total: number };
  steps: { done: number; total: number };
  /** The first step not done, numbered from 1; null when there are no steps or all are done. */
  nextStep: SummaryStep | null;
  /**
   * Where the owner was (#460): the step of the most recent tick in Building, or the step after it
   * when that tick marked a step done, as "Done, next" goes there. Null when no Building tick has
   * a time, such as ticks counted on the client before the server saved them.
   */
  resumeStep: SummaryStep | null;
}

/** A step as the progress summary names it, numbered from 1. */
interface SummaryStep {
  id: string;
  number: number;
  title: string;
}

/** A tick as the summary counts it; the server's ticks carry when each was saved. */
type CountedTick = Pick<ProgressItem, 'kind' | 'key'> & { doneAt?: string };

/** A step as the summary reads it: a cutting step's board, so a cut piece finds its step. */
interface CountedStep {
  id: string;
  title: string;
  board?: { id: string; pieces: readonly { partId: string; instance: number }[] };
}

/** Counts the ticked shopping lines, pieces, and steps, and finds the first step not done. */
export function summarizeProgress(
  plan: Pick<Plan, 'lumber' | 'hardware' | 'cutList'>,
  steps: readonly CountedStep[],
  ticked: readonly CountedTick[],
): ProgressSummary {
  const done = new Set(ticked.map(progressId));
  const lines = shoppingLines(plan);
  const isDone = (kind: ProgressKind, key: string) => done.has(progressId({ kind, key }));
  const next = steps.findIndex((s) => !isDone('step', s.id));
  const numbered = (i: number): SummaryStep | null => {
    const step = steps[i];
    return step ? { id: step.id, number: i + 1, title: step.title } : null;
  };
  const nextStep = numbered(next);
  const pieces = plan.cutList.flatMap((row) =>
    Array.from({ length: row.quantity }, (_, i) => partProgressKey(row.partId, i)),
  );
  return {
    shopping: {
      done: lines.filter((l) => isDone('shopping-line', l.key)).length,
      total: lines.length,
    },
    pieces: {
      done: pieces.filter((key) => isDone('part', key)).length,
      total: pieces.length,
    },
    steps: { done: steps.filter((s) => isDone('step', s.id)).length, total: steps.length },
    nextStep,
    resumeStep: resumeAt(steps, ticked, numbered, nextStep),
  };
}

/**
 * The step to resume at (`ProgressSummary.resumeStep`). The latest tick wins. Ticks saved in the
 * same write are told apart by how far along they are: the later step, and on one step, the step
 * marked done. A step marked done resumes at the step after it, or at the first step not done when
 * it was the last.
 */
function resumeAt(
  steps: readonly CountedStep[],
  ticked: readonly CountedTick[],
  numbered: (i: number) => SummaryStep | null,
  nextStep: SummaryStep | null,
): SummaryStep | null {
  let latest: { doneAt: string; at: number; along: number } | null = null;
  for (const { kind, key, doneAt } of ticked) {
    if (doneAt === undefined) continue;
    const at = stepOfTick(steps, kind, key);
    if (at < 0) continue;
    const along = at * 2 + (kind === 'step' ? 1 : 0);
    if (!latest || doneAt > latest.doneAt || (doneAt === latest.doneAt && along > latest.along)) {
      latest = { doneAt, at, along };
    }
  }
  if (!latest) return null;
  if (latest.along % 2 === 0) return numbered(latest.at);
  return numbered(latest.at + 1) ?? nextStep;
}

/** The index of the step a Building tick was made on, or -1 for any other tick. */
function stepOfTick(steps: readonly CountedStep[], kind: ProgressKind, key: string): number {
  if (kind === 'step') return steps.findIndex((s) => s.id === key);
  if (kind === 'board') return steps.findIndex((s) => s.board?.id === key);
  if (kind === 'part') {
    return steps.findIndex((s) =>
      s.board?.pieces.some((p) => partProgressKey(p.partId, p.instance) === key),
    );
  }
  return -1;
}

/** How many of the structural review's expert checks and checklist items are still open. */
export interface ReviewProgress {
  flags: { open: number; total: number };
  checklist: { open: number; total: number };
}

/** Counts the expert checks not yet asked and the checklist items not yet confirmed (#393). */
export function summarizeReview(
  plan: { flags: readonly Flag[]; checklist: readonly ChecklistItem[] },
  ticked: readonly Pick<ProgressItem, 'kind' | 'key'>[],
): ReviewProgress {
  const done = new Set(ticked.map(progressId));
  const count = (kind: ProgressKind, keys: readonly { key: string }[]) => ({
    open: keys.filter(({ key }) => !done.has(progressId({ kind, key }))).length,
    total: keys.length,
  });
  return {
    flags: count('flag', firstByKey(plan.flags, flagProgressKey)),
    checklist: count('checklist-item', firstByKey(plan.checklist, checklistProgressKey)),
  };
}

/** The progress summary for a template's stored outputs. Draws nothing, so it is cheap to list. */
export function progressSummary<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'steps' | 'plan'>,
  outputs: O,
  ticked: readonly CountedTick[],
): ProgressSummary {
  const plan = template.plan(outputs);
  return summarizeProgress(plan, stepContents(template.steps(outputs), plan), ticked);
}

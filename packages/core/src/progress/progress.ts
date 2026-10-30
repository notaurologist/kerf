import { z } from 'zod';
import type { Drawings } from '../geometry/index.ts';
import type { Plan } from '../outputs/plan.ts';
import { boardIds, lumberLineKey } from '../outputs/shoppingList.ts';
import { type StepOutline, stepContents } from '../steps/build.ts';
import type { TemplateDefinition } from '../templates/definition.ts';
import { CUTTING_OPERATION_TYPES } from '../templates/operations.ts';

// Saved progress (#57): what can be ticked off in a plan, each under a key that stays the same
// across regenerations, with the numbers it was ticked against. When a project regenerates, a
// tick stays only if its key is still in the plan with the same numbers; a tick on a board whose
// pieces moved, or a step whose holes moved, would say work is done that was done to other
// numbers. The comparison is made once, at regeneration, with both plans read by the same code, so
// it can include drawings: a part's cut detail holds its holes and marks, which the cut list does
// not.

export const PROGRESS_KINDS = ['shopping-line', 'board', 'part', 'step'] as const;
export const ProgressKind = z.enum(PROGRESS_KINDS);
export type ProgressKind = z.infer<typeof ProgressKind>;

/** Something in a plan that can be ticked off. */
export interface ProgressItem {
  kind: ProgressKind;
  /**
   * Stable across regenerations: a lumber line by its nominal size and length ("lumber/2x6/12"),
   * a hardware line by its description ("hardware/..."), a board by its ID in the board plan
   * (`boardIds`), a part's piece by part ID and instance from 0 ("post/3"), a step by its ID.
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
export const lumberProgressKey = (line: Parameters<typeof lumberLineKey>[0]) =>
  `lumber/${lumberLineKey(line)}`;
export const hardwareProgressKey = (description: string) => `hardware/${description}`;

const json = (value: unknown) => JSON.stringify(value);

/**
 * Every item in a plan that can be ticked off, in the plan's order: shopping lines (lumber, then
 * hardware), boards, each part's pieces, and the build steps. A piece's numbers include its
 * part's cut detail, and a step's the cut details of the parts it works on and, for site work, the
 * site layout. Needs no inventory: which method does a step does not change what the step is.
 */
export function planProgressItems(
  outline: readonly StepOutline[],
  plan: Pick<Plan, 'operations' | 'lumber' | 'hardware' | 'cutList'>,
  drawings: Pick<Drawings, 'cutDetails' | 'siteLayout'>,
): ProgressItem[] {
  const { lumber } = plan;
  const detail = (partId: string) => drawings.cutDetails.find((d) => d.partId === partId) ?? null;
  const items: ProgressItem[] = [];
  for (const line of lumber.lines) {
    items.push({ kind: 'shopping-line', key: lumberProgressKey(line), numbers: json(line) });
  }
  for (const line of plan.hardware) {
    const key = hardwareProgressKey(line.description);
    // Two hardware lines with one description would share a tick; keep the first.
    if (items.some((i) => i.kind === 'shopping-line' && i.key === key)) continue;
    items.push({ kind: 'shopping-line', key, numbers: json(line) });
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

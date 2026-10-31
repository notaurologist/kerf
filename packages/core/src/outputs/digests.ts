import type { Drawings } from '../geometry/index.ts';
import type { EnteredValue } from '../model/form.ts';
import type { BuildStep } from '../steps/build.ts';
import { lowestMargin } from '../structural/lowest.ts';
import { formatMargin } from '../structural/types.ts';
import type { Plan } from './plan.ts';

// One line for each section of the plan, for the summary's list of sections (#147, #156): counts
// such as "5 parts, 9 pieces" that say whether a section is worth opening. Counted here, from the
// stored plan on each read, rather than in a display (hard rules 1 and 6). Nothing is stored.

export interface PlanDigests {
  /** Null when the plan has no drawings. */
  diagrams: string | null;
  structuralReview: string;
  cutList: string;
  boards: string;
  shoppingList: string;
  /** Null when the plan has no build steps, as for plans made before operations. */
  buildSteps: string | null;
  /** Null when the structural inputs cannot be read back. */
  parameters: string | null;
}

/** "1 piece", "9 pieces". */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "a", "a and b", "a, b, and c". */
function series(words: readonly string[]): string {
  if (words.length <= 2) return words.join(' and ');
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`;
}

export function planDigests(
  plan: Plan,
  read: {
    drawings?: Drawings | null;
    steps?: readonly BuildStep[];
    /** The structural inputs as `enteredValues` reads them back; `text` is null when not entered. */
    structuralInputs?: readonly { values: readonly EnteredValue[] }[];
  } = {},
): PlanDigests {
  return {
    diagrams: read.drawings ? diagrams(read.drawings) : null,
    structuralReview: structuralReview(plan),
    cutList: `${count(plan.cutList.length, 'part')}, ${count(
      plan.cutList.reduce((n, row) => n + row.quantity, 0),
      'piece',
    )}`,
    boards: boards(plan),
    shoppingList: `${count(plan.lumber.lines.length, 'lumber line')}, ${count(plan.hardware.length, 'hardware line')}`,
    buildSteps: read.steps && read.steps.length > 0 ? buildSteps(read.steps) : null,
    parameters: read.structuralInputs ? parameters(read.structuralInputs) : null,
  };
}

function diagrams(d: Drawings): string {
  const views = [
    ...(d.isometric ? ['assembled'] : []),
    ...(d.exploded ? ['exploded'] : []),
    ...(d.siteLayout ? ['site'] : []),
  ];
  const named = series(views);
  const lines = [
    ...(views.length > 0
      ? [
          `${named.charAt(0).toUpperCase()}${named.slice(1)} ${views.length === 1 ? 'view' : 'views'}`,
        ]
      : []),
    ...(d.cutDetails.length > 0 ? [count(d.cutDetails.length, 'cut detail')] : []),
  ];
  return lines.length > 0 ? lines.join(' · ') : 'No drawings';
}

function structuralReview(plan: Plan): string {
  const { checks, flags, checklist } = plan;
  const lowest = lowestMargin(checks);
  const margin = (() => {
    switch (lowest.status) {
      case 'computed':
        return `${count(checks.length, 'check')}, lowest ${formatMargin(lowest.check.margin)}`;
      case 'input-needed':
        return `${count(checks.length, 'check')}, ${lowest.count} ${lowest.count === 1 ? 'needs' : 'need'} structural inputs`;
      case 'not-computed':
        return `${count(checks.length, 'check')}, ${lowest.count} not computed`;
      case 'no-checks':
        return 'No structural checks';
    }
  })();
  return [
    margin,
    flags.length === 0 ? 'no expert checks' : count(flags.length, 'expert check'),
    ...(checklist.length > 0 ? [`${count(checklist.length, 'item')} to confirm`] : []),
  ].join(' · ');
}

function boards(plan: Plan): string {
  const { boards, issues } = plan.lumber;
  const pieces = boards.reduce((n, b) => n + b.pieces.length, 0);
  return [
    `${count(pieces, 'piece')} from ${count(boards.length, 'board')}`,
    // A part no buyable board holds is never dropped silently (outputs/shoppingList.ts).
    ...(issues.length > 0 ? [`${count(issues.length, 'part')} on no board`] : []),
  ].join(' · ');
}

function buildSteps(steps: readonly BuildStep[]): string {
  const cutting = steps.filter((s) => s.board).length;
  const rest = steps.length - cutting;
  const all = count(steps.length, 'step');
  if (cutting === 0) return all;
  if (rest === 0) return `${all}: ${count(cutting, 'board')} to cut`;
  return `${all}: ${count(cutting, 'board')} to cut, then ${rest} more`;
}

function parameters(sections: readonly { values: readonly EnteredValue[] }[]): string {
  const values = sections.flatMap((s) => s.values);
  const needed = values.filter((v) => v.text === null).length;
  if (needed === 0) return 'Every structural input entered';
  return `${needed} of ${count(values.length, 'structural input')} needed`;
}

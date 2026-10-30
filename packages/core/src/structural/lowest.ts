import type { CheckResult, ComputedCheck } from './types.ts';

// The lowest margin among a plan's structural checks, for the plan's summary (#119). Chosen here
// rather than in a display (hard rule 6). A check with no margin could be the lowest, so the
// lowest is given only when every check has one; otherwise how many lack one, and why.

export type LowestMargin =
  /** Every check has a margin; this one's is the lowest (the first of equals, in plan order). */
  | { status: 'computed'; check: ComputedCheck }
  /** `count` of the `of` checks need structural inputs before they have a margin. */
  | { status: 'input-needed'; count: number; of: number }
  /** Every check has its inputs, but `count` of the `of` could not be computed. */
  | { status: 'not-computed'; count: number; of: number }
  | { status: 'no-checks' };

export function lowestMargin(checks: readonly CheckResult[]): LowestMargin {
  if (checks.length === 0) return { status: 'no-checks' };
  const needed = checks.filter((c) => c.status === 'input-needed').length;
  if (needed > 0) return { status: 'input-needed', count: needed, of: checks.length };
  const notComputed = checks.filter((c) => c.status === 'not-computed').length;
  if (notComputed > 0) return { status: 'not-computed', count: notComputed, of: checks.length };
  const computed = checks.filter((c): c is ComputedCheck => c.status === 'computed');
  const lowest = computed.reduce((low, c) => (c.margin < low.margin ? c : low));
  return { status: 'computed', check: lowest };
}

import type { ProgressReset, ProgressSummary } from '@kerf/core';
import { type ProjectStatus, STATUS_LABELS } from './types.ts';

// Saved progress (#57). A save that regenerates the plan clears the ticks whose item is gone or
// has other numbers; the project page says how many and why.

/**
 * The line saying which ticks a save cleared, or null when it cleared none. When it leaves
 * nothing bought, cut, or built, it also says why the status stays: a reset means the numbers
 * changed, not that the work was undone, so status never moves back on its own.
 */
export function describeReset(
  reset: readonly Pick<ProgressReset, 'reason'>[] | undefined,
  project?: { status: ProjectStatus; progress: ProgressSummary | null },
) {
  if (!reset || reset.length === 0) return null;
  const counted = countReset(reset);
  const p = project?.progress;
  if (!project || project.status === 'planned' || !p) return counted;
  if (p.shopping.done > 0 || p.pieces.done > 0 || p.steps.done > 0) return counted;
  return `${counted} The status stays ${STATUS_LABELS[project.status]}, because what you bought or built before this change is still done. Change it in Edit if it no longer fits.`;
}

function countReset(reset: readonly Pick<ProgressReset, 'reason'>[]) {
  const n = reset.length;
  const changed = reset.filter((r) => r.reason === 'changed').length;
  const removed = n - changed;
  const items = n === 1 ? '1 item marked done was reset' : `${n} items marked done were reset`;
  if (removed === 0) {
    return `${items} because ${n === 1 ? 'its numbers' : 'their numbers'} changed.`;
  }
  if (changed === 0) {
    return `${items} because ${n === 1 ? 'it is' : 'they are'} no longer in the plan.`;
  }
  const have = changed === 1 ? '1 has' : `${changed} have`;
  const are = removed === 1 ? '1 is' : `${removed} are`;
  return `${items}: ${have} new numbers and ${are} no longer in the plan.`;
}

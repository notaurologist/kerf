import type { ProgressReset } from '@kerf/core';

// Saved progress (#57). A save that regenerates the plan clears the ticks whose item is gone or
// has other numbers; the project page says how many and why.

/** The line saying which ticks a save cleared, or null when it cleared none. */
export function describeReset(reset: readonly Pick<ProgressReset, 'reason'>[] | undefined) {
  if (!reset || reset.length === 0) return null;
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

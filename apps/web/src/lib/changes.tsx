import type { Change } from '@kerf/core';
import type { ReactNode } from 'react';
import { Changed } from '../ui/index.ts';

// What a preview changes from the saved plan (#56), looked up by the paths core's comparison
// reports, such as 'cutList[0].length'. Paths are in the Plan every display shares, so a display
// finds its own changes without knowing the template.

export interface Changes {
  /** How many paths changed. */
  size: number;
  /** The change at exactly this path. */
  at(path: string): Change | undefined;
  /** True when this path, or anything under it, changed. */
  under(path: string): boolean;
  /** Saved items an array no longer has: their values before, in order. */
  removed(arrayPath: string): unknown[];
}

export function indexChanges(changes: readonly Change[]): Changes {
  const byPath = new Map(changes.map((c) => [c.path, c]));
  return {
    size: changes.length,
    at: (path) => byPath.get(path),
    under: (path) =>
      changes.some(
        (c) => c.path === path || c.path.startsWith(`${path}.`) || c.path.startsWith(`${path}[`),
      ),
    removed: (arrayPath) => {
      const item = new RegExp(`^${arrayPath.replace(/[.[\]]/g, '\\$&')}\\[\\d+\\]$`);
      return changes.filter((c) => item.test(c.path) && !('after' in c)).map((c) => c.before);
    },
  };
}

/** For the saved plan itself: nothing is marked. */
export const NO_CHANGES = indexChanges([]);

/**
 * A displayed value, marked with the saved one when the preview changes it. `was` turns the saved
 * value into text the way the display shows its own (it gets core's value, never recomputes it).
 */
export function marked(
  changes: Changes,
  path: string,
  value: ReactNode,
  was: (before: unknown) => string = String,
): ReactNode {
  const change = changes.at(path);
  if (!change) return value;
  return <Changed was={'before' in change ? was(change.before) : null}>{value}</Changed>;
}

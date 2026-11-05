import { type Solved, solveExact } from './exact.ts';
import type { CutInstance } from './instance.ts';

// Recent plans, so a stock planned again with the same pieces is not searched again: a plan saved
// after it was previewed, an edit that leaves a stock's pieces alone, or a test that generates the
// same example many times. The search is deterministic, so a cached plan is exactly the plan a new
// search would find, and the output is the same with or without the cache.
//
// A plan is cached under its instance and the work limit it was searched with. A search that
// finished never reached its limit, so it would follow the same path under any limit at least as
// large as the work it spent, and its plan is used for those too.

type Solve = (instance: CutInstance, options: { workLimit: number }) => Solved;

const copy = (solved: Solved): Solved => structuredClone(solved);

/**
 * A cache of at most `size` instances in front of `solve`, least recently used dropped first.
 * `clear` empties it, so a measurement can pay for every search, as a new server instance does.
 */
export function cached(solve: Solve, size: number): Solve & { clear: () => void } {
  const entries = new Map<string, { workLimit: number; solved: Solved }[]>();
  const lookup: Solve = (instance, { workLimit }) => {
    const key = JSON.stringify([
      instance.lengths,
      instance.pieces,
      instance.kerf,
      instance.trimPerEnd,
    ]);
    const found = entries.get(key) ?? [];
    const hit = found.find(
      (e) => e.workLimit === workLimit || (e.solved.proven && e.solved.work <= workLimit),
    );
    entries.delete(key);
    if (hit) {
      entries.set(key, found);
      return copy(hit.solved);
    }
    const solved = solve(instance, { workLimit });
    entries.set(key, [...found, { workLimit, solved: copy(solved) }]);
    for (const oldest of entries.keys()) {
      if (entries.size <= size) break;
      entries.delete(oldest);
    }
    return solved;
  };
  return Object.assign(lookup, { clear: () => entries.clear() });
}

/**
 * `solveExact`, cached across calls. A plan with a few dozen stocks fits many times over, and a
 * cached plan holds only piece indexes, so the cache stays small.
 */
export const solveCached = cached(solveExact, 200);

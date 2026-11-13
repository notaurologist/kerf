import { describe, expect, it } from 'vitest';
import { cached } from './cache.ts';
import { solveExact } from './exact.ts';
import type { CutInstance } from './instance.ts';

// 60, 60, 36, and 36 on 8' and 10' boards: first-fit decreasing buys 18 ft, the exact method 16
// ft, proven (exact.test.ts).
const INSTANCE: CutInstance = {
  lengths: [8, 10],
  pieces: [60, 60, 36, 36],
  kerf: 0,
  trimPerEnd: 0,
};

/** `solveExact` behind a cache, counting the searches that reach it. */
function counted(size = 10) {
  let searches = 0;
  const solve = cached((instance, options) => {
    searches++;
    return solveExact(instance, options);
  }, size);
  return { solve, searches: () => searches };
}

describe('cached', () => {
  it('gives the same plan as a new search, searching once', () => {
    const { solve, searches } = counted();
    const fresh = solveExact(INSTANCE, { workLimit: 1e6 });
    expect(solve(INSTANCE, { workLimit: 1e6 })).toEqual(fresh);
    expect(solve(INSTANCE, { workLimit: 1e6 })).toEqual(fresh);
    expect(searches()).toBe(1);
  });

  it('uses a finished search for any limit at least the work it spent', () => {
    const { solve, searches } = counted();
    const proven = solve(INSTANCE, { workLimit: 1e6 });
    expect(proven.proven).toBe(true);
    expect(solve(INSTANCE, { workLimit: proven.work })).toEqual(proven);
    expect(solve(INSTANCE, { workLimit: 2e6 })).toEqual(proven);
    expect(searches()).toBe(1);
    // Below the work it spent, the search would stop sooner, so it searches again.
    expect(solve(INSTANCE, { workLimit: 0 })).toEqual(solveExact(INSTANCE, { workLimit: 0 }));
    expect(searches()).toBe(2);
  });

  it('uses a stopped search only for the limit it stopped at', () => {
    const { solve, searches } = counted();
    const stopped = solve(INSTANCE, { workLimit: 0 });
    expect(stopped.proven).toBe(false);
    expect(solve(INSTANCE, { workLimit: 0 })).toEqual(stopped);
    expect(searches()).toBe(1);
    expect(solve(INSTANCE, { workLimit: 1e6 }).feet).toBe(16);
    expect(searches()).toBe(2);
  });

  it('does not use a search that stopped in the root relaxation for a larger limit', () => {
    // One 90" piece: first-fit's 8 ft meets the material bound, so a search stopped in the root
    // relaxation still reports its plan as proven, but with less work than a finished search.
    const single: CutInstance = { lengths: [8, 10], pieces: [90], kerf: 0, trimPerEnd: 0 };
    const { solve, searches } = counted();
    const stopped = solve(single, { workLimit: 1 });
    expect(stopped.proven).toBe(true);
    expect(stopped.work).toBeGreaterThan(1);
    const fresh = solveExact(single, { workLimit: 1e6 });
    expect(fresh.work).toBeGreaterThan(stopped.work);
    expect(solve(single, { workLimit: 1e6 })).toEqual(fresh);
    expect(searches()).toBe(2);
  });

  it('tells instances apart by their pieces in order', () => {
    const { solve, searches } = counted();
    solve(INSTANCE, { workLimit: 1e6 });
    const reordered = { ...INSTANCE, pieces: [36, 60, 36, 60] };
    expect(solve(reordered, { workLimit: 1e6 })).toEqual(solveExact(reordered, { workLimit: 1e6 }));
    expect(searches()).toBe(2);
  });

  it('returns a copy, so changing a plan does not change the cache', () => {
    const { solve } = counted();
    solve(INSTANCE, { workLimit: 1e6 }).plan.boards.pop();
    expect(solve(INSTANCE, { workLimit: 1e6 }).plan.boards).toHaveLength(2);
  });

  it('drops the least recently used instance past its size', () => {
    const { solve, searches } = counted(2);
    const a = INSTANCE;
    const b = { ...INSTANCE, pieces: [60, 36] };
    const c = { ...INSTANCE, pieces: [36] };
    solve(a, { workLimit: 1e6 });
    solve(b, { workLimit: 1e6 });
    solve(a, { workLimit: 1e6 });
    solve(c, { workLimit: 1e6 });
    expect(searches()).toBe(3);
    solve(a, { workLimit: 1e6 });
    expect(searches()).toBe(3);
    solve(b, { workLimit: 1e6 });
    expect(searches()).toBe(4);
  });

  it('searches again after it is cleared', () => {
    const { solve, searches } = counted();
    const first = solve(INSTANCE, { workLimit: 1e6 });
    solve.clear();
    expect(solve(INSTANCE, { workLimit: 1e6 })).toEqual(first);
    expect(searches()).toBe(2);
  });
});

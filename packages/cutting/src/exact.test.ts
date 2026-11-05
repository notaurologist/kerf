import { describe, expect, it, vi } from 'vitest';
import { firstFitDecreasing } from './baseline.ts';
import { measure, planProblems } from './check.ts';
import { solveExact } from './exact.ts';
import type { Instance } from './instance.ts';
import { benchmarkInstances } from './sources.ts';

const pieces = (...lengths: number[]) =>
  lengths.map((length, i) => ({ partId: `${i}`, name: `${i}`, length }));

describe('solveExact', () => {
  // Two 60" and two 36" pieces on 8' and 10' boards, with no kerf or trim. The baseline puts both
  // 60" pieces on one 10' board (120") and both 36" on an 8' (72"): 18 ft. Pairing each 60" with
  // a 36" uses 96", exactly an 8' board, twice: 16 ft. No plan buys less, since the pieces total
  // 192" and 16 ft holds just 192".
  it('beats the baseline on a hand-worked example and proves it', () => {
    const instance: Instance = {
      nominal: 'x',
      lengths: [8, 10],
      pieces: pieces(60, 60, 36, 36),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(measure(firstFitDecreasing(instance))).toEqual({ feet: 18, boards: 2 });
    const solved = solveExact(instance);
    expect(solved).toMatchObject({ feet: 16, bound: 16, proven: true });
    expect(planProblems(instance, solved.plan)).toEqual([]);
    expect(solved.plan.boards.map((b) => [b.feet, b.pieces.sort()])).toEqual([
      [8, [0, 2]],
      [8, [1, 3]],
    ]);
  });

  // Three 45" pieces on 10' boards: the relaxation's bound (20 ft) is met by the baseline, so no
  // search is needed.
  it('returns the baseline when it meets the bound', () => {
    const instance: Instance = {
      nominal: 'x',
      lengths: [10],
      pieces: pieces(45, 45, 45),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(solveExact(instance)).toMatchObject({ feet: 20, bound: 20, proven: true, nodes: 0 });
  });

  // Three 50" pieces on 8' boards: two do not fit together (100" of 96"), so three boards, 24 ft,
  // though the material bound is 16 ft and the relaxation, which cannot put two on a board
  // either, is 24 ft. Pieces of 70" and 30" on 8' and 10' with 1/8" kerf and 1/2" trim show the
  // search proving an answer above every bound: see the benchmark test below.
  it('returns the baseline, unproven, when the work runs out before the root bound', () => {
    const instance: Instance = {
      nominal: 'x',
      lengths: [8, 10],
      pieces: pieces(60, 60, 36, 36),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(solveExact(instance, { workLimit: 0 })).toMatchObject({
      feet: 18,
      bound: 16,
      proven: false,
      nodes: 0,
    });
  });

  // The search follows the same path whatever the limit, and its best plan only improves along
  // it, so each unit of work up to a proof can only keep or lower the feet.
  it('stops at its work limit, unproven, with the best plan found so far', () => {
    const instance: Instance = {
      nominal: 'x',
      lengths: [8, 10],
      pieces: pieces(60, 60, 36, 36),
      kerf: 0,
      trimPerEnd: 0,
    };
    const full = solveExact(instance, { workLimit: Number.POSITIVE_INFINITY });
    expect(full).toMatchObject({ feet: 16, proven: true });
    const stops = Array.from({ length: full.work }, (_, limit) =>
      solveExact(instance, { workLimit: limit }),
    );
    expect(stops.every((s) => !s.proven)).toBe(true);
    expect(stops.map((s) => s.feet)).toEqual([...stops.map((s) => s.feet)].sort((a, b) => b - a));
    expect(stops.some((s) => s.feet === 18 && s.nodes > 0)).toBe(true);
    expect(solveExact(instance, { workLimit: full.work })).toEqual(full);
  });

  // A workbench stock the search cannot prove within this limit, so the plan is the one found when
  // the work ran out. Neither the clock nor the run before it changes where that is.
  it('gives the same plan on repeated runs and whatever the clock reads', () => {
    const tallest = benchmarkInstances({ sweepCount: 0, seed: 544 }).find((s) =>
      s.source.startsWith('workbench / Edge of range: the tallest bench'),
    )?.instance;
    if (!tallest) throw new Error('No tallest workbench instance.');
    const first = solveExact(tallest, { workLimit: 2e6 });
    expect(first.proven).toBe(false);
    expect(solveExact(tallest, { workLimit: 2e6 })).toEqual(first);
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => {
      now += 1e6 * Math.random();
      return now;
    });
    try {
      expect(solveExact(tallest, { workLimit: 2e6 })).toEqual(first);
    } finally {
      clock.mockRestore();
    }
  });

  it('keeps a piece no length holds out of the plan', () => {
    const instance: Instance = {
      nominal: 'x',
      lengths: [8],
      pieces: pieces(50, 200, 50, 50),
      kerf: 0,
      trimPerEnd: 0,
    };
    const solved = solveExact(instance);
    expect(solved).toMatchObject({ feet: 24, proven: true });
    expect(solved.plan.unfit).toEqual([1]);
  });
});

describe('solveExact on benchmark instances', () => {
  const instances = benchmarkInstances({ sweepCount: 20, seed: 544 });

  it.each(instances.map((s) => [s.source, s.instance] as const))('%s', (_, instance) => {
    const solved = solveExact(instance, { workLimit: 3e6 });
    expect(planProblems(instance, solved.plan)).toEqual([]);
    expect(solved.feet).toBe(measure(solved.plan).feet);
    expect(solved.feet).toBeLessThanOrEqual(measure(firstFitDecreasing(instance)).feet);
    expect(solved.feet).toBeGreaterThanOrEqual(solved.bound);
  });
});

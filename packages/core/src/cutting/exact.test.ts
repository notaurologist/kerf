import { describe, expect, it } from 'vitest';
import { planProblems } from './check.ts';
import { solveExact } from './exact.ts';
import { firstFitDecreasing } from './firstFit.ts';
import { type CutInstance, measure } from './instance.ts';

const pieces = (...lengths: number[]) => lengths;

describe('solveExact', () => {
  // Two 60" and two 36" pieces on 8' and 10' boards, with no kerf or trim. The baseline puts both
  // 60" pieces on one 10' board (120") and both 36" on an 8' (72"): 18 ft. Pairing each 60" with
  // a 36" uses 96", exactly an 8' board, twice: 16 ft. No plan buys less, since the pieces total
  // 192" and 16 ft holds just 192".
  it('beats the baseline on a hand-worked example and proves it', () => {
    const instance: CutInstance = {
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
  it('returns first-fit decreasing when it meets the bound', () => {
    const instance: CutInstance = {
      lengths: [10],
      pieces: pieces(45, 45, 45),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(solveExact(instance)).toMatchObject({ feet: 20, bound: 20, proven: true, nodes: 0 });
  });

  // With no work allowed, the root relaxation does not finish, so the bound is the material bound
  // (192" of pieces needs 16 ft) and the plan is first-fit decreasing's 18 ft.
  it('returns first-fit decreasing, unproven, when the work runs out before the root bound', () => {
    const instance: CutInstance = {
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
    const instance: CutInstance = {
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

  it('keeps a piece no length holds out of the plan', () => {
    const instance: CutInstance = {
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

import { describe, expect, it } from 'vitest';
import { materialBound, relaxation } from './bounds.ts';
import { firstFitDecreasing } from './firstFit.ts';
import { type CutInstance, measure } from './instance.ts';
import { OutOfWork, Work } from './work.ts';

const pieces = (...lengths: number[]) => lengths;

describe('bounds on hand-worked examples', () => {
  // Three 45" pieces on 10' boards with no kerf or trim. Two fit a board (90" of 120"), three do
  // not (135"). The relaxation cuts 1.5 boards, 15 ft, and a plan's feet are a multiple of 10, so
  // the bound is 20 ft. The material bound: 135" needs more than one board's 120", so 20 ft.
  it('rounds the relaxation up to a whole number of boards', () => {
    const instance: CutInstance = {
      lengths: [10],
      pieces: pieces(45, 45, 45),
      kerf: 0,
      trimPerEnd: 0,
    };
    const lp = relaxation(instance);
    expect(lp.value).toBeCloseTo(15, 9);
    expect(lp.bound).toBe(20);
    expect(materialBound(instance)).toBe(20);
  });

  // Two 100" and four 40" pieces on 8' and 10' boards, kerf 1/8", trim 1/2" at each end. Room:
  // 95" on 8', 119" on 10'. A 100" piece uses 100.125", so it needs a 10' board and nothing else
  // fits beside it (100.125 + 40.125 = 140.25). Two 40" pieces use 80.25" and fit an 8'; three use
  // 120.375" and fit neither. So each 100" piece costs 10 ft and each 40" piece 4 ft: 2·10 + 4·4 =
  // 36 ft, which the relaxation finds with prices 10 and 4. The material bound only asks for
  // 2·100.125 + 4·40.125 = 360.75" of room: 30 ft as three 10' boards gives 357", four 8' boards
  // (32 ft) give 380", so 32 ft, below the relaxation's 36.
  it('prices each piece type at what it costs', () => {
    const instance: CutInstance = {
      lengths: [8, 10],
      pieces: pieces(40, 100, 40, 40, 100, 40),
      kerf: 0.125,
      trimPerEnd: 0.5,
    };
    const lp = relaxation(instance);
    expect(lp.types.map((t) => t.length)).toEqual([100, 40]);
    expect(lp.value).toBeCloseTo(36, 9);
    expect(lp.bound).toBe(36);
    expect(lp.prices[0]).toBeCloseTo(10, 9);
    expect(lp.prices[1]).toBeCloseTo(4, 9);
    expect(materialBound(instance)).toBe(32);
    expect(measure(firstFitDecreasing(instance)).feet).toBe(36);
  });

  it('reaches the same optimum from seed patterns, cut down to the pieces it has', () => {
    const instance: CutInstance = {
      lengths: [8, 10],
      pieces: pieces(40, 100, 40),
      kerf: 0.125,
      trimPerEnd: 0.5,
    };
    // A seed of two 40" pieces on an 8' board, and one with a length this instance lacks.
    const seed = [
      { feet: 8, pieces: new Map([[40, 2]]) },
      { feet: 10, pieces: new Map([[55, 1]]) },
    ];
    const seeded = relaxation(instance, { seed });
    expect(seeded.value).toBeCloseTo(relaxation(instance).value, 9);
    expect(seeded.value).toBeCloseTo(10 + 2 * 4, 9);
    expect(seeded.patterns).toContainEqual({ feet: 8, counts: [0, 2] });
  });

  it('stops when its work runs out', () => {
    const instance: CutInstance = {
      lengths: [8],
      pieces: pieces(40),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(() => relaxation(instance, { work: new Work(0) })).toThrow(OutOfWork);
  });

  it('leaves out pieces no length holds', () => {
    const instance: CutInstance = {
      lengths: [8],
      pieces: pieces(200, 40),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(relaxation(instance).bound).toBe(8);
    expect(materialBound(instance)).toBe(8);
  });

  it('refuses lengths that are not whole feet', () => {
    const instance: CutInstance = {
      lengths: [8.5],
      pieces: pieces(40),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(() => materialBound(instance)).toThrow('whole feet');
  });
});

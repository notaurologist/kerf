import { describe, expect, it } from 'vitest';
import { maximize } from './simplex.ts';

describe('maximize', () => {
  // The Wyndor Glass example (Hillier and Lieberman, Introduction to Operations Research, ch. 3):
  // max 3y1 + 5y2 subject to y1 ≤ 4, 2y2 ≤ 12, 3y1 + 2y2 ≤ 18. By hand: the last two rows bind,
  // so y2 = 6, y1 = (18 − 12) / 3 = 2, value 3·2 + 5·6 = 36. The duals x solve 2x2 + 3x3 = 5 with
  // x1 = 0 and 3x3 = 3, so x3 = 1 and x2 = 1.5, and 12·1.5 + 18·1 = 36 as well.
  it('solves a hand-worked example and its dual', () => {
    const result = maximize(
      [3, 5],
      [
        [1, 0],
        [0, 2],
        [3, 2],
      ],
      [4, 12, 18],
    );
    expect(result.value).toBeCloseTo(36, 9);
    expect(result.y[0]).toBeCloseTo(2, 9);
    expect(result.y[1]).toBeCloseTo(6, 9);
    expect(result.dual[0]).toBeCloseTo(0, 9);
    expect(result.dual[1]).toBeCloseTo(1.5, 9);
    expect(result.dual[2]).toBeCloseTo(1, 9);
  });

  it('refuses a right-hand side below zero', () => {
    expect(() => maximize([1], [[1]], [-1])).toThrow('at least zero');
  });

  it('reports an unbounded program', () => {
    expect(() => maximize([1, 1], [[1, -1]], [1])).toThrow('unbounded');
  });
});

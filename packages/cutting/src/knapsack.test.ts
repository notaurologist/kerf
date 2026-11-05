import { describe, expect, it } from 'vitest';
import { knapsack } from './knapsack.ts';

describe('knapsack', () => {
  // Capacity 10. Weights 5, 4, 6, 3 worth 10, 40, 30, 50, one of each. By hand: 4 + 3 = 7 is worth
  // 90; 4 + 6 = 10 is worth 70; 6 + 3 = 9 is worth 80; any three weigh more than 10.
  it('finds the most valuable set in a hand-worked example', () => {
    const items = [
      { weight: 5, value: 10, limit: 1 },
      { weight: 4, value: 40, limit: 1 },
      { weight: 6, value: 30, limit: 1 },
      { weight: 3, value: 50, limit: 1 },
    ];
    expect(knapsack(items, 10)).toEqual({ value: 90, weight: 7, counts: [0, 1, 0, 1] });
  });

  // An 8' board less 1/2" trim at each end has 95" of room. A 40" piece and its 1/8" kerf use
  // 40.125", so two fit (80.25") and three do not (120.375"), however many are allowed.
  it('keeps fractional weights exact and copies within room and limit', () => {
    const packed = knapsack([{ weight: 40.125, value: 4, limit: 4 }], 95);
    expect(packed.counts).toEqual([2]);
    expect(packed.weight).toBe(80.25);
    expect(knapsack([{ weight: 40.125, value: 4, limit: 1 }], 95).counts).toEqual([1]);
  });
});

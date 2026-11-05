import { describe, expect, it } from 'vitest';
import { type KnapsackItem, knapsack } from './knapsack.ts';
import { seeded } from './random.ts';

/** Every count of every item, for checking the search on small cases. */
function bruteForce(items: readonly KnapsackItem[], capacity: number): number {
  let best = 0;
  const visit = (i: number, weight: number, value: number) => {
    if (weight > capacity + 1e-9) return;
    if (i === items.length) {
      best = Math.max(best, value);
      return;
    }
    const item = items[i] as KnapsackItem;
    for (let n = 0; n <= item.limit; n++)
      visit(i + 1, weight + n * item.weight, value + n * item.value);
  };
  visit(0, 0, 0);
  return best;
}

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

  it('finds the best value on random cases, as trying every count does', () => {
    const r = seeded(663);
    for (let trial = 0; trial < 300; trial++) {
      const items = Array.from({ length: r.int(1, 6) }, () => ({
        weight: r.between(5, 70),
        value: r.between(0, 6),
        limit: r.int(0, 4),
      }));
      const capacity = r.between(20, 120);
      const packed = knapsack(items, capacity);
      expect(packed.value).toBeCloseTo(bruteForce(items, capacity), 9);
      const weight = packed.counts.reduce((s, n, i) => s + n * (items[i]?.weight ?? 0), 0);
      expect(weight).toBeLessThanOrEqual(capacity + 1e-9);
      expect(packed.weight).toBeCloseTo(weight, 9);
      for (const [i, n] of packed.counts.entries()) {
        expect(n).toBeLessThanOrEqual(items[i]?.limit ?? 0);
      }
    }
  });
});

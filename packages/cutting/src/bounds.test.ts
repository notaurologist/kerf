import { describe, expect, it } from 'vitest';
import { firstFitDecreasing } from './baseline.ts';
import { materialBound, relaxation } from './bounds.ts';
import { measure } from './check.ts';
import type { Instance } from './instance.ts';
import { benchmarkInstances } from './sources.ts';

const pieces = (...lengths: number[]) =>
  lengths.map((length, i) => ({ partId: `${i}`, name: `${i}`, length }));

describe('bounds on hand-worked examples', () => {
  // Three 45" pieces on 10' boards with no kerf or trim. Two fit a board (90" of 120"), three do
  // not (135"). The relaxation cuts 1.5 boards, 15 ft, and a plan's feet are a multiple of 10, so
  // the bound is 20 ft. The material bound: 135" needs more than one board's 120", so 20 ft.
  it('rounds the relaxation up to a whole number of boards', () => {
    const instance: Instance = {
      nominal: 'x',
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
    const instance: Instance = {
      nominal: 'x',
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

  it('leaves out pieces no length holds', () => {
    const instance: Instance = {
      nominal: 'x',
      lengths: [8],
      pieces: pieces(200, 40),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(relaxation(instance).bound).toBe(8);
    expect(materialBound(instance)).toBe(8);
  });

  it('refuses lengths that are not whole feet', () => {
    const instance: Instance = {
      nominal: 'x',
      lengths: [8.5],
      pieces: pieces(40),
      kerf: 0,
      trimPerEnd: 0,
    };
    expect(() => materialBound(instance)).toThrow('whole feet');
  });
});

describe('bounds on every benchmark instance', () => {
  const instances = benchmarkInstances({ sweepCount: 30, seed: 544 });

  it.each(instances.map((s) => [s.source, s.instance] as const))('%s', (_, instance) => {
    const baseline = measure(firstFitDecreasing(instance)).feet;
    const lp = relaxation(instance);
    // A bound above a plan that exists would be wrong.
    expect(materialBound(instance)).toBeLessThanOrEqual(baseline);
    expect(lp.bound).toBeLessThanOrEqual(baseline);
    // The relaxation's boards cover every piece and cost its value.
    lp.types.forEach((type, i) => {
      const cut = lp.patterns.reduce(
        (sum, p, j) => sum + (p.counts[i] ?? 0) * (lp.boards[j] ?? 0),
        0,
      );
      expect(cut).toBeGreaterThanOrEqual(type.demand - 1e-6);
    });
    const cost = lp.patterns.reduce((sum, p, j) => sum + p.feet * (lp.boards[j] ?? 0), 0);
    expect(cost).toBeCloseTo(lp.value, 6);
    // No pattern is worth more than its feet at the final prices, and the prices value the
    // pieces at the same total (strong duality).
    for (const p of lp.patterns) {
      const worth = p.counts.reduce((sum, n, i) => sum + n * (lp.prices[i] ?? 0), 0);
      expect(worth).toBeLessThanOrEqual(p.feet + 1e-6);
    }
    const priced = lp.types.reduce((sum, t, i) => sum + t.demand * (lp.prices[i] ?? 0), 0);
    expect(priced).toBeCloseTo(lp.value, 6);
  });
});

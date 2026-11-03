import { describe, expect, it } from 'vitest';
import { seeded } from './random.ts';

describe('seeded', () => {
  it('gives the same values for the same seed', () => {
    const a = seeded(7);
    const b = seeded(7);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it('stays within its ranges', () => {
    const r = seeded(1);
    const values = Array.from({ length: 1000 }, () => r.between(0.625, 1));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.625);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    const ints = new Set(Array.from({ length: 1000 }, () => r.int(1, 4)));
    expect([...ints].sort()).toEqual([1, 2, 3, 4]);
  });
});

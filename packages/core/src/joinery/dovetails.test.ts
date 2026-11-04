import { describe, expect, it } from 'vitest';
import { SOURCES } from '../design-values/sources.ts';
import {
  DOVETAIL_SLOPE_SOURCES,
  DOVETAIL_SLOPES,
  dovetailGeometry,
  suggestDovetailLayout,
} from './dovetails.ts';

// Hand-checked. A drawer corner 5-1/2 wide, its pin board 3/4 thick, at 1:8 with 3/8 half pins and
// 1/4 pins: 3 tails, each (5.5 − 0.75 − 2 × 0.25) / 3 = 1.41667 wide at the end. Each wall moves
// 0.75 / 8 = 0.09375 by the baseline, so a tail is 1.41667 − 0.1875 = 1.22917 there.
// Walls at the end: 0.375, 1.79167 | 2.04167, 3.45833 | 3.70833, 5.125 (and 5.125 + 0.375 = 5.5).

const layout = { tails: 3, slope: 8, halfPin: 0.375, pin: 0.25 };

describe('dovetailGeometry', () => {
  it('lays out 3 tails across 5-1/2 at 1:8, each wall 3/32 in by a 3/4 baseline', () => {
    const g = dovetailGeometry(layout, 5.5, 0.75);
    expect(g?.tailWide).toBeCloseTo(1.416667, 6);
    expect(g?.tailNarrow).toBeCloseTo(1.229167, 6);
    expect(g?.offset).toBe(0.09375);
    const outside = [0.375, 1.791667, 2.041667, 3.458333, 3.708333, 5.125];
    const inside = [0.46875, 1.697917, 2.135417, 3.364583, 3.802083, 5.03125];
    expect(g?.sides).toHaveLength(6);
    g?.sides.forEach((s, i) => {
      expect(s.outside).toBeCloseTo(outside[i] as number, 6);
      expect(s.inside).toBeCloseTo(inside[i] as number, 6);
    });
  });

  it('gives nothing when a tail comes to nothing at the baseline, or has no room at the end', () => {
    // At 1:1 each wall moves 3/4: 1.41667 − 1.5 < 0.
    expect(dovetailGeometry({ ...layout, slope: 1 }, 5.5, 0.75)).toBeUndefined();
    // 2 × 3/8 + 2 × 1/4 = 1.25 leaves nothing of a 1-1/4 width for the tails.
    expect(dovetailGeometry(layout, 1.25, 0.75)).toBeUndefined();
  });
});

describe('suggestDovetailLayout', () => {
  it('takes the fewest tails no more than 2" apart on center', () => {
    // 5.5 − 0.75 + 0.25 = 5 across the centers: 3 tails, 1.667 apart.
    expect(suggestDovetailLayout(5.5, 8, 0.75)).toEqual(layout);
    // 4.5 − 0.5 = 4: 2 tails exactly 2 apart, not 3.
    expect(suggestDovetailLayout(4.5, 6, 0.75)?.tails).toBe(2);
    // 4.5625 − 0.5 = 4.0625: one past 2 apart, so 3.
    expect(suggestDovetailLayout(4.5625, 6, 0.75)?.tails).toBe(3);
  });

  it('suggests nothing when one tail would be closer than 3/4" on center', () => {
    // 1.75 − 0.5 = 1.25 for one tail: fine. 1.2 − 0.5 = 0.7: under 3/4.
    expect(suggestDovetailLayout(1.75, 8, 0.5)?.tails).toBe(1);
    expect(suggestDovetailLayout(1.2, 8, 0.5)).toBeUndefined();
  });
});

describe('slopes', () => {
  it('are 1:6 in softwood and 1:8 in hardwood, from two cited sources', () => {
    expect(DOVETAIL_SLOPES).toEqual({ softwood: 6, hardwood: 8 });
    for (const c of DOVETAIL_SLOPE_SOURCES) expect(SOURCES[c.source]).toBeDefined();
    expect(DOVETAIL_SLOPE_SOURCES.map((c) => c.source)).toEqual([
      'wikipedia-dovetail-joint',
      'fww-laying-out-dovetails',
    ]);
  });
});

import { fitProblems, hardwareList } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { base, ILLUSTRATIVE } from './design.ts';
import { EXAMPLE } from './params.ts';
import { workbench } from './review.ts';

// The spec's structural example (docs/templates/workbench.md, Structural model), worked by hand:
// flatsawn black cherry from 6% to 10%, C_T = 0.00248 per % (Wood Handbook, Table 13-5), so each
// inch across the grain moves 0.00248 × 4 = 0.00992; E = 1,490,000 psi; 300 lb on the top; L/144.
const cherry = {
  species: 'black-cherry',
  orientation: 'flatsawn' as const,
  moisture: { low: 6, high: 10 },
  topLoad: 300,
  deflectionLimit: 144,
};

function sized(inputs: Parameters<typeof workbench>[1]) {
  const made = workbench(EXAMPLE, inputs);
  if (!made.ok) throw new Error(made.message);
  return made;
}

describe('the workbench review', () => {
  it('sizes each movement joint from the movement across its span', () => {
    // Top between its tenons, 13-5/8: 0.135160 + 1/16. Back across 45-1/8: 0.447640 / 2 + 1/32.
    // Drawer bottom from its front groove, 13-3/4: 0.136400 + 1/32. Door panel across 18-27/32:
    // 0.186930 / 2 + 1/32.
    const { gaps } = sized(cherry).review;
    expect(gaps.topRoom).toBeCloseTo(0.19766, 5);
    expect(gaps.backEdge).toBeCloseTo(0.25507, 5);
    expect(gaps.bottomFront).toBeCloseTo(0.16765, 5);
    expect(gaps.doorPanelEdge).toBeCloseTo(0.124715, 5);
  });

  it('measures the same spans with the gaps as without them', () => {
    const first = base(EXAMPLE, ILLUSTRATIVE);
    if (!first.ok) throw new Error(first.message);
    const again = sized(cherry).base.geometry.spans;
    for (const [key, value] of Object.entries(first.base.geometry.spans)) {
      expect(again[key as keyof typeof again]).toBeCloseTo(value, 12);
    }
  });

  it('cuts the parts to the sized gaps, and they still go together', () => {
    // The back: 45-1/8 − 2 × 0.255070 = 44.614860 wide.
    const made = sized(cherry);
    const back = made.base.parts.find((q) => q.id === 'case-back');
    expect(back?.stock.width).toBeCloseTo(44.61486, 5);
    expect(fitProblems(made.base, hardwareList(made.base.hardware))).toEqual([]);
  });

  it('checks the top’s deflection: 10.6x under L/144 for the example', () => {
    // Span 51-7/8 − 3 = 48.875; I = 17.625 × 2.5³ / 12 = 22.94922; immediate 300 × 48.875³ /
    // (48 × 1,490,000 × 22.94922) = 0.021340; long-term × 1.5 = 0.032009; limit 48.875 / 144 =
    // 0.339410; margin 0.339410 / 0.032009 = 10.6035.
    const { deflection } = sized(cherry).review;
    expect(deflection).toMatchObject({ status: 'computed' });
    if (deflection.status === 'computed') expect(deflection.margin).toBeCloseTo(10.6035, 3);
  });

  it('asks for what is missing, and sizes the gaps for the wood that moves most meanwhile', () => {
    const made = sized({});
    expect(made.review.deflection).toMatchObject({ status: 'input-needed' });
    expect(made.review.movement.every((m) => m.status === 'input-needed')).toBe(true);
    const { gaps } = made.review;
    const fromCherry = sized(cherry).review.gaps;
    expect(gaps.backEdge).toBeGreaterThan(fromCherry.backEdge);
    expect(fitProblems(made.base, hardwareList(made.base.hardware))).toEqual([]);
  });
});

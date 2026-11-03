import { describe, expect, it } from 'vitest';
import type { CheckResult } from '../../structural/types.ts';
import { deeperBeams } from './deeperStock.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';
import type { SwingSetParams } from './params.ts';
import type { SwingSetStructuralInputs } from './structural.ts';

// The bending check in the next deeper stock (spec, Structural model, Deeper stock). Worked
// example 1's loads: hangers 8,625 lb·in per unit factor at the inner hangers, 9/16" hole down
// through the beam. Hand-checked separately from the code (spec, Worked examples).

const example = EXAMPLES[0];
if (!example) throw new Error('no worked example');

function bending(params: Partial<SwingSetParams>, inputs: SwingSetStructuralInputs) {
  const made = swingSetAFrame.generate({ ...example?.params, ...params } as SwingSetParams, inputs);
  if (!made.ok) throw new Error('worked example should generate');
  return made.output.structuralReview.beam.bending as Extract<
    CheckResult,
    { status: 'computed' | 'input-needed' }
  >;
}

describe('the next deeper beams', () => {
  it('are those at the next depth, no narrower, narrowest first', () => {
    const sizes = (beamStock: SwingSetParams['beamStock'], beamPlies: number) =>
      deeperBeams({ beamStock, beamPlies }).map((s) => `${s.beamPlies}x ${s.beamStock}`);
    // A 4x6, 5.5 deep and 3.5 wide: two plies of 2x8 (3.0) and one 2x8 (1.5) are narrower.
    expect(sizes('4x6', 1)).toEqual(['1x 4x8', '3x 2x8']);
    expect(sizes('2x6', 2)).toEqual(['2x 2x8', '1x 4x8', '3x 2x8']);
    expect(sizes('4x4', 1)).toEqual(['1x 4x6', '3x 2x6', '1x 6x6']);
    // Nothing in Kerf's sizes is deeper than 7-1/4".
    expect(sizes('4x8', 1)).toEqual([]);
    expect(sizes('2x8', 3)).toEqual([]);
  });
});

describe('worked example 1, bending in the next deeper stock', () => {
  const b = bending({}, example.structuralInputs);

  it("gives the 4x8's margin and break-even factor", () => {
    // Fb = 925 (Table 4B, 8" wide); ℓu/d = 13.45, so ℓe = 1.63·97.5 + 3·7.25 = 180.675;
    // R_B = 10.3407, F_bE = 5151.0, C_L = 0.98931, Fb' = 915.12. S_net = 2.9375·7.25²/6 = 25.7337.
    // w = 0.571825 lb/in gives 650.90 at the inner hangers: C = (23,549.6 − 650.90) / 8,625.
    const [solid] = b.deeperStock ?? [];
    expect(solid?.subject).toBe('Top beam, 4x8');
    expect(solid?.breakEven.value).toBeCloseTo(2.6549, 4);
    expect(solid?.margin).toBeCloseTo(1.3155, 4);
  });

  it('gives three plies of 2x8 per ply, the middle ply losing the hole', () => {
    // Per ply b = 1.5: R_B = 24.1283, F_bE = 946.1, C_L = 0.82629, Fb' = 764.32. The middle ply
    // keeps 0.9375: S_net = 8.2129. Per ply the hangers give 2,875 per unit factor and the weight
    // 278.96: C = (6,277.3 − 278.96) / 2,875.
    const [, plies] = b.deeperStock ?? [];
    expect(plies?.subject).toBe('Top beam, 3 plies of 2x8');
    expect(plies?.breakEven.value).toBeCloseTo(2.0864, 4);
    expect(plies?.margin).toBeCloseTo(1.0412, 4);
  });

  it('compares built-up beams though the plan has no ply bolts, which bending does not read', () => {
    expect(example.params.hardware.plyBolts).toBeUndefined();
    expect(b.deeperStock).toHaveLength(2);
  });

  it('keeps the plan as it is', () => {
    expect(b.subject).toBe('Top beam, 4x6');
    expect(b.breakEven?.value).toBeCloseTo(1.6454, 4);
  });

  it('gives the break-even factor alone while the factor is missing', () => {
    const missing = bending({}, { ...example.structuralInputs, dynamicFactor: undefined });
    expect(missing.status).toBe('input-needed');
    expect(missing.deeperStock?.map((s) => s.margin)).toEqual([undefined, undefined]);
    expect(missing.deeperStock?.[0]?.breakEven.value).toBeCloseTo(2.6549, 4);
  });

  it('is empty for a 4x8, the deepest stock Kerf has', () => {
    expect(bending({ beamStock: '4x8' }, example.structuralInputs).deeperStock).toEqual([]);
  });

  it('is left out while bending has no break-even factor', () => {
    expect(bending({}, {}).deeperStock).toBeUndefined();
  });

  it('leaves out a size with no design values: a 6x6 is a timber size', () => {
    const from4x4 = bending({ beamStock: '4x4' }, example.structuralInputs);
    expect(from4x4.deeperStock?.map((s) => s.subject)).toEqual([
      'Top beam, 4x6',
      'Top beam, 3 plies of 2x6',
    ]);
  });
});

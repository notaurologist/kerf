import { describe, expect, it } from 'vitest';
import { type SuggestedValue, withSuggested } from '../../model/suggested.ts';
import { createSnapshot } from '../../snapshot/snapshot.ts';
import type { CheckResult, ComputedCheck } from '../../structural/types.ts';
import { VERDICT_WORDS } from '../../testing.ts';
import { swingSetAFrame } from './definition.ts';
import type { SwingSetParams } from './params.ts';
import { suggest } from './questions.ts';
import {
  beamSupports,
  pendulumFactor,
  type SwingSetStructuralReview,
  structuralReview,
} from './structural.ts';
import { generate, type SwingSetOutput } from './template.ts';

// Worked examples from docs/templates/swing-set-a-frame.md, Structural model. The geometry is the
// spec's worked example: the beam bears on the middle of each gusset's top edge, at
// 12 − 1.5/2 = 11.25 and 120 − 11.25 = 108.75 (span 97.5), hangers at 30, 50, 70, 90.
// Expected values were computed by hand, separately from the code (see the spec). The beam is at
// 30% moisture content: Southern Pine density 38.940 lb/ft³, so a 4x6 weighs w = 0.433798 lb/in.
// Each hanger hangs from a 1/2" bolt down through the beam, in a 9/16" hole, so bending at each
// hanger is on a net breadth of 3.5 − 0.5625 = 2.9375: S_net = 2.9375·5.5²/6 = 14.809896.

const params: SwingSetParams = {
  beamLength: 120,
  beamHeight: 96,
  splay: { kind: 'angle', degrees: 20 },
  beamStock: '4x6',
  beamPlies: 1,
  legStock: '4x4',
  crossbarStock: '2x6',
  crossbarHeight: 40,
  gussetStock: '2x8',
  frameInset: 12,
  groundSlope: 1,
  burialDepth: 24,
  swings: { centers: [40, 80], hangerSpacing: 20, seatWidth: 20, seatHeight: 16 },
  hardware: {
    legBoltDiameter: 0.5,
    crossbarBolts: { diameter: 0.5, perJoint: 2 },
    gussetBolts: { diameter: 0.5, perJoint: 2 },
    hangerMounting: { kind: 'vertical-bolt', diameter: 0.5 },
  },
};

const twoPly: SwingSetParams = {
  ...params,
  beamStock: '2x6',
  beamPlies: 2,
  hardware: { ...params.hardware, plyBolts: { diameter: 0.5, count: 6 } },
};

const inputs = {
  beamSpeciesGrade: 'southern-pine-no2',
  beamIncised: false,
  beamMoistureContent: 30,
  riderWeights: [150, 150],
  maxSwingAngle: 60,
  dynamicFactor: 2,
  deflectionLimit: 240,
  hangerRating: 1200,
};

function output(p: SwingSetParams): SwingSetOutput {
  const result = generate(p);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output;
}

function review(p: SwingSetParams, i: unknown): SwingSetStructuralReview {
  const result = structuralReview(output(p), i);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.review;
}

function computed(r: CheckResult): ComputedCheck {
  if (r.status !== 'computed') throw new Error(`Expected a computed check: ${JSON.stringify(r)}`);
  return r;
}

const step = (r: ComputedCheck, symbol: string) => r.steps.find((s) => s.symbol === symbol)?.value;

describe('swing load', () => {
  it('is W·(3 − 2·cos θ): 1 at rest, 2 at 60°, 3 at 90°', () => {
    expect(pendulumFactor(0)).toBeCloseTo(1, 12);
    expect(pendulumFactor(60)).toBeCloseTo(2, 12);
    expect(pendulumFactor(90)).toBeCloseTo(3, 12);
  });
});

describe('example 1: 4x6 Southern Pine No.2, 150 lb riders on both swings, θ = 60°, dynamic factor 2', () => {
  // T = 150·2 = 300 per swing; per hanger 150 (deflection), 300 (strength).
  const r = review(params, inputs);

  // ℓu/d = 97.5/5.5 = 17.7 > 14.3, so ℓe = 1.84·97.5 = 179.4; R_B = √(179.4·5.5/3.5²) = 8.9748,
  // F_bE = 1.20·459,000/8.9748² = 6,838.2, C_L = 0.99159, Fb' = 991.59.
  // At the inner hangers (38.75 from the left support) the hangers give 600·38.75 − 300·20 =
  // 17,250 and the beam's weight w·(48.75·38.75 − 38.75²/2) = 493.78, so M = 17,743.78 and
  // f_b = 17,743.78 / 14.809896 = 1198.10, above the gross section's 1006.78 at midspan.
  it('bending: 17,765.47 at midspan on the gross section, 17,743.78 at the inner hangers on the net section, margin 0.83', () => {
    const b = computed(r.beam.bending);
    expect(b.inputs.find((q) => q.symbol === 'L')?.value).toBeCloseTo(97.5, 9);
    expect(step(b, 'R1')).toBeCloseTo(621.1477, 3);
    expect(step(b, 'M')).toBeCloseTo(17765.474, 2);
    expect(step(b, 'f_b,M')).toBeCloseTo(1006.7801, 3);
    expect(b.factors.find((f) => f.symbol === 'C_L')?.value).toBeCloseTo(0.991591, 5);
    expect(step(b, 'M_h1')).toBeCloseTo(11570.265, 2);
    expect(step(b, 'M_h2')).toBeCloseTo(17743.78, 2);
    expect(step(b, 'b_net,2')).toBeCloseTo(2.9375, 9);
    expect(step(b, 'S_net,2')).toBeCloseTo(14.809896, 5);
    expect(step(b, 'x_f')).toBeCloseTo(50, 9);
    expect(b.computed).toMatchObject({
      label: 'Bending stress at left swing, right hanger hole, net section',
    });
    expect(b.computed.value).toBeCloseTo(1198.1, 2);
    expect(b.allowable.value).toBeCloseTo(991.5913, 3);
    expect(b.margin).toBeCloseTo(0.82763, 4);
    expect(b.sources.map((c) => c.locator)).toContain('3.1.2.1, p. 16');
  });

  it('says where the hanger holes are and that deflection uses the gross section', () => {
    const b = computed(r.beam.bending);
    expect(b.assumptions).toContain(
      'Each hanger\'s bolt goes down through the beam on its centerline, in a 9/16" hole (the bolt plus 1/16", NDS 2024 12.1.3.2).',
    );
    expect(computed(r.beam.deflection).assumptions).toContain(
      "Deflection uses the beam's gross section; the holes are not deducted from its stiffness.",
    );
  });

  it('says the beam bears on the gussets, and why that span (NDS 2024 3.2.1)', () => {
    const b = computed(r.beam.bending);
    expect(b.assumptions).toContain(
      'Supported at the middle of each gusset\'s top edge under the beam, 11-1/4" and 108-3/4" from the left end. The beam rests on the gussets, and the leg-to-beam bolts sit in holes 1/16" larger than the bolt, so the gussets take the beam\'s weight and the swing loads first.',
    );
    expect(b.assumptions.some((a) => a.startsWith('NDS 2024 3.2.1 takes the span'))).toBe(true);
  });

  it('shows the beam weight working', () => {
    const b = computed(r.beam.bending);
    expect(b.inputs.find((q) => q.symbol === 'ρ')?.value).toBeCloseTo(38.940432, 5);
    expect(b.inputs.find((q) => q.symbol === 'w')?.value).toBeCloseTo(0.433798, 6);
  });

  it('shear: V = 600 + wL/2 = 621.15, f_v = 48.40, margin 3.51', () => {
    const s = computed(r.beam.shear);
    expect(s.computed.value).toBeCloseTo(48.4011, 3);
    expect(s.margin).toBeCloseTo(3.50715, 4);
  });

  it('deflection: δ·EI = 8,629,492 + 5wL⁴/384 = 9,139,933, δ = 0.1495 at x = 60, margin 2.72', () => {
    const d = computed(r.beam.deflection);
    expect(d.computed.value).toBeCloseTo(0.149485, 5);
    expect(step(d, 'x_max')).toBeCloseTo(60, 6);
    expect(d.allowable.value).toBeCloseTo(0.40625, 5);
    expect(d.margin).toBeCloseTo(2.71766, 4);
  });

  it('hanger: 300 lb on each hanger against a 1200 lb rating, margin 4.0', () => {
    expect(computed(r.hanger).margin).toBeCloseTo(4, 9);
  });

  // At factor C, at the inner hangers, the hangers give 8,625·C and the beam's weight 493.78, which
  // the factor does not multiply: bending reaches Fb'·S_net = 991.5913 · 14.809896 = 14,685.37 at
  // C = (14,685.37 − 493.78) / 8,625 = 1.6454. Shear reaches Fv'·2bd/3 = 2,178.46 at
  // C = (2,178.46 − 21.15) / 300 = 7.1910. The hanger reaches 1,200 at C = 1,200 / 150 = 8.
  it('reports the dynamic factor at which each strength check reaches margin 1.0 (#401)', () => {
    expect(computed(r.beam.bending).breakEven).toMatchObject({ key: 'dynamicFactor' });
    expect(computed(r.beam.bending).breakEven?.value).toBeCloseTo(1.6454, 4);
    expect(computed(r.beam.shear).breakEven?.value).toBeCloseTo(7.191036, 5);
    expect(computed(r.hanger).breakEven?.value).toBeCloseTo(8, 9);
    // Not margin × factor (1.655): the beam's weight is not multiplied.
    expect(computed(r.beam.bending).breakEven?.value).not.toBeCloseTo(0.82763 * 2, 3);
    expect(computed(r.beam.deflection).breakEven).toBeUndefined();
  });

  it('lists the factor after the loads it multiplies', () => {
    const b = computed(r.beam.bending);
    expect(b.inputs.find((q) => q.symbol === 'C_dyn')).toMatchObject({
      value: 2,
      basis: 'Entered',
    });
    expect(b.formulas[0]).toContain('C_dyn');
    const h = computed(r.hanger);
    expect(h.inputs.find((q) => q.symbol === 'T / 2')?.value).toBeCloseTo(150, 9);
    expect(h.computed.value).toBeCloseTo(300, 9);
  });

  it('uses the stated service conditions', () => {
    const b = computed(r.beam.bending);
    const f = (s: string) => b.factors.find((x) => x.symbol === s)?.value;
    expect(f('C_D')).toBe(1);
    expect(f('C_r')).toBe(1);
    expect(computed(r.beam.shear).allowable.value).toBeCloseTo(175 * 0.97, 9);
  });
});

describe('where the beam bears on each frame', () => {
  // The gusset (a 2x8, 1.5 thick) sits on each frame's outside face, from e − 1.5 to e.
  it('bears on the whole gusset when the frame inset is at least its thickness: 11.25, 108.75', () => {
    expect(beamSupports(output(params))).toEqual({ x: [11.25, 108.75], on: 'gusset' });
  });

  it('bears on the part of the gusset under the beam when the inset is less: 0.5, 119.5', () => {
    // e = 1: the gusset runs from −0.5 to 1, so the beam bears from 0 to 1.
    expect(beamSupports(output({ ...params, frameInset: 1 }))).toEqual({
      x: [0.5, 119.5],
      on: 'gusset',
    });
  });

  it('hangs on the leg-to-beam bolts with no gusset under the beam: 1.75, 118.25', () => {
    // e = 0: the gusset is past the beam's end; the bolts are at e + 3.5/2.
    const p = { ...params, frameInset: 0 };
    expect(beamSupports(output(p))).toEqual({ x: [1.75, 118.25], on: 'bolt' });
    expect(computed(review(p, inputs).beam.bending).assumptions[0]).toMatch(
      /^Supported at the leg-to-beam bolts, 1-3\/4" and 118-1\/4" from the left end\./,
    );
  });
});

describe('example 2: asymmetric, 200 lb on the left swing and 80 lb on the right', () => {
  // Strength hanger loads 400, 400, 160, 160, at 18.75, 38.75, 58.75, 78.75 from the left
  // support. R1 = (400·137.5 + 160·57.5)/97.5 + wL/2 = 658.462 + 21.148 = 679.609; M under the
  // second hanger = 679.609·38.75 − 400·20 − w·38.75²/2 = 18,009.17, the largest moment and at a
  // hanger hole: f_b = 18,009.17 / 14.809896 = 1216.02, margin 0.8154.
  const r = review(params, { ...inputs, riderWeights: [200, 80] });

  it('matches the hand calculation', () => {
    const b = computed(r.beam.bending);
    expect(step(b, 'R1')).toBeCloseTo(679.6092, 3);
    expect(step(b, 'R2')).toBeCloseTo(482.6861, 3);
    expect(step(b, 'M')).toBeCloseTo(18009.169, 2);
    expect(step(b, 'f_b,M')).toBeCloseTo(1020.5905, 3);
    expect(b.computed.value).toBeCloseTo(1216.02, 2);
    expect(b.margin).toBeCloseTo(0.81544, 4);
    expect(computed(r.beam.shear).margin).toBeCloseTo(3.20546, 4);
    const d = computed(r.beam.deflection);
    expect(d.computed.value).toBeCloseTo(0.140282, 5);
    expect(step(d, 'x_max')).toBeCloseTo(58.2907, 3);
    expect(d.margin).toBeCloseTo(2.89594, 4);
  });

  it('checks the most loaded hanger: 400 lb, margin 3.0', () => {
    const h = computed(r.hanger);
    expect(h.computed.value).toBeCloseTo(400, 9);
    expect(h.margin).toBeCloseTo(3, 9);
  });
});

describe('example 3: two-ply 2x6 beam, same loads as example 1', () => {
  // Each ply carries half of every load, including half the beam's weight (w = 0.371827 lb/in for
  // both plies): M = 8625 + 0.185914·97.5²/8 = 8845.92 per ply, S = 7.5625. R_B = √(179.4·5.5/1.5²)
  // = 20.9412, F_bE = 1.20·459,000/20.9412² = 1,256.0, C_L = 0.89116, Fb' = 891.16. The hanger
  // bolt's 9/16" hole is centered on the seam between the plies, so each ply loses 0.28125 of its
  // 1.5: S_net = 1.21875·5.5²/6 = 6.144531. At the inner hangers M = 8,625 + 0.185914·(48.75·38.75 −
  // 38.75²/2) = 8,836.62 per ply, f_b = 1438.13, margin 0.6197.
  const r = review(twoPly, inputs);

  it('bending margin is below 1 for these inputs: 0.62 at the inner hangers', () => {
    const b = computed(r.beam.bending);
    expect(step(b, 'M')).toBeCloseTo(8845.918, 2);
    expect(step(b, 'f_b,M')).toBeCloseTo(1169.7081, 3);
    expect(b.factors.find((f) => f.symbol === 'C_L')?.value).toBeCloseTo(0.891163, 5);
    expect(step(b, 'r,2')).toBeCloseTo(0.28125, 9);
    expect(step(b, 'S_net,2')).toBeCloseTo(6.144531, 5);
    expect(step(b, 'M_h2')).toBeCloseTo(8836.62, 2);
    expect(b.computed.value).toBeCloseTo(1438.13, 2);
    expect(b.margin).toBeCloseTo(0.61967, 4);
  });

  it('shear and deflection', () => {
    expect(computed(r.beam.shear).margin).toBeCloseTo(3.02082, 4);
    expect(computed(r.beam.deflection).computed.value).toBeCloseTo(0.173008, 5);
    expect(computed(r.beam.deflection).margin).toBeCloseTo(2.34816, 4);
  });

  // Per ply at the inner hangers: the hangers give 4,312.5·C and the weight 211.62;
  // Fb'·S_net = 891.1625 · 6.144531 = 5,475.78, reached at C = (5,475.78 − 211.62) / 4,312.5 =
  // 1.2207.
  it('reaches margin 1.0 in bending at a dynamic factor of 1.221', () => {
    expect(computed(r.beam.bending).breakEven?.value).toBeCloseTo(1.22068, 4);
  });

  it('puts ply fastening on the checklist', () => {
    expect(r.checklist.some((c) => c.element.startsWith('Beam plies'))).toBe(true);
  });
});

describe('bolts sideways through the beam, two-ply 2x6', () => {
  // 3/8" bolts in 7/16" holes, centers 1.5 above the beam's bottom, through both plies. Per ply,
  // b = 1.5, d = 5.5, D = 0.4375, h = 1.5: A = 1.5·5.0625 = 7.59375; ȳ = (1.5·5.5·2.75 −
  // 1.5·0.4375·1.5) / 7.59375 = 2.858025; I = 20.796875 + 8.25·0.108025² − (0.010468 +
  // 0.65625·1.358025²) = 19.672403; c = 2.858025; S_net = 6.883217. f_b = 8,836.62 / 6.883217 =
  // 1283.79, margin 891.16 / 1283.79 = 0.6942.
  const p: SwingSetParams = {
    ...twoPly,
    hardware: {
      ...twoPly.hardware,
      hangerMounting: { kind: 'horizontal-bolts', diameter: 0.375, perHanger: 2, holeHeight: 1.5 },
    },
  };
  const b = computed(review(p, inputs).beam.bending);

  it('takes the net section with the neutral axis moved: S_net 6.8832, margin 0.69', () => {
    expect(step(b, 'ȳ,2')).toBeCloseTo(2.858025, 5);
    expect(step(b, 'I_net,2')).toBeCloseTo(19.672403, 4);
    expect(step(b, 'S_net,2')).toBeCloseTo(6.883217, 5);
    expect(b.computed.value).toBeCloseTo(1283.79, 2);
    expect(b.margin).toBeCloseTo(0.69417, 4);
  });

  it('says one hole is in the section at each hanger', () => {
    expect(b.assumptions.some((a) => a.includes('1-1/2" above its bottom, in 7/16" holes'))).toBe(
      true,
    );
  });
});

describe('hanger mounting', () => {
  it('holds bending, not shear or deflection, until the mounting is entered', () => {
    const { hangerMounting: _, ...hardware } = params.hardware;
    const r = review({ ...params, hardware }, inputs);
    expect(r.beam.bending).toMatchObject({
      status: 'input-needed',
      missing: [{ key: 'hardware.hangerMounting', label: 'Swing hanger mounting' }],
    });
    expect(r.beam.bending).not.toHaveProperty('breakEven');
    expect(r.beam.shear.status).toBe('computed');
    expect(r.beam.deflection.status).toBe('computed');
  });

  it('lists the mounting among the other missing inputs', () => {
    const { hangerMounting: _, ...hardware } = params.hardware;
    const r = review({ ...params, hardware }, {});
    const missing = r.beam.bending.status === 'input-needed' ? r.beam.bending.missing : [];
    expect(missing.map((m) => m.key)).toContain('hardware.hangerMounting');
  });

  it('leaves bending not computed for another mounting, citing NDS 2024 3.1.2.1', () => {
    const r = review(
      { ...params, hardware: { ...params.hardware, hangerMounting: { kind: 'other' } } },
      inputs,
    );
    expect(r.beam.bending).toMatchObject({ status: 'not-computed' });
    if (r.beam.bending.status !== 'not-computed') return;
    expect(r.beam.bending.reason).toMatch(/fastened some other way than with bolts/);
    expect(r.beam.bending.sources.map((c) => c.locator)).toEqual(['3.1.2.1, p. 16']);
    expect(r.beam.shear.status).toBe('computed');
  });
});

describe('missing inputs', () => {
  it('reports input needed for every check when nothing is entered', () => {
    const r = review(params, {});
    expect(r.beam.bending).toMatchObject({ status: 'input-needed' });
    expect(r.beam.shear).toMatchObject({ status: 'input-needed' });
    expect(r.beam.deflection).toMatchObject({ status: 'input-needed' });
    expect(r.hanger).toMatchObject({ status: 'input-needed' });
    const keys = (c: CheckResult) =>
      c.status === 'input-needed' ? c.missing.map((m) => m.key) : [];
    expect(keys(r.beam.bending)).toEqual([
      'beamSpeciesGrade',
      'beamIncised',
      'riderWeights',
      'maxSwingAngle',
      'beamMoistureContent',
      'dynamicFactor',
    ]);
    expect(keys(r.hanger)).toEqual([
      'riderWeights',
      'maxSwingAngle',
      'dynamicFactor',
      'hangerRating',
    ]);
  });

  it('computes deflection without the dynamic factor, and holds the strength checks', () => {
    const { dynamicFactor: _, ...rest } = inputs;
    const r = review(params, rest);
    expect(r.beam.deflection.status).toBe('computed');
    expect(r.beam.bending).toMatchObject({
      status: 'input-needed',
      missing: [{ key: 'dynamicFactor' }],
    });
    expect(r.hanger).toMatchObject({ status: 'input-needed', missing: [{ key: 'dynamicFactor' }] });
  });

  it('reports the break-even factor while the dynamic factor is missing, the same as when entered', () => {
    const { dynamicFactor: _, ...rest } = inputs;
    const r = review(params, rest);
    const entered = review(params, inputs);
    for (const [held, done] of [
      [r.beam.bending, entered.beam.bending],
      [r.beam.shear, entered.beam.shear],
      [r.hanger, entered.hanger],
    ] as const) {
      expect(held.status).toBe('input-needed');
      expect(held.status === 'input-needed' && held.breakEven).toEqual(
        done.status === 'computed' && done.breakEven,
      );
    }
  });

  it('needs every other input for the break-even factor', () => {
    const { dynamicFactor: _, hangerRating: __, beamMoistureContent: ___, ...rest } = inputs;
    const r = review(params, rest);
    expect(r.beam.bending).not.toHaveProperty('breakEven');
    expect(r.hanger).not.toHaveProperty('breakEven');
  });

  it('holds the beam checks, not the hanger, until the moisture content is entered', () => {
    const { beamMoistureContent: _, ...rest } = inputs;
    const r = review(params, rest);
    expect(r.beam.deflection).toMatchObject({
      status: 'input-needed',
      missing: [{ key: 'beamMoistureContent' }],
    });
    expect(r.hanger.status).toBe('computed');
  });

  it('rejects values out of range at the boundary', () => {
    const result = structuralReview(output(params), { ...inputs, maxSwingAngle: 120 });
    expect(result.ok).toBe(false);
    expect(structuralReview(output(params), { ...inputs, riderWeights: [0, 0] }).ok).toBe(false);
  });
});

describe('example 4: uplift at the feet on pads (spec, Structural model)', () => {
  // The worked example on pads: d = 0, ground falling 1"/ft toward the front. Back foot at
  // z_b = 3.1182, y_b = 3.61232 + 92.8818·tan 20° = 37.4185; front foot at z_f = −3.3133,
  // y_f = −(3.61232 + 99.3133·tan 20°) = −39.7594. Riders 200 and 80: the left frame carries
  // (100·(78.75 + 58.75) + 40·(38.75 + 18.75)) / 97.5 = 164.615. The beam's weight on each frame
  // is 0.433798·60 = 26.0279.
  const pads: SwingSetParams = {
    ...params,
    burialDepth: 0,
    hardware: { ...params.hardware, anchorsPerFoot: 1, anchorRating: 500 },
  };
  const asymmetric = { ...inputs, riderWeights: [200, 80] };
  const value = (r: ComputedCheck, label: string) =>
    r.inputs.find((q) => q.label.startsWith(label))?.value;

  // Back foot lifting: c_v = 39.7594 / 77.1779 = 0.51517, c_h = 99.3133 / 77.1779 = 1.28681. At
  // φ = 47.14°, (3·cos φ − 1)·(c_v·cos φ − c_h·sin φ) = −0.61692, so S = 164.615·0.61692 = 101.555
  // and the weight holds D·c_v = 13.409: 2·101.555 − 13.409 = 189.70 against 500.
  it('pulls 189.70 lb on one anchor at the left back foot, margin 2.64', () => {
    const a = computed(review(pads, asymmetric).anchors as CheckResult);
    expect(a.subject).toBe('Ground anchor');
    expect(a.inputs.find((q) => q.symbol === 'y_b')?.value).toBeCloseTo(37.4185, 3);
    expect(a.inputs.find((q) => q.symbol === 'y_f')?.value).toBeCloseTo(-39.7594, 3);
    expect(a.inputs.find((q) => q.symbol === 'W_left')?.value).toBeCloseTo(164.6154, 3);
    expect(a.inputs.find((q) => q.symbol === 'D')?.value).toBeCloseTo(26.0279, 3);
    expect(a.inputs.find((q) => q.symbol === 'c_v')?.value).toBeCloseTo(0.51517, 4);
    expect(a.inputs.find((q) => q.symbol === 'c_h')?.value).toBeCloseTo(1.28681, 4);
    expect(a.inputs.find((q) => q.symbol === 'φ')?.value).toBeCloseTo(47.14, 1);
    expect(a.inputs.find((q) => q.symbol === 'S')?.value).toBeCloseTo(101.555, 2);
    expect(a.inputs.find((q) => q.symbol === 'D·c_v')?.value).toBeCloseTo(13.409, 2);
    expect(a.computed.value).toBeCloseTo(189.7, 1);
    expect(a.margin).toBeCloseTo(500 / 189.7, 2);
    // (1·500 + 13.409) / 101.555.
    expect(a.breakEven?.value).toBeCloseTo(5.0555, 3);
  });

  // At factor 1: left back 101.555 − 13.409 = 88.15, left front 94.625 − 12.619 = 82.01, right back
  // 71.183 − 13.409 = 57.77, right front 66.326 − 12.619 = 53.71.
  it('gives each foot its uplift and each frame its largest fore-and-aft force', () => {
    const a = computed(review(pads, asymmetric).anchors as CheckResult);
    expect(value(a, 'Uplift, left frame, back foot')).toBeCloseTo(88.146, 2);
    expect(value(a, 'Uplift, left frame, front foot')).toBeCloseTo(82.006, 2);
    expect(value(a, 'Uplift, right frame, back foot')).toBeCloseTo(57.774, 2);
    expect(value(a, 'Uplift, right frame, front foot')).toBeCloseTo(53.707, 2);
    // cos φ = (0.5 + √18.25) / 6 = 0.79535, sin φ·(3·cos φ − 1) = 0.84016.
    expect(a.inputs.find((q) => q.symbol === 'F_left')?.value).toBeCloseTo(0.840155 * 164.6154, 2);
    expect(a.inputs.find((q) => q.symbol === 'F_right')?.value).toBeCloseTo(0.840155 * 115.3846, 2);
  });

  // Level ground and θ = 90°, the closed form: h = 96 / 38.5535 = 2.49004, minimum
  // 0.75·(1 − √(1 + h²)) = −1.26251 at φ = 90° − atan(h)/2 = 55.94°. S = 189.376, D/2 = 13.014;
  // 2·189.376 − 13.014 = 365.74, over 2 anchors 182.87 against 250.
  it('matches the closed form on level ground at θ = 90°', () => {
    const level: SwingSetParams = {
      ...pads,
      groundSlope: 0,
      hardware: { ...pads.hardware, anchorsPerFoot: 2, anchorRating: 250 },
    };
    const a = computed(review(level, { ...inputs, maxSwingAngle: 90 }).anchors as CheckResult);
    const h =
      96 / (1.75 + 1.75 / Math.cos((20 * Math.PI) / 180) + 96 * Math.tan((20 * Math.PI) / 180));
    expect(h).toBeCloseTo(2.49004, 4);
    expect(a.inputs.find((q) => q.symbol === 'φ')?.value).toBeCloseTo(
      90 - (Math.atan(h) * 180) / Math.PI / 2,
      5,
    );
    expect(a.inputs.find((q) => q.symbol === 'S')?.value).toBeCloseTo(
      150 * 0.75 * (Math.sqrt(1 + h * h) - 1),
      6,
    );
    expect(a.computed.value).toBeCloseTo(182.87, 2);
    expect(a.margin).toBeCloseTo(1.3671, 3);
    expect(a.breakEven?.value).toBeCloseTo(2.709, 3);
    expect(a.inputs.find((q) => q.symbol === 'F_left')?.value).toBeCloseTo(225, 6);
  });

  it('is only on pads', () => {
    expect(review(params, inputs).anchors).toBeUndefined();
    expect(review(pads, inputs).anchors).toBeDefined();
  });

  it('needs the anchor count and rating, with no default, and reports the break-even factor first', () => {
    const bare: SwingSetParams = { ...pads, hardware: params.hardware };
    expect(review(bare, inputs).anchors).toMatchObject({
      status: 'input-needed',
      missing: [
        { key: 'hardware.anchorsPerFoot', label: 'Ground anchors per leg foot' },
        { key: 'hardware.anchorRating', label: 'Ground anchor rated pull-out, one anchor' },
      ],
    });
    const { dynamicFactor: _, ...rest } = asymmetric;
    const held = review(pads, rest).anchors;
    expect(held).toMatchObject({ status: 'input-needed', missing: [{ key: 'dynamicFactor' }] });
    expect(held?.status === 'input-needed' && held.breakEven?.value).toBeCloseTo(5.0555, 3);
    const { beamMoistureContent: __, ...noWeight } = inputs;
    expect(review(pads, noWeight).anchors).toMatchObject({
      status: 'input-needed',
      missing: [{ key: 'beamMoistureContent' }],
    });
  });

  // Riders hanging still: θ = 0, so nothing pushes the frame over and no foot lifts.
  it('reports no margin when no foot lifts', () => {
    expect(review(pads, { ...inputs, maxSwingAngle: 0 }).anchors).toMatchObject({
      status: 'not-computed',
    });
  });

  it('links the frame, the anchors, and the inputs it changes with', () => {
    const a = review(pads, inputs).anchors as CheckResult;
    const paths = swingSetAFrame.checkFields(a).map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'beamHeight',
        'groundSlope',
        'hardware.anchorsPerFoot',
        'hardware.anchorRating',
        'riderWeights.0',
        'dynamicFactor',
        'beamMoistureContent',
      ]),
    );
    expect(paths).not.toContain('hangerRating');
    expect(
      swingSetAFrame.checkFields(review(pads, inputs).hanger).map((f) => f.path),
    ).not.toContain('hardware.anchorRating');
  });

  it('never says safe, unsafe, pass, or fail', () => {
    expect(JSON.stringify(review(pads, asymmetric).anchors)).not.toMatch(VERDICT_WORDS);
  });
});

describe('checklist', () => {
  it('covers connections, beam restraint, racking, anchoring, hangers, lumber, and upkeep', () => {
    const r = review(params, {});
    expect(r.checklist.map((c) => c.category)).toEqual([
      'bolted-connections',
      'check-assumptions',
      'racking',
      'tipping-and-anchoring',
      'bolted-connections',
      'lumber-quality',
      'long-term-condition',
    ]);
  });
});

describe('wording', () => {
  it('never says safe, unsafe, pass, or fail', () => {
    const text = JSON.stringify([review(params, inputs), review(twoPly, {})]);
    expect(text).not.toMatch(VERDICT_WORDS);
  });
});

describe('example 1 with suggested inputs (#417)', () => {
  // The same values as example 1, with the deflection limit and moisture content suggested from
  // their sources: L/240 = 97.5 / 240 = 0.40625", against δ = 0.149485", margin 2.71766, whether
  // the 240 was entered, suggested, or suggested and confirmed.
  const { deflectionLimit: _, beamMoistureContent: __, ...rest } = inputs;
  const suggested = suggest({
    riders: 'kids-and-adults',
    riderWeights: [150, 150],
    area: { length: 360, depth: 480 },
    ground: { kind: 'level' },
    feet: 'buried',
  }).filter((s) => s.path === 'deflectionLimit' || s.path === 'beamMoistureContent');
  const values = Object.fromEntries(suggested.map((s) => [s.path, s.value]));
  const plan = (as: SuggestedValue[]) => {
    const made = createSnapshot(swingSetAFrame, params, { ...rest, ...values }, as);
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    const outputs = swingSetAFrame.storedOutputs.parse(
      JSON.parse(JSON.stringify(made.output.outputs)),
    );
    return withSuggested(swingSetAFrame.plan(outputs), made.output.suggested);
  };
  const as = (confirmed: boolean): SuggestedValue[] =>
    suggested.map(({ from, path, basis }) => ({ from, path, basis, confirmed }));
  const deflection = (p: ReturnType<typeof plan>) => {
    const d = p.checks.find((c) => c.kind === 'beam-deflection');
    if (d?.status !== 'computed') throw new Error('no deflection');
    return d;
  };

  it('suggests 240 and 30%, the values example 1 enters', () => {
    expect(values).toEqual({ deflectionLimit: 240, beamMoistureContent: 30 });
  });

  it('gives margin 2.72 entered, suggested, and confirmed', () => {
    for (const p of [plan([]), plan(as(false)), plan(as(true))]) {
      const d = deflection(p);
      expect(d.allowable.value).toBeCloseTo(0.40625, 5);
      expect(d.computed.value).toBeCloseTo(0.149485, 5);
      expect(d.margin).toBeCloseTo(2.71766, 4);
    }
  });

  it('says where the limit came from', () => {
    const limit = (p: ReturnType<typeof plan>) =>
      deflection(p).inputs.find((q) => q.input === 'deflectionLimit')?.basis;
    expect(limit(plan([]))).toBe('Entered');
    expect(limit(plan(as(false)))).toMatch(
      /^Suggested by Kerf, not confirmed yet\. Source: International Building Code \(2021\), Table 1604\.3/,
    );
    expect(limit(plan(as(true)))).toMatch(/^Suggested by Kerf, confirmed by you\. Source: /);
  });
});

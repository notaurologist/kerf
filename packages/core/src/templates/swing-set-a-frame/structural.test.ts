import { describe, expect, it } from 'vitest';
import type { CheckResult, ComputedCheck } from '../../structural/types.ts';
import type { SwingSetParams } from './params.ts';
import { pendulumFactor, type SwingSetStructuralReview, structuralReview } from './structural.ts';
import { generate, type SwingSetOutput } from './template.ts';

// Worked examples from docs/templates/swing-set-a-frame.md, Structural model. The geometry is the
// spec's worked example: supports at 13.75 and 106.25 (span 92.5), hangers at 30, 50, 70, 90.
// Expected values were computed by hand, separately from the code (see the spec).

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

  it("bending: R = 600, M = 600·36.25 − 300·20 = 15,750, f_b = 892.56, Fb' = 992.08, margin 1.11", () => {
    const b = computed(r.beam.bending);
    expect(step(b, 'R1')).toBeCloseTo(600, 6);
    expect(step(b, 'M')).toBeCloseTo(15750, 6);
    expect(b.computed.value).toBeCloseTo(892.562, 3);
    expect(b.allowable.value).toBeCloseTo(992.0829, 3);
    expect(b.margin).toBeCloseTo(1.1115, 4);
  });

  it('shear: V = 600, f_v = 46.75, margin 3.63', () => {
    const s = computed(r.beam.shear);
    expect(s.computed.value).toBeCloseTo(46.7532, 3);
    expect(s.margin).toBeCloseTo(3.63076, 4);
  });

  it('deflection: δ = 0.1165 at midspan (x = 60), limit 92.5/240 = 0.3854, margin 3.31', () => {
    const d = computed(r.beam.deflection);
    expect(d.computed.value).toBeCloseTo(0.116521, 5);
    expect(step(d, 'x_max')).toBeCloseTo(60, 6);
    expect(d.allowable.value).toBeCloseTo(0.385417, 5);
    expect(d.margin).toBeCloseTo(3.3077, 4);
  });

  it('hanger: 300 lb on each hanger against a 1200 lb rating, margin 4.0', () => {
    expect(computed(r.hanger).margin).toBeCloseTo(4, 9);
  });

  it('uses the stated service conditions', () => {
    const b = computed(r.beam.bending);
    const f = (s: string) => b.factors.find((x) => x.symbol === s)?.value;
    expect(f('C_D')).toBe(1);
    expect(f('C_r')).toBe(1);
    expect(computed(r.beam.shear).allowable.value).toBeCloseTo(175 * 0.97, 9);
  });
});

describe('example 2: asymmetric, 200 lb on the left swing and 80 lb on the right', () => {
  // Strength hanger loads 400, 400, 160, 160. R1 = (400·132.5 + 160·52.5)/92.5 = 663.78;
  // M under the second hanger = 663.78·36.25 − 400·20 = 16,062.16.
  const r = review(params, { ...inputs, riderWeights: [200, 80] });

  it('matches the hand calculation', () => {
    const b = computed(r.beam.bending);
    expect(step(b, 'R1')).toBeCloseTo(663.7838, 3);
    expect(step(b, 'R2')).toBeCloseTo(456.2162, 3);
    expect(step(b, 'M')).toBeCloseTo(16062.162, 2);
    expect(b.margin).toBeCloseTo(1.0899, 4);
    expect(computed(r.beam.shear).margin).toBeCloseTo(3.28188, 4);
    const d = computed(r.beam.deflection);
    expect(d.computed.value).toBeCloseTo(0.108941, 5);
    expect(step(d, 'x_max')).toBeCloseTo(13.75 + 44.488, 2);
    expect(d.margin).toBeCloseTo(3.53784, 4);
  });

  it('checks the most loaded hanger: 400 lb, margin 3.0', () => {
    const h = computed(r.hanger);
    expect(h.computed.value).toBeCloseTo(400, 9);
    expect(h.margin).toBeCloseTo(3, 9);
  });
});

describe('example 3: two-ply 2x6 beam, same loads as example 1', () => {
  // Each ply carries half: M = 7875 per ply, S = 1.5·5.5²/6 = 7.5625, C_L = 0.9031 for one ply.
  const r = review(twoPly, inputs);

  it('bending margin is below 1 for these inputs: 0.87', () => {
    const b = computed(r.beam.bending);
    expect(step(b, 'M')).toBeCloseTo(7875, 6);
    expect(b.computed.value).toBeCloseTo(1041.3223, 3);
    expect(b.factors.find((f) => f.symbol === 'C_L')?.value).toBeCloseTo(0.903093, 5);
    expect(b.margin).toBeCloseTo(0.86726, 4);
  });

  it('shear and deflection', () => {
    expect(computed(r.beam.shear).margin).toBeCloseTo(3.11208, 4);
    expect(computed(r.beam.deflection).computed.value).toBeCloseTo(0.135941, 5);
    expect(computed(r.beam.deflection).margin).toBeCloseTo(2.83518, 4);
  });

  it('puts ply fastening on the checklist', () => {
    expect(r.checklist.some((c) => c.element.startsWith('Beam plies'))).toBe(true);
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

  it('rejects values out of range at the boundary', () => {
    const result = structuralReview(output(params), { ...inputs, maxSwingAngle: 120 });
    expect(result.ok).toBe(false);
    expect(structuralReview(output(params), { ...inputs, riderWeights: [0, 0] }).ok).toBe(false);
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
    expect(text).not.toMatch(/\b(safe|unsafe|pass|passes|fail|fails)\b/i);
  });
});

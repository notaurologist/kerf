import { describe, expect, it } from 'vitest';
import type { CheckResult, ComputedCheck } from '../../structural/types.ts';
import type { SwingSetParams } from './params.ts';
import { pendulumFactor, type SwingSetStructuralReview, structuralReview } from './structural.ts';
import { generate, type SwingSetOutput } from './template.ts';

// Worked examples from docs/templates/swing-set-a-frame.md, Structural model. The geometry is the
// spec's worked example: supports at 13.75 and 106.25 (span 92.5), hangers at 30, 50, 70, 90.
// Expected values were computed by hand, separately from the code (see the spec). The beam is at
// 30% moisture content: Southern Pine density 38.940 lb/ft³, so a 4x6 weighs w = 0.433798 lb/in.

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

  it('bending: M = 15,750 from the hangers + wL²/8 = 463.96 from the beam = 16,213.96, margin 1.08', () => {
    const b = computed(r.beam.bending);
    expect(step(b, 'R1')).toBeCloseTo(620.0632, 3);
    expect(step(b, 'M')).toBeCloseTo(16213.961, 2);
    expect(b.computed.value).toBeCloseTo(918.8549, 3);
    expect(b.allowable.value).toBeCloseTo(992.0829, 3);
    expect(b.margin).toBeCloseTo(1.07969, 4);
  });

  it('shows the beam weight working', () => {
    const b = computed(r.beam.bending);
    expect(b.inputs.find((q) => q.symbol === 'ρ')?.value).toBeCloseTo(38.940432, 5);
    expect(b.inputs.find((q) => q.symbol === 'w')?.value).toBeCloseTo(0.433798, 6);
  });

  it('shear: V = 600 + wL/2 = 620.06, f_v = 48.32, margin 3.51', () => {
    const s = computed(r.beam.shear);
    expect(s.computed.value).toBeCloseTo(48.3166, 3);
    expect(s.margin).toBeCloseTo(3.51328, 4);
  });

  it('deflection: δ·EI = 7,124,414 + 5wL⁴/384 = 7,537,931, δ = 0.1233 at x = 60, margin 3.13', () => {
    const d = computed(r.beam.deflection);
    expect(d.computed.value).toBeCloseTo(0.123284, 5);
    expect(step(d, 'x_max')).toBeCloseTo(60, 6);
    expect(d.allowable.value).toBeCloseTo(0.385417, 5);
    expect(d.margin).toBeCloseTo(3.12625, 4);
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
  // Strength hanger loads 400, 400, 160, 160. R1 = (400·132.5 + 160·52.5)/92.5 + wL/2 = 683.847;
  // M under the second hanger = 683.847·36.25 − 400·20 − w·36.25²/2 = 16,504.44.
  const r = review(params, { ...inputs, riderWeights: [200, 80] });

  it('matches the hand calculation', () => {
    const b = computed(r.beam.bending);
    expect(step(b, 'R1')).toBeCloseTo(683.847, 3);
    expect(step(b, 'R2')).toBeCloseTo(476.2794, 3);
    expect(step(b, 'M')).toBeCloseTo(16504.436, 2);
    expect(b.margin).toBeCloseTo(1.06069, 4);
    expect(computed(r.beam.shear).margin).toBeCloseTo(3.18559, 4);
    const d = computed(r.beam.deflection);
    expect(d.computed.value).toBeCloseTo(0.115693, 5);
    expect(step(d, 'x_max')).toBeCloseTo(58.3415, 2);
    expect(d.margin).toBeCloseTo(3.33136, 4);
  });

  it('checks the most loaded hanger: 400 lb, margin 3.0', () => {
    const h = computed(r.hanger);
    expect(h.computed.value).toBeCloseTo(400, 9);
    expect(h.margin).toBeCloseTo(3, 9);
  });
});

describe('example 3: two-ply 2x6 beam, same loads as example 1', () => {
  // Each ply carries half of every load, including half the beam's weight (w = 0.371827 lb/in for
  // both plies): M = 7875 + 0.185914·92.5²/8 = 8073.84 per ply, S = 7.5625, C_L = 0.9031.
  const r = review(twoPly, inputs);

  it('bending margin is below 1 for these inputs: 0.85', () => {
    const b = computed(r.beam.bending);
    expect(step(b, 'M')).toBeCloseTo(8073.84, 2);
    expect(b.computed.value).toBeCloseTo(1067.6152, 3);
    expect(b.factors.find((f) => f.symbol === 'C_L')?.value).toBeCloseTo(0.903093, 5);
    expect(b.margin).toBeCloseTo(0.8459, 4);
  });

  it('shear and deflection', () => {
    expect(computed(r.beam.shear).margin).toBeCloseTo(3.02537, 4);
    expect(computed(r.beam.deflection).computed.value).toBeCloseTo(0.142704, 5);
    expect(computed(r.beam.deflection).margin).toBeCloseTo(2.70081, 4);
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
      'beamMoistureContent',
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

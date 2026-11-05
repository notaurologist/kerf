import { swingSetAFrame } from '@kerf/core';
import { VERDICT_WORDS } from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import {
  type AFrameInputs,
  aFrameAnalysis,
  type CaseResult,
  frameGeometry,
  HEADING,
} from './aFrame.ts';

// The swing set's worked example (spec, Worked example): L = 120, H = 96, α = 20°, 4x6 beam
// (bw = 3.5, bd = 5.5), 4x4 legs, 2x6 crossbar at zc = 40, 2x8 gusset, ground falling 1" per foot
// toward the front, 1/2" bolts, two per crossbar and gusset joint. Hand values below are from the
// spec's tables (Derived geometry, Placements, Structural model, examples 4 and 5) and worked here
// with sin α = 0.342020, cos α = 0.939693, tan α = 0.363970.

const INPUTS: AFrameInputs = {
  riderWeights: [150, 150],
  maxSwingAngle: 60,
  dynamicFactor: 2,
  beamSpeciesGrade: 'southern-pine-no2',
  beamMoistureContent: 30,
  legSpeciesGrade: 'southern-pine-no2',
  legIncised: false,
  crossbarSpeciesGrade: 'southern-pine-no2',
  crossbarIncised: false,
  gussetSpeciesGrade: 'southern-pine-no2',
  gussetIncised: false,
};

const BURIED = swingSetAFrame.WORKED_EXAMPLE;
const PADS = { ...BURIED, burialDepth: 0 };

function plan(params: swingSetAFrame.SwingSetParams) {
  const made = swingSetAFrame.generate(params);
  if (!made.ok) throw new Error(made.issues.map((i) => i.message).join('; '));
  return made.output;
}

function computed(params: swingSetAFrame.SwingSetParams, inputs: AFrameInputs) {
  const report = aFrameAnalysis(plan(params), inputs);
  if (report.status !== 'computed') throw new Error(`Not computed: ${JSON.stringify(report)}`);
  return report;
}

function solved(c: CaseResult) {
  if (c.analysis.kind !== 'solved') throw new Error(c.analysis.message);
  return c.analysis;
}

const near = (actual: number | undefined, expected: number, within: number) => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(within);
};

const TAN = Math.tan((20 * Math.PI) / 180);
const COS = Math.cos((20 * Math.PI) / 180);
const SIN = Math.sin((20 * Math.PI) / 180);

describe('the A-frame read from the plan', () => {
  // Q_y = bw/2 + w/(2·cos α) = 1.75 + 1.862311 = 3.612311: the leg's centerline at the beam's
  // underside. Down from there the centerline moves out tan α per inch.
  const qy = 1.75 + 3.5 / (2 * COS);
  const g = frameGeometry(plan(BURIED), 0);

  it("puts the beam's joint at the leg-to-beam bolt's center, at the beam's mid-depth", () => {
    // H + bd/2 = 96 + 2.75, on the beam's centerline.
    near(g.top.x, 0, 1e-9);
    near(g.top.y, 98.75, 1e-9);
    near(g.hangers.y, 96, 0);
  });

  it("joins each leg on its centerline where the bolt's line crosses it", () => {
    // 2.75 above the beam's underside: Q_y − 2.75·tan α = 3.612311 − 1.000917 = 2.611394.
    near(g.legs.back.top.x, qy - 2.75 * TAN, 1e-9);
    near(g.legs.back.top.y, 98.75, 1e-9);
    near(g.legs.front.top.x, -(qy - 2.75 * TAN), 1e-9);
  });

  it("puts each crossbar and gusset joint at its bolts' centroid, on the leg's centerline", () => {
    // Crossbar bolts at z = 35.875 and 38.625 (spec, Holes and joints): centroid 37.25, the
    // crossbar's middle, 96 − 37.25 = 58.75 below Q: y = 3.612311 + 21.383250 = 24.995561.
    // Gusset bolts at 90.5625 and 94.1875: centroid 92.375, 3.625 below Q: y = 4.931701.
    near(g.legs.back.crossbar.y, 37.25, 1e-9);
    near(g.legs.back.crossbar.x, qy + 58.75 * TAN, 1e-9);
    near(g.legs.front.crossbar.x, -(qy + 58.75 * TAN), 1e-9);
    near(g.legs.back.gusset.y, 92.375, 1e-9);
    near(g.legs.back.gusset.x, qy + 3.625 * TAN, 1e-9);
    near(g.bearing.x, 0, 1e-9);
    near(g.bearing.y, 92.375, 1e-9);
  });

  it("puts each foot where the leg's centerline meets the ground", () => {
    // Spec, Structural model, example 4: back foot (37.4185, 3.1182), front (−39.7594, −3.3133).
    near(g.legs.back.foot.x, 37.4185, 1e-4);
    near(g.legs.back.foot.y, 3.1182, 1e-4);
    near(g.legs.front.foot.x, -39.7594, 1e-4);
    near(g.legs.front.foot.y, -3.3133, 1e-4);
  });

  it('places the right frame the same way', () => {
    expect(frameGeometry(plan(BURIED), 1)).toEqual(g);
  });
});

describe('sections and E', () => {
  it("takes E from Table 4B with wet service, and each member's section in the frame's plane", () => {
    // Southern Pine No.2: E = 1,400,000 psi in every width; C_M = 0.9 for E (Table 4B
    // adjustment factors), C_t = 1.0, not incised: E' = 1,260,000 psi.
    const { sections } = computed(BURIED, INPUTS);
    for (const s of Object.values(sections)) expect(s.e).toBeCloseTo(1_260_000, 6);
    // Leg 3.5 deep in the plane, 3.5 across: A = 12.25, I = 3.5⁴/12 = 12.505208.
    expect(sections.leg.inertia).toBeCloseTo(12.505208, 6);
    // Crossbar 5.5 deep, 1.5 across: A = 8.25, I = 1.5·5.5³/12 = 20.796875.
    expect(sections.crossbar.area).toBeCloseTo(8.25, 12);
    expect(sections.crossbar.inertia).toBeCloseTo(20.796875, 6);
    // Gusset 7.25 deep, 1.5 across: I = 1.5·7.25³/12 = 381.078125/8 = 47.634766.
    expect(sections.gusset.inertia).toBeCloseTo(47.634766, 6);
  });

  it('takes incising off E where it is entered', () => {
    const { sections } = computed(BURIED, { ...INPUTS, legIncised: true });
    expect(sections.leg.e).toBeCloseTo(1_260_000 * 0.95, 6);
  });

  it('needs every species and grade, as core does', () => {
    const { crossbarSpeciesGrade: _, ...rest } = INPUTS;
    const report = aFrameAnalysis(plan(BURIED), rest);
    expect(report).toEqual({
      heading: HEADING,
      status: 'input-needed',
      missing: ['Crossbar species and grade'],
    });
  });
});

describe('loads, from the uplift check', () => {
  const report = computed(PADS, { ...INPUTS, riderWeights: [200, 80] });
  const left = report.cases.filter((c) => c.frame === 'left');

  it('at the bottom of the arc, the frame carries its share of the swings and half the beam', () => {
    // Example 4: W_f = 164.615 on the left frame; at φ = 0 the chain carries W·(3 − 2·cos 60°) =
    // 2·W, times the dynamic factor 2, plus D = 26.0279: 4 · 164.615 + 26.028 = 684.49 lb.
    const bottom = left.find((c) => c.phi === 0);
    near(bottom?.applied.fy, -684.49, 0.01);
    near(bottom?.applied.fx, 0, 1e-9);
    near(bottom?.applied.moment, 0, 1e-9);
  });

  it('pushed toward the front, at the angle where the back foot lifts most', () => {
    // Example 4: φ = 47.14° (cos 0.68039, sin 0.73285). T = 2·164.615·(3·0.68039 − 1) = 342.78;
    // F = 342.78·0.73285 = 251.21 toward the front, V = 342.78·0.68039 = 233.22 plus D = 259.25
    // down (to the printed digits of cos and sin). F acts at the beam's underside, 2.75 below the
    // bolt's center, so it turns the beam 2.75·F clockwise about it.
    const c = left.find((x) => x.load.startsWith('Pushed toward the front'));
    near(c?.phi, 47.14, 0.005);
    near(c?.applied.fx, -251.2, 0.2);
    near(c?.applied.fy, -259.2, 0.2);
    near(c?.applied.moment, 2.75 * (c?.applied.fx ?? 0), 1e-9);
  });
});

describe("foot reactions where the frame is statically determinate (#467's uplift check)", () => {
  // On pads with the lifting foot released, the pivot holds both ways and the lifting foot only up
  // and down: three reactions, so statics alone gives them, and they are the uplift check's.
  // Spec, Structural model, example 4 (riders 200 and 80 lb, θ = 60°, factor 2): uplift 189.70
  // (left back), 176.63 (left front), 128.96 (right back), 120.03 (right front).
  const output = plan(PADS);
  const report = computed(PADS, { ...INPUTS, riderWeights: [200, 80] });
  const released = report.cases.filter((c) => c.supports.includes('released'));
  const expected = {
    'left back': 189.7,
    'left front': 176.63,
    'right back': 128.96,
    'right front': 120.03,
  } as const;

  it('runs each lifting foot with joints pinned and rigid', () => {
    expect(released.map((c) => `${c.frame} ${c.supports} ${c.joints}`)).toEqual([
      'left The lifting back foot released pinned',
      'left The lifting back foot released rigid',
      'left The lifting front foot released pinned',
      'left The lifting front foot released rigid',
      'right The lifting back foot released pinned',
      'right The lifting back foot released rigid',
      'right The lifting front foot released pinned',
      'right The lifting front foot released rigid',
    ]);
  });

  for (const [which, uplift] of Object.entries(expected)) {
    it(`pulls down on the ${which} foot by the uplift check's ${uplift} lb`, () => {
      const [frame, foot] = which.split(' ') as ['left' | 'right', 'back' | 'front'];
      for (const c of released.filter((x) => x.frame === frame && x.supports.includes(foot))) {
        const r = solved(c).reactions;
        near(r[`${foot}-foot`]?.fy, -uplift, 0.005);
        near(r[`${foot}-foot`]?.fx, 0, 0);
        // The pivot takes the whole fore-and-aft load.
        near(r[`${foot === 'back' ? 'front' : 'back'}-foot`]?.fx, -c.applied.fx, 1e-9);
      }
    });
  }

  it("matches core's uplift, C·S − D·c_v, to 10⁻⁹ lb", () => {
    const { feet } = swingSetAFrame.upliftFeet(
      output,
      [200, 80],
      60,
      swingSetAFrame.beamWeightPerInch(output, 'southern-pine-no2', 30) ?? 0,
    );
    for (const f of feet) {
      for (const c of released.filter((x) => x.frame === f.frame && x.supports.includes(f.foot))) {
        near(solved(c).reactions[`${f.foot}-foot`]?.fy, -(2 * f.S - f.held), 1e-9);
      }
    }
  });

  it('gives the same reactions whether the joints are pinned or rigid', () => {
    for (let i = 0; i < released.length; i += 2) {
      const [a, b] = [solved(released[i] as CaseResult), solved(released[i + 1] as CaseResult)];
      for (const foot of ['back-foot', 'front-foot']) {
        near(a.reactions[foot]?.fy, b.reactions[foot]?.fy ?? Number.NaN, 1e-9);
        near(a.reactions[foot]?.fx, b.reactions[foot]?.fx ?? Number.NaN, 1e-9);
      }
    }
  });

  it('lifts the foot less when both feet are pinned and share the fore-and-aft load', () => {
    // Statically indeterminate: the lifting foot also takes part of the push, which lowers it.
    const both = report.cases.filter(
      (c) =>
        c.frame === 'left' &&
        c.load.startsWith('Pushed toward the front') &&
        c.supports.startsWith('Both'),
    );
    for (const c of both) {
      const r = solved(c).reactions['back-foot'];
      expect(r?.fy).toBeLessThan(0);
      expect(-(r?.fy ?? 0)).toBeLessThan(189.7);
      expect(r?.fx).not.toBe(0);
    }
  });
});

describe("the legs' axial load against #468's leg check", () => {
  // Example 5: P = (C·R_s + R_w) / (2·cos α) = (2·300 + 26.028) / (2·0.939693) = 333.10 lb, the
  // frame's load shared equally by its legs along their axes. In the frame the foot's reaction
  // need not lie along the leg: the leg's force at the foot is Ry·cos α + Rx·sin α (toward the
  // back foot, Rx pushes outward when negative). With the reaction along the leg, Rx = Ry·tan α
  // and the two agree.
  const report = computed(BURIED, INPUTS);
  const bottom = report.cases.filter((c) => c.frame === 'left' && c.phi === 0);

  it('is within 0.1% of P below the crossbar, buried, joints pinned and rigid', () => {
    expect(bottom.map((c) => `${c.supports} ${c.joints}`)).toEqual([
      'Both feet fixed at grade pinned',
      'Both feet fixed at grade rigid',
    ]);
    for (const c of bottom) {
      const a = solved(c);
      for (const side of ['back', 'front'] as const) {
        const lowest = a.memberForces[`${side}-leg-3`];
        // Compression is the axial force at the member's start (EndForces).
        const N = lowest?.start.axial ?? Number.NaN;
        expect(Math.abs(N - 333.1) / 333.1).toBeLessThan(0.001);
        // The same force from the foot's reaction, by statics at the foot.
        const r = a.reactions[`${side}-foot`];
        const outward = side === 'back' ? -(r?.fx ?? 0) : (r?.fx ?? 0);
        near(lowest?.end.axial, -((r?.fy ?? 0) * COS + outward * SIN), 1e-6);
      }
    }
  });

  it("is within 0.1% of P on pads with example 4's riders", () => {
    // R_s = 2·164.615 = 329.231 on the left frame: P = (2·329.231 + 26.028) / 1.879385 = 364.21.
    const pads = computed(PADS, { ...INPUTS, riderWeights: [200, 80] });
    for (const c of pads.cases.filter((x) => x.frame === 'left' && x.phi === 0)) {
      for (const side of ['back', 'front']) {
        const N = solved(c).memberForces[`${side}-leg-3`]?.start.axial ?? Number.NaN;
        expect(Math.abs(N - 364.21) / 364.21).toBeLessThan(0.001);
      }
    }
  });

  it('carries less above the gusset, which takes part of the beam', () => {
    for (const c of bottom) {
      const a = solved(c);
      expect(a.memberForces['back-leg-1']?.start.axial).toBeLessThan(
        0.7 * (a.memberForces['back-leg-3']?.start.axial ?? 0),
      );
    }
  });
});

describe('every case', () => {
  const reports = [
    computed(BURIED, INPUTS),
    computed(PADS, { ...INPUTS, riderWeights: [200, 80] }),
  ];
  const cases = reports.flatMap((r) => r.cases);

  it('runs every load and support case with joints pinned and rigid', () => {
    // Buried: 2 frames × 3 loads × fixed feet × 2 joint models. Pads: both feet pinned for all
    // three loads, and the lifting foot released for the two pushes.
    expect(reports[0]?.cases).toHaveLength(12);
    expect(reports[1]?.cases).toHaveLength(2 * (3 + 2) * 2);
    for (let i = 0; i < cases.length; i += 2) {
      expect([cases[i]?.joints, cases[i + 1]?.joints]).toEqual(['pinned', 'rigid']);
    }
  });

  it('is headed as exploratory and lists its assumptions', () => {
    for (const c of cases) {
      expect(c.heading).toBe('Exploratory frame analysis, not a structural check');
      expect(c.assumptions.length).toBeGreaterThan(5);
    }
  });

  it('solves, and its reactions balance the load', () => {
    for (const c of cases) {
      const a = solved(c);
      const params = c.supports.includes('fixed') ? BURIED : PADS;
      const g = frameGeometry(plan(params), c.frame === 'left' ? 0 : 1);
      const r = (['back', 'front'] as const).map((side) => ({
        at: g.legs[side].foot,
        ...(a.reactions[`${side}-foot`] ?? { fx: Number.NaN, fy: Number.NaN, moment: Number.NaN }),
      }));
      near(r.reduce((s, x) => s + x.fx, 0) + c.applied.fx, 0, 1e-8);
      near(r.reduce((s, x) => s + x.fy, 0) + c.applied.fy, 0, 1e-8);
      // Moments about the beam's joint.
      const about = r.reduce(
        (s, x) => s + x.moment + (x.at.x - g.top.x) * x.fy - (x.at.y - g.top.y) * x.fx,
        c.applied.moment,
      );
      near(about, 0, 1e-6);
    }
  });

  it('releases the moment at each bolted joint when pinned', () => {
    for (const c of cases.filter((x) => x.joints === 'pinned')) {
      const f = solved(c).memberForces;
      near(f['back-leg-1']?.start.moment, 0, 1e-9);
      near(f['front-leg-1']?.start.moment, 0, 1e-9);
      near(f.crossbar?.start.moment, 0, 1e-9);
      near(f.crossbar?.end.moment, 0, 1e-9);
      near(f['gusset-front']?.start.moment, 0, 1e-9);
      near(f['gusset-back']?.end.moment, 0, 1e-9);
    }
  });

  it('reports margins and forces, never a verdict', () => {
    expect(JSON.stringify(reports)).not.toMatch(VERDICT_WORDS);
  });
});

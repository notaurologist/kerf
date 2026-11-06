import { swingSetAFrame } from '@kerf/core';
import { VERDICT_WORDS } from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import { HEADING } from './aFrame.ts';
import { analyze3 } from './space/analyze.ts';
import type { Frame3 } from './space/model.ts';
import { SOUTHERN_PINE_SHEAR_RATIOS, shearRatio } from './space/torsion.ts';
import {
  ALONG_THE_BEAM,
  buildSwingSet,
  middleJoint,
  type SwingSetCase,
  type SwingSetInputs,
  setGeometry,
  swingSetAnalysis,
} from './swingSet.ts';

// The spec's worked example: L = 120, H = 96, α = 20°, 4x6 beam (bw = 3.5, bd = 5.5), 4x4 legs,
// 2x6 crossbar, 2x8 gusset (gt = 1.5), e = 12, ground falling 1" per foot toward the front.

const SLASH = SOUTHERN_PINE_SHEAR_RATIOS[2];
const LOBLOLLY = SOUTHERN_PINE_SHEAR_RATIOS[0];

const INPUTS: SwingSetInputs = {
  riderWeights: [150, 150],
  maxSwingAngle: 60,
  dynamicFactor: 2,
  beamSpeciesGrade: 'southern-pine-no2',
  beamIncised: false,
  beamMoistureContent: 30,
  legSpeciesGrade: 'southern-pine-no2',
  legIncised: false,
  crossbarSpeciesGrade: 'southern-pine-no2',
  crossbarIncised: false,
  gussetSpeciesGrade: 'southern-pine-no2',
  gussetIncised: false,
  shearModulus: { ratio: shearRatio(SLASH), basis: 'Wood Handbook Table 5–1, slash pine' },
};

const BURIED = swingSetAFrame.WORKED_EXAMPLE;
const PADS = {
  ...BURIED,
  burialDepth: 0,
  hardware: { ...BURIED.hardware, anchorsPerFoot: 1, anchorRating: 500 },
};

function plan(params: swingSetAFrame.SwingSetParams) {
  const made = swingSetAFrame.generate(params);
  if (!made.ok) throw new Error(made.issues.map((i) => i.message).join('; '));
  return made.output;
}

function computed(params: swingSetAFrame.SwingSetParams, inputs: SwingSetInputs = INPUTS) {
  const report = swingSetAnalysis(plan(params), inputs);
  if (report.status !== 'computed') throw new Error(`Not computed: ${JSON.stringify(report)}`);
  return report;
}

function solved(c: SwingSetCase | undefined) {
  if (c?.result.kind !== 'solved') throw new Error(`Not solved: ${JSON.stringify(c?.result)}`);
  return c.result;
}

const find = (cases: SwingSetCase[], load: string, supports: string, joints: string) =>
  cases.find(
    (c) => c.load.startsWith(load) && c.supports.startsWith(supports) && c.joints === joints,
  );

const near = (actual: number | undefined, expected: number, within: number) => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(within);
};

describe('the swing set read from the plan', () => {
  const g = setGeometry(plan(BURIED));
  if (typeof g === 'string') throw new Error(g);
  const [left, right] = g.frames;

  it('puts each frame at its legs’ centerline and the crossbar and gusset on its outside face', () => {
    // Legs from x = e to e + t: centerline 12 + 1.75 = 13.75, and 120 − 13.75 = 106.25. Crossbar
    // and gusset from x = e − 1.5 = 10.5 to 12 on the left, 108 to 109.5 on the right: their
    // middles at 11.25 and 108.75.
    near(left?.x, 13.75, 1e-9);
    near(right?.x, 106.25, 1e-9);
    near(left?.crossbarX, 11.25, 1e-9);
    near(left?.gussetX, 11.25, 1e-9);
    near(right?.crossbarX, 108.75, 1e-9);
    near(right?.gussetX, 108.75, 1e-9);
  });

  it("bears the beam at the middle of the gusset's top edge, as the beam checks do", () => {
    // b_g = min(gt, e) = 1.5: x = e − b_g/2 = 11.25 and L − e + b_g/2 = 108.75 (beamSupports).
    near(left?.bearingX, 11.25, 1e-9);
    near(right?.bearingX, 108.75, 1e-9);
  });

  it("runs the beam at the bolt's height through the hangers, loaded along it at its middle", () => {
    near(g.beam.z, 98.75, 1e-9);
    near(g.beam.y, 0, 1e-9);
    expect(g.hangersX).toEqual([30, 50, 70, 90]);
    near(g.hangerZ, 96, 0);
    near(g.middleX, 60, 1e-9);
    expect(middleJoint(g)).toBe('middle');
  });
});

describe('sections', () => {
  const { sections } = computed(BURIED);

  it('gives each member G and J from the Wood Handbook', () => {
    // G = 0.053991 × 1,260,000 = 68,028.4 psi. Leg 3.5 by 3.5: J = 3.5⁴/6.97 = 21.5298 in⁴.
    // Beam 5.5 by 3.5: b/h = 0.636364, φ = 4.73 + 0.36364·0.47 = 4.900909,
    // J = 5.5·3.5³/φ = 235.8125/4.900909 = 48.1160.
    near(sections.leg.g, 0.0539907 * 1_260_000, 1);
    near(sections.leg.j, 150.0625 / 6.97, 1e-9);
    near(sections.beam.j, 235.8125 / 4.900909, 1e-4);
    // Beam: Iz = 3.5·5.5³/12 = 48.526 about its strong axis, Iy = 5.5·3.5³/12 = 19.651.
    near(sections.beam.iz, (3.5 * 5.5 ** 3) / 12, 1e-9);
    near(sections.beam.iy, (5.5 * 3.5 ** 3) / 12, 1e-9);
    // Crossbar 2x6 on edge in the frame's plane: Iz = 1.5·5.5³/12 = 20.797, Iy = 5.5·1.5³/12.
    near(sections.crossbar.iz, (1.5 * 5.5 ** 3) / 12, 1e-9);
    near(sections.crossbar.iy, (5.5 * 1.5 ** 3) / 12, 1e-9);
  });

  it('takes a built-up beam as plies bending together and twisting apart', () => {
    const twoPly = computed({
      ...BURIED,
      beamStock: '2x6',
      beamPlies: 2,
      hardware: { ...BURIED.hardware, plyBolts: { diameter: 0.5, count: 6 } },
    }).sections.beam;
    // Two 1.5 by 5.5 plies: Iz = 3·5.5³/12 = 41.594; Iy = 2·5.5·1.5³/12 = 3.094;
    // J = 2·5.5·1.5³/φ with φ = 3.583636 (b/h = 0.272727) = 2·5.179795 = 10.35959.
    near(twoPly.iz, (3 * 5.5 ** 3) / 12, 1e-9);
    near(twoPly.iy, (2 * 5.5 * 1.5 ** 3) / 12, 1e-9);
    near(twoPly.j, 2 * 5.179795, 1e-5);
  });
});

describe('stiffness along the beam, legs buried', () => {
  const { cases } = computed(BURIED);
  const pinned = solved(find(cases, ALONG_THE_BEAM, 'Both feet fixed', 'pinned'));
  const rigid = solved(find(cases, ALONG_THE_BEAM, 'Both feet fixed', 'rigid'));

  it('pinned, sways a little less than its four legs would as flagpoles', () => {
    // Pinned, each leg's top turns freely on its bolt, so with the crossbars and gussets left out
    // each leg is a cantilever fixed at grade, loaded square to it at its top, P·ℓ³/(3EI). ℓ runs
    // along the leg from the ground to the bolt's line, z = 98.75: back (98.75 − 3.118)/0.939693
    // = 101.769, front (98.75 + 3.313)/0.939693 = 108.613 (spec, ground heights). EI =
    // 1,260,000·3.5⁴/12 = 15,756,563; 3EI/ℓ³ = 44.847 (back) and 36.892 (front) lb/in. One back
    // and one front leg per frame, 81.739 lb/in; both frames 163.478 lb/in, or 0.0061170 in/lb. Adding the crossbars, gussets, and beam can only stiffen the frame, so
    // the sway is at most this; they couple the legs only a little.
    const bound = 1 / 163.478;
    expect(pinned.sway.left).toBeLessThanOrEqual(bound * 1.001);
    expect(pinned.sway.left).toBeGreaterThan(bound * 0.98);
  });

  it('rigid, is stiffer, and both frames move together', () => {
    expect(rigid.sway.left).toBeLessThan(pinned.sway.left);
    expect(rigid.sway.left).toBeGreaterThan(0);
    for (const r of [pinned, rigid]) near(r.sway.left / r.sway.right, 1, 1e-6);
  });

  it('shares the pound between the four feet along the beam', () => {
    for (const r of [pinned, rigid]) {
      const fx = Object.values(r.analysis.reactions).reduce((s, f) => s + f.fx, 0);
      near(fx, -1, 1e-9);
    }
  });

  it('barely depends on G: the legs bending carry the sway, not torsion', () => {
    const other = computed(BURIED, {
      ...INPUTS,
      shearModulus: { ratio: shearRatio(LOBLOLLY), basis: 'loblolly' },
    });
    for (const joints of ['pinned', 'rigid'] as const) {
      const a = solved(find(cases, ALONG_THE_BEAM, 'Both', joints)).sway.left;
      const b = solved(find(other.cases, ALONG_THE_BEAM, 'Both', joints)).sway.left;
      expect(Math.abs(a - b) / a).toBeLessThan(0.01);
    }
  });
});

describe('along the beam on pads', () => {
  const { cases } = computed(PADS, { ...INPUTS, riderWeights: [200, 80] });

  it('with pinned joints is a mechanism along the beam in every case, and says so', () => {
    const pinned = cases.filter((c) => c.joints === 'pinned');
    expect(pinned).toHaveLength(6);
    for (const c of pinned) {
      expect(c.result.kind).toBe('mechanism-along-beam');
      if (c.result.kind === 'mechanism-along-beam')
        expect(c.result.message).toMatch(/no sway is given/);
    }
  });

  it('with rigid joints has a stiffness along the beam', () => {
    const r = solved(find(cases, ALONG_THE_BEAM, 'Both feet pinned', 'rigid'));
    expect(r.sway.left).toBeGreaterThan(0);
    near(r.sway.left / r.sway.right, 1, 1e-6);
  });

  it('is so nearly a mechanism on sloped ground that only the beam bending sideways holds it', () => {
    // A spring along the beam at its middle takes what the frame does not. On level ground the
    // frame takes nothing; on sloped ground it takes a stiffness that grows with the slope's
    // square, since the beam turns in plan by the slope's share of the lean: 3"/ft gives nine
    // times 1"/ft.
    const frameStiffness = (groundSlope: number) => {
      const output = plan({ ...PADS, groundSlope });
      const report = swingSetAnalysis(output, INPUTS);
      const g = setGeometry(output);
      if (report.status !== 'computed' || typeof g === 'string') throw new Error('plan');
      const pin = { kind: 'pinned' } as const;
      const frame = buildSwingSet(
        g,
        report.sections,
        'pinned',
        { left: { back: pin, front: pin }, right: { back: pin, front: pin } },
        [{ joint: middleJoint(g), fx: 1 }],
      );
      const k = 10;
      const mid = frame.joints.find((j) => j.id === middleJoint(g));
      if (!mid) throw new Error('middle');
      const withSpring: Frame3 = {
        ...frame,
        joints: [...frame.joints, { id: 'ground', x: mid.x - 1, y: mid.y, z: mid.z }],
        members: [
          ...frame.members,
          {
            id: 'spring',
            start: 'ground',
            end: mid.id,
            // EA/L = k over a one-inch length; its bending and torsion are negligible.
            section: { e: k, g: 1, area: 1, iy: 1e-9, iz: 1e-9, j: 1e-9 },
            reference: { x: 0, y: 0, z: 1 },
          },
        ],
        supports: { ...frame.supports, ground: { kind: 'fixed' } },
      };
      const a = analyze3(withSpring);
      if (a.kind !== 'solved') throw new Error(a.message);
      const sway = a.displacements[mid.id]?.x ?? Number.NaN;
      return (1 - k * sway) / sway;
    };
    const level = frameStiffness(0);
    const one = frameStiffness(1);
    const three = frameStiffness(3);
    expect(Math.abs(level)).toBeLessThan(1e-6);
    // 6.5×10⁻⁵ lb/in at the worked example's 1" per foot.
    near(one, 6.5e-5, 0.1e-5);
    near(three / one, 9, 0.2);
  });
});

describe('foot reactions where each frame is statically determinate', () => {
  // On pads with the lifting feet released and equal riders, the set is symmetric about the
  // beam's middle, so each frame carries half of everything. In its plane each frame then has
  // three reactions (the pivot both ways, the lifting foot up and down) and statics gives them:
  // they are core's uplift check, C·S − D·c_v, as in step 2.
  const output = plan(PADS);
  const { cases } = computed(PADS);
  const w = swingSetAFrame.beamWeightPerInch(output, 'southern-pine-no2', 30) ?? 0;
  const { feet } = swingSetAFrame.upliftFeet(output, [150, 150], 60, w);

  it('matches the uplift check at each lifting foot, rigid joints', () => {
    let compared = 0;
    for (const f of feet) {
      const c = cases.find(
        (x) => x.supports === `The lifting ${f.foot} feet released` && x.joints === 'rigid',
      );
      const r = solved(c).analysis.reactions[`${f.frame}-${f.foot}-foot`];
      near(r?.fz, -(2 * f.S - f.held), 1e-6);
      compared++;
    }
    expect(compared).toBe(4);
  });
});

describe('every case', () => {
  const reports = [computed(BURIED), computed(PADS, { ...INPUTS, riderWeights: [200, 80] })];

  it('is headed as exploratory, with its assumptions, including why no load along the beam', () => {
    for (const r of reports) {
      expect(r.heading).toBe(HEADING);
      for (const c of r.cases) {
        expect(c.heading).toBe('Exploratory frame analysis, not a structural check');
        expect(c.assumptions.some((a) => a.startsWith('No load along the beam'))).toBe(true);
      }
    }
  });

  it('runs four loads buried (8 cases) and on pads (12 cases)', () => {
    expect(reports[0]?.cases).toHaveLength(8);
    expect(reports[1]?.cases).toHaveLength(12);
  });

  it('is in equilibrium: the reactions balance the loads, forces and moments', () => {
    for (const [i, params] of [BURIED, PADS].entries()) {
      const report = reports[i];
      const g = setGeometry(plan(params));
      if (!report || typeof g === 'string') throw new Error('plan');
      for (const c of report.cases) {
        if (c.result.kind !== 'solved') continue;
        const frame = buildSwingSet(
          g,
          report.sections,
          c.joints,
          {
            left: { back: { kind: 'fixed' }, front: { kind: 'fixed' } },
            right: { back: { kind: 'fixed' }, front: { kind: 'fixed' } },
          },
          [],
        );
        const at = new Map(frame.joints.map((j) => [j.id, j]));
        const sum = { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
        const add = (
          id: string,
          f: { fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number },
        ) => {
          const p = at.get(id);
          if (!p) throw new Error(id);
          const [fx, fy, fz] = [f.fx ?? 0, f.fy ?? 0, f.fz ?? 0];
          sum.fx += fx;
          sum.fy += fy;
          sum.fz += fz;
          sum.mx += (f.mx ?? 0) + p.y * fz - p.z * fy;
          sum.my += (f.my ?? 0) + p.z * fx - p.x * fz;
          sum.mz += (f.mz ?? 0) + p.x * fy - p.y * fx;
        };
        for (const [id, r] of Object.entries(c.result.analysis.reactions)) add(id, r);
        for (const l of c.loads) add(l.joint, l);
        for (const v of [sum.fx, sum.fy, sum.fz]) near(v, 0, 1e-6);
        for (const v of [sum.mx, sum.my, sum.mz]) near(v, 0, 1e-4);
      }
    }
  });

  it('reports forces and displacements, never a verdict', () => {
    expect(JSON.stringify(reports)).not.toMatch(VERDICT_WORDS);
  });
});

describe('inputs', () => {
  it('needs the shear modulus and the beam incising, and names them', () => {
    const { shearModulus: _g, beamIncised: _i, ...rest } = INPUTS;
    const report = swingSetAnalysis(plan(BURIED), rest);
    expect(report.status).toBe('input-needed');
    if (report.status === 'input-needed') {
      expect(report.missing).toEqual([
        'Whether the beam lumber is incised',
        "The wood's shear modulus, as a ratio to E, with its source",
      ]);
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { Part, Placement, Vec3 } from '../types.ts';
import type { SwingSetParams } from './params.ts';
import { generate, type SwingSetOutput } from './template.ts';

// Part placements (spec, Placements; template version 3). The worked example is checked against
// hand-computed values; the fit tests check, for several designs, that the parts placed this way
// touch where the spec says they meet (DOMAIN.md, Verification).

const workedExample: SwingSetParams = {
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

const designs: Record<string, SwingSetParams> = {
  'the worked example': workedExample,
  'the worked example on pads': {
    ...workedExample,
    burialDepth: 0,
    hardware: { ...workedExample.hardware, anchorsPerFoot: 1 },
  },
  'the edge of range (spec)': {
    ...workedExample,
    beamLength: 240,
    beamHeight: 144,
    splay: { kind: 'angle', degrees: 35 },
    beamStock: '2x6',
    beamPlies: 2,
    groundSlope: -3,
    burialDepth: 48,
    crossbarHeight: 100,
    swings: { ...workedExample.swings, centers: [80, 160] },
    hardware: { ...workedExample.hardware, plyBolts: { diameter: 0.5, count: 10 } },
  },
  'a three-ply beam on level ground': {
    ...workedExample,
    beamStock: '2x6',
    beamPlies: 3,
    groundSlope: 0,
    hardware: { ...workedExample.hardware, plyBolts: { diameter: 0.5, count: 6 } },
  },
};

function run(p: SwingSetParams): SwingSetOutput {
  const result = generate(p);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output;
}

const add = (...vs: Vec3[]): Vec3 =>
  vs.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }), { x: 0, y: 0, z: 0 });
const scale = (k: number, v: Vec3): Vec3 => ({ x: k * v.x, y: k * v.y, z: k * v.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** The world point at (u along, v across, n through) in a part's local frame. */
const at = (pl: Placement, u: number, v: number, n = 0): Vec3 =>
  add(pl.origin, scale(u, pl.along), scale(v, pl.across), scale(n, pl.through));

/** Where an edge (constant v) reaches height z: the point on the line through it. */
function edgeAtHeight(pl: Placement, v: number, z: number): Vec3 {
  const start = at(pl, 0, v);
  return at(pl, (z - start.z) / pl.along.z, v);
}

const tan = (degrees: number) => Math.tan((degrees * Math.PI) / 180);

function expectPoint(actual: Vec3, expected: Vec3) {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
  expect(actual.z).toBeCloseTo(expected.z, 9);
}

describe('placements in the worked example (spec, Placements)', () => {
  const out = run(workedExample);
  const find = (id: string, instance: number) => {
    const pl = out.placements?.find((p) => p.partId === id && p.instance === instance);
    if (!pl) throw new Error(`${id} ${instance}`);
    return pl;
  };

  // Hand-computed: sin 20° = 0.34202, cos 20° = 0.93969, tan 20° = 0.36397.
  it.each([
    // Beam: left end, bottom, back face. Legs: top cut on the inner edge, y = 1.75 − 5.5·0.36397.
    ['beam', 0, 0, 1.75, 96],
    ['leg-back', 0, 12, -0.252, 101.5],
    ['leg-front', 0, 15.5, 0.252, 101.5],
    ['leg-back', 1, 104.5, -0.252, 101.5],
    ['leg-front', 1, 108, 0.252, 101.5],
    // Crossbar and gusset: front end of the bottom edge, on the outside face of each frame.
    // Crossbar bottom at z = 40 − 5.5 = 34.5, half its bottom edge 55.718 / 2 = 27.859.
    ['crossbar', 0, 10.5, -27.859, 34.5],
    ['crossbar', 1, 108, -27.859, 34.5],
    // Gusset bottom at z = 96 − 7.25 = 88.75, half its bottom width 16.227 / 2 = 8.113.
    ['gusset', 0, 10.5, -8.113, 88.75],
    ['gusset', 1, 108, -8.113, 88.75],
  ] as const)('%s %i starts at (%s, %s, %s)', (id, instance, x, y, z) => {
    const { origin } = find(id, instance);
    expect(origin.x).toBeCloseTo(x, 3);
    expect(origin.y).toBeCloseTo(y, 3);
    expect(origin.z).toBeCloseTo(z, 3);
  });

  it('points the legs down and outward at the splay, and mirrors the front ones', () => {
    const back = find('leg-back', 0);
    expect(back.along.y).toBeCloseTo(0.34202, 5);
    expect(back.along.z).toBeCloseTo(-0.93969, 5);
    expect(back.across.y).toBeCloseTo(0.93969, 5);
    expect(back.through).toEqual({ x: 1, y: 0, z: 0 });
    const front = find('leg-front', 0);
    expect(front.along.y).toBeCloseTo(-0.34202, 5);
    expect(front.through).toEqual({ x: -1, y: 0, z: 0 });
  });
});

describe.each(Object.entries(designs))('placements fit together: %s', (_, params) => {
  const out = run(params);
  const g = out.geometry;
  const p = out.params;
  const placed = out.placements ?? [];
  const part = (id: string) => out.parts.find((x) => x.id === id) as Part;
  const of = (id: string) => placed.filter((x) => x.partId === id);
  const k = p.groundSlope / 12;
  const H = p.beamHeight;
  const leg = part('leg-back');
  const w = leg.stock.width;
  const t = leg.stock.thickness;
  const bw = part('beam').stock.thickness * p.beamPlies;
  const bd = part('beam').stock.width;

  it('places every piece of every part once, with unit, square, right-handed axes', () => {
    for (const x of out.parts) {
      expect(of(x.id).map((pl) => pl.instance)).toEqual([...Array(x.quantity).keys()]);
    }
    for (const pl of placed) {
      for (const axis of [pl.along, pl.across, pl.through])
        expect(dot(axis, axis)).toBeCloseTo(1, 12);
      expect(dot(pl.along, pl.across)).toBeCloseTo(0, 12);
      expectPoint(cross(pl.along, pl.across), pl.through);
    }
  });

  it('stacks the beam plies into the beam, centered on y = 0', () => {
    const ys = of('beam').flatMap((pl) => [
      at(pl, 0, 0, 0).y,
      at(pl, 0, 0, part('beam').stock.thickness).y,
    ]);
    expect(Math.max(...ys)).toBeCloseTo(bw / 2, 9);
    expect(Math.min(...ys)).toBeCloseTo(-bw / 2, 9);
  });

  describe.each(['leg-back', 'leg-front'] as const)('%s', (id) => {
    const side = id === 'leg-back' ? 1 : -1;
    const legGeometry = id === 'leg-back' ? g.back : g.front;

    it('has its top cut level with the top of the beam', () => {
      for (const pl of of(id)) {
        expect(at(pl, 0, 0).z).toBeCloseTo(H + bd, 9);
        expect(at(pl, w * tan(g.splay), w).z).toBeCloseTo(H + bd, 9);
      }
    });

    it("meets the beam's lower corner with its inner face, where the flush cut starts", () => {
      for (const pl of of(id)) expect(edgeAtHeight(pl, 0, H).y).toBeCloseTo((side * bw) / 2, 9);
    });

    it('lands on the footprint: its outer face meets the ground where the layout says', () => {
      for (const pl of of(id)) {
        // The outer edge, v = w, crosses the ground z = k·y.
        const top = at(pl, 0, w);
        const u = (k * top.y - top.z) / (pl.along.z - k * pl.along.y);
        expect(at(pl, u, w).y).toBeCloseTo(side * legGeometry.outerAtGrade, 9);
      }
    });

    it('has its foot cut at the foot height, on both edges', () => {
      const length = part(id).length;
      for (const pl of of(id)) {
        expect(at(pl, length, w).z).toBeCloseTo(legGeometry.footZ, 9);
        expect(at(pl, length - w * tan(g.splay), 0).z).toBeCloseTo(legGeometry.footZ, 9);
      }
    });

    it('stands alongside the beam within its frame', () => {
      const spans = of(id)
        .map((pl) => [at(pl, 0, 0, 0).x, at(pl, 0, 0, t).x].sort((a, b) => a - b))
        .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
      expect(spans[0]?.[0]).toBeCloseTo(p.frameInset, 9);
      expect(spans[0]?.[1]).toBeCloseTo(p.frameInset + t, 9);
      expect(spans[1]?.[1]).toBeCloseTo(p.beamLength - p.frameInset, 9);
    });
  });

  /** The outer face of a frame's leg on one side at height z, from that leg's placement. */
  const outerFaceY = (frame: number, side: 'leg-back' | 'leg-front', z: number) => {
    const pl = of(side).find((x) => x.instance === frame) as Placement;
    return edgeAtHeight(pl, w, z).y;
  };

  describe.each(['crossbar', 'gusset'] as const)('%s', (id) => {
    const board = part(id);
    const width = board.stock.width;
    const s = tan(g.splay);

    it("ends flush with the legs' outer faces, at its bottom and top edges", () => {
      for (const pl of of(id)) {
        const corners = [
          [at(pl, 0, 0), 'leg-front'],
          [at(pl, width * s, width), 'leg-front'],
          [at(pl, board.length, 0), 'leg-back'],
          [at(pl, board.length - width * s, width), 'leg-back'],
        ] as const;
        for (const [corner, side] of corners) {
          expect(corner.y).toBeCloseTo(outerFaceY(pl.instance, side, corner.z), 9);
        }
      }
    });

    it("lies against the outside face of its frame's legs", () => {
      const xs = of(id).map((pl) => [at(pl, 0, 0, 0).x, at(pl, 0, 0, board.stock.thickness).x]);
      expect(Math.max(...(xs[0] ?? []))).toBeCloseTo(p.frameInset, 9);
      expect(Math.min(...(xs[1] ?? []))).toBeCloseTo(p.beamLength - p.frameInset, 9);
    });
  });

  it("puts the gusset's top edge against the beam's underside", () => {
    for (const pl of of('gusset'))
      expect(at(pl, 0, part('gusset').stock.width).z).toBeCloseTo(H, 9);
  });

  it("puts the crossbar's top edge at the crossbar height", () => {
    for (const pl of of('crossbar')) {
      expect(at(pl, 0, part('crossbar').stock.width).z).toBeCloseTo(p.crossbarHeight, 9);
    }
  });
});

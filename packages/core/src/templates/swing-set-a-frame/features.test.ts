import { describe, expect, it } from 'vitest';
import type { LocalPoint, Part, Placement, Vec3 } from '../types.ts';
import type { SwingSetParams } from './params.ts';
import { generate, type SwingSetOutput } from './template.ts';

// Holes, bolt areas, and the flush cut (spec, Holes and joints; template version 4). The worked
// example is checked against hand-computed values. The fit tests place each feature in 3D with
// the part's placement and check it lands where the spec says: the flush cut on the beam's back
// face, the leg bolt's hole in line with the beam's, the bolt areas where the parts overlap.

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
};

function run(p: SwingSetParams): SwingSetOutput {
  const result = generate(p);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output;
}

const part = (out: SwingSetOutput, id: string) => out.parts.find((x) => x.id === id) as Part;
const placed = (out: SwingSetOutput, id: string) =>
  (out.placements ?? []).filter((x) => x.partId === id);

/** A point in a part's frame, in world coordinates. */
const world = (pl: Placement, q: { u: number; v: number; n?: number }): Vec3 => ({
  x: pl.origin.x + q.u * pl.along.x + q.v * pl.across.x + (q.n ?? 0) * pl.through.x,
  y: pl.origin.y + q.u * pl.along.y + q.v * pl.across.y + (q.n ?? 0) * pl.through.y,
  z: pl.origin.z + q.u * pl.along.z + q.v * pl.across.z + (q.n ?? 0) * pl.through.z,
});
/** A direction in a part's frame, in world coordinates. */
const turn = (pl: Placement, d: LocalPoint): Vec3 => ({
  x: d.u * pl.along.x + d.v * pl.across.x + d.n * pl.through.x,
  y: d.u * pl.along.y + d.v * pl.across.y + d.n * pl.through.y,
  z: d.u * pl.along.z + d.v * pl.across.z + d.n * pl.through.z,
});

describe('the worked example (spec, Holes and joints)', () => {
  const out = run(workedExample);
  const leg = part(out, 'leg-back');

  it('marks the flush cut where it can be measured: 5-7/8" down the edge, 2" along the top', () => {
    // Start: bd / cos α = 5.5 / 0.93969 = 5.853 down the inner edge from the top corner.
    // End: on the top cut, bd·sin α = 1.881 in from the edge, so u = 1.881·tan α = 0.685.
    const [cut] = leg.tapers ?? [];
    expect(cut?.start.u).toBeCloseTo(5.853, 3);
    expect(cut?.start.v).toBe(0);
    expect(cut?.end.u).toBeCloseTo(0.685, 3);
    expect(cut?.end.v).toBeCloseTo(1.881, 3);
    expect(leg.notes[0]).toBe(
      'Flush cut on the inside face at the top: mark the inner edge 5-7/8" down from the top corner, and the top cut 2" from that corner (1-7/8" in from the edge, square to it). Cut along the line between the marks, through the leg; it runs at 20.0° to the inner edge.',
    );
  });

  it('places the leg bolt hole on the outer edge, through to the flush cut', () => {
    // Entry: (bd/2 + w·sin α) / cos α = (2.75 + 1.197) / 0.93969 = 4.200 down the outer edge,
    // mid-thickness. Length: w / cos α − (bd/2)·tan α = 3.725 − 1.001 = 2.724.
    const [hole] = leg.holes ?? [];
    expect(hole?.entry.u).toBeCloseTo(4.2, 3);
    expect(hole?.entry.v).toBe(3.5);
    expect(hole?.entry.n).toBe(1.75);
    expect(hole?.length).toBeCloseTo(2.724, 3);
    expect(hole?.diameter).toBe(0.5);
  });

  it('drills the beam at each frame centerline, mid-depth', () => {
    expect(part(out, 'beam').holes?.map((h) => h.entry)).toEqual([
      { u: 13.75, v: 2.75, n: 0 },
      { u: 106.25, v: 2.75, n: 0 },
    ]);
  });

  it('gives each crossbar joint its bolt count and the area it shares with the leg', () => {
    // From the end cut: w / cos α = 3.725 along the bottom edge; up 5.5, the end cut is
    // 5.5·tan α = 2.002 in, so the area's top runs from 2.002 to 5.726.
    const [front] = part(out, 'crossbar').boltAreas ?? [];
    expect(front?.count).toBe(2);
    expect(front?.withPart).toBe('leg-front');
    const outline = front?.outline.map(({ u, v }) => [u.toFixed(3), v.toFixed(3)]);
    expect(outline).toEqual([
      ['0.000', '0.000'],
      ['3.725', '0.000'],
      ['5.726', '5.500'],
      ['2.002', '5.500'],
    ]);
  });

  it('says every end cut is a miter, measured from the reference edge', () => {
    for (const x of out.parts) {
      expect(x.referenceEdge).toBeTruthy();
      for (const end of x.ends) expect(end.measuredFrom).toBe('reference-edge');
    }
    expect(leg.referenceEdge).toBe('inner edge, against the beam');
  });
});

describe.each(Object.entries(designs))('features fit together: %s', (_, params) => {
  const out = run(params);
  const p = out.params;
  const beam = part(out, 'beam');
  const bw = beam.stock.thickness * p.beamPlies;
  const bd = beam.stock.width;
  const H = p.beamHeight;

  describe.each(['leg-back', 'leg-front'] as const)('%s', (id) => {
    const side = id === 'leg-back' ? 1 : -1;
    const leg = part(out, id);

    it("puts the flush cut on the beam's face, from its underside to its top", () => {
      const [cut] = leg.tapers ?? [];
      if (!cut) throw new Error('no flush cut');
      for (const pl of placed(out, id)) {
        const start = world(pl, cut.start);
        const end = world(pl, cut.end);
        expect(start.y).toBeCloseTo((side * bw) / 2, 9);
        expect(start.z).toBeCloseTo(H, 9);
        expect(end.y).toBeCloseTo((side * bw) / 2, 9);
        expect(end.z).toBeCloseTo(H + bd, 9);
      }
    });

    it("lines the leg bolt's hole up with the beam's, at mid-depth of the beam", () => {
      const [hole] = leg.holes ?? [];
      if (!hole) throw new Error('no hole');
      for (const pl of placed(out, id)) {
        const entry = world(pl, hole.entry);
        const direction = turn(pl, hole.direction);
        const exit = world(pl, {
          u: hole.entry.u + hole.length * hole.direction.u,
          v: hole.entry.v + hole.length * hole.direction.v,
          n: hole.entry.n,
        });
        // Horizontal, toward the beam, at mid-depth, on the frame's centerline.
        expect(direction.y).toBeCloseTo(-side, 9);
        expect(direction.z).toBeCloseTo(0, 9);
        expect(entry.z).toBeCloseTo(H + bd / 2, 9);
        expect(exit.z).toBeCloseTo(H + bd / 2, 9);
        // It leaves the leg through the flush cut, against the beam's face.
        expect(exit.y).toBeCloseTo((side * bw) / 2, 9);
        // The beam's hole for this frame is at the same x and height.
        expect(out.geometry.supportsX.some((x) => Math.abs(x - entry.x) < 1e-9)).toBe(true);
      }
    });
  });

  it("drills the beam on the leg bolts' line, through every ply", () => {
    for (const pl of placed(out, 'beam')) {
      for (const hole of beam.holes ?? []) {
        const entry = world(pl, hole.entry);
        expect(entry.z).toBeCloseTo(H + bd / 2, 9);
        expect(hole.length).toBeCloseTo(beam.stock.thickness, 9);
      }
    }
    expect(beam.boltAreas?.[0]?.count).toBe(p.hardware.plyBolts?.count);
  });

  describe.each([
    ['crossbar', p.crossbarHeight - part(out, 'crossbar').stock.width, p.crossbarHeight],
    ['gusset', H - part(out, 'gusset').stock.width, H],
  ] as const)('%s', (id, z0, z1) => {
    const board = part(out, id);

    it("outlines each joint where the board and the leg overlap, at the leg's faces", () => {
      for (const pl of placed(out, id)) {
        for (const area of board.boltAreas ?? []) {
          const legPl = placed(out, area.withPart).find((x) => x.instance === pl.instance);
          if (!legPl) throw new Error(area.withPart);
          const s = Math.sign(legPl.across.y);
          const w = part(out, area.withPart).stock.width;
          for (const corner of area.outline) {
            const at = world(pl, corner);
            // Every corner is within the board's height and between the leg's two faces.
            expect(at.z).toBeGreaterThanOrEqual(z0 - 1e-9);
            expect(at.z).toBeLessThanOrEqual(z1 + 1e-9);
            const inner = world(legPl, { u: (legPl.origin.z - at.z) / -legPl.along.z, v: 0 }).y;
            const outer = world(legPl, {
              u: (legPl.origin.z + legPl.across.z * w - at.z) / -legPl.along.z,
              v: w,
            }).y;
            expect(s * at.y).toBeGreaterThanOrEqual(s * inner - 1e-9);
            expect(s * at.y).toBeLessThanOrEqual(s * outer + 1e-9);
          }
        }
      }
    });

    it("outlines the same joint on the leg, across the leg between the board's edges", () => {
      const legArea = part(out, 'leg-back').boltAreas?.find((a) => a.withPart === id);
      if (!legArea) throw new Error(id);
      for (const pl of placed(out, 'leg-back')) {
        const zs = legArea.outline.map((c) => world(pl, c).z).sort((a, b) => a - b);
        expect(zs[0]).toBeCloseTo(z0, 9);
        expect(zs[zs.length - 1]).toBeCloseTo(z1, 9);
      }
    });
  });
});

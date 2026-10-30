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
    // A 1/2" bolt, drilled 1/16" over (NDS 2024 12.1.3.2): 9/16".
    expect(hole?.boltDiameter).toBe(0.5);
    expect(hole?.diameter).toBe(0.5625);
  });

  it('drills the beam at each frame centerline, mid-depth', () => {
    expect(part(out, 'beam').holes?.map((h) => h.entry)).toEqual([
      { u: 13.75, v: 2.75, n: 0 },
      { u: 106.25, v: 2.75, n: 0 },
    ]);
  });

  // Spec, Bolt layout. The bolt line is the leg's centerline, w / (2·cos α) = 3.5 / 1.87939 =
  // 1.862 along the board from the leg's outer face; the board runs 7D − 1.862 = 3.5 − 1.862 =
  // 1.638 past it, so the bolt line is 3.5 from the end cut. Two bolts at 1/4 and 3/4 of the
  // board's width.
  it('runs the crossbar 1.638 past each leg and drills it 3.5 from each end cut', () => {
    expect(out.geometry.crossbar.pastLeg).toBeCloseTo(1.638, 3);
    const holes = (part(out, 'crossbar').holes ?? []).map((h) => [
      h.entry.u.toFixed(3),
      h.entry.v.toFixed(3),
    ]);
    // u = v·tan α + 3.5 from the first end; from the second, 58.993 − v·tan α − 3.5.
    expect(holes).toEqual([
      ['4.000', '1.375'],
      ['54.993', '1.375'],
      ['5.001', '4.125'],
      ['53.992', '4.125'],
    ]);
  });

  it('drills the leg for the crossbar and gusset bolts on its centerline', () => {
    // u = (top + (w/2)·sin α − z) / cos α, top = 101.5: crossbar bolts at z = 34.5 + 1.375 and
    // 34.5 + 4.125, gusset bolts at z = 88.75 + 1.8125 and 88.75 + 5.4375.
    const holes = (leg.holes ?? [])
      .filter((h) => h.hardwareId !== 'leg-beam-bolts')
      .map((h) => [h.hardwareId, h.entry.u.toFixed(3), h.entry.v]);
    expect(holes).toEqual([
      ['crossbar-bolts', '70.474', 1.75],
      ['crossbar-bolts', '67.547', 1.75],
      ['gusset-bolts', '12.276', 1.75],
      ['gusset-bolts', '8.419', 1.75],
    ]);
    expect(leg.boltAreas).toEqual([]);
  });

  it("states each joint's distances against NDS 2024, and flags the leg's edge distance", () => {
    const [crossbar, gusset, legToBeam] = out.boltLayout ?? [];
    const values = (j: typeof crossbar) =>
      j?.distances.map((d) => [d.member, d.label.split(',')[0], Number(d.value.toFixed(4))]);
    expect(values(crossbar)).toEqual([
      ['Crossbar', 'End distance', 3.5],
      ['Crossbar', 'Edge distance', 1.375],
      ['Crossbar', 'Spacing between rows', 2.75],
      ['Crossbar', 'Between the outermost bolts', 2.75],
      ['Leg', 'Edge distance', 1.75],
      // 2.75 / cos α along the leg.
      ['Leg', 'Spacing between bolts in a row', 2.9265],
    ]);
    expect(values(gusset)?.[0]).toEqual(['Gusset', 'End distance', 3.5]);
    expect(values(legToBeam)).toEqual([
      ['Beam', 'End distance', 13.75],
      ['Beam', 'Edge distance', 2.75],
    ]);
    // The leg is 3.5 wide: 1.75 to each edge, under 4D = 2 for an edge the load pushes toward.
    const boltFlags = out.flags.filter((f) => f.ask.includes('bolts:'));
    expect(boltFlags.map((f) => f.ask.split(',')[0])).toEqual(['Crossbar to leg', 'Gusset to leg']);
    expect(boltFlags[0]?.ask).toContain('leg edge distance 1-3/4" (3.5D): under 4D (2")');
  });

  it('asks about the projecting ends, with how far and how high', () => {
    const flag = out.flags.find((f) => f.ask.includes('project past the legs'));
    // Crossbar 34.5 to 40 above the ground, gusset 88.75 to 96.
    expect(flag?.ask).toBe(
      'For the bolts\' end distance, the crossbar ends 1-5/8", 2\' 10-1/2" to 3\' 4" above the ground, and the gusset ends 1-5/8", 7\' 4-3/4" to 8\' 0" above the ground project past the legs. Confirm the projecting ends are acceptable where children play, with their edges and corners eased.',
    );
  });

  it("says how far past the leg each board's ends run, and where to drill", () => {
    const crossbar = part(out, 'crossbar');
    expect(crossbar.ends.map((e) => e.description)).toEqual([
      '1-5/8" past the leg, parallel to it',
      '1-5/8" past the leg, parallel to it',
    ]);
    expect(crossbar.notes[1]).toBe(
      'Bolt holes, 2 at each end: on a line parallel to the end cut, 3-1/2" from it, 1-3/8" and 4-1/8" up from the bottom edge. Clamp it in place and drill through it and the leg together.',
    );
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

  describe.each(['crossbar', 'gusset'] as const)('%s', (id) => {
    const board = part(out, id);

    it('lines every hole up with a hole in a leg, through the board and into the leg', () => {
      for (const pl of placed(out, id)) {
        const legs = (['leg-front', 'leg-back'] as const).flatMap((legId) =>
          placed(out, legId)
            .filter((x) => x.instance === pl.instance)
            .flatMap((legPl) =>
              (part(out, legId).holes ?? [])
                .filter((h) => h.hardwareId === `${id}-bolts`)
                .map((h) => ({ at: world(legPl, h.entry), dir: turn(legPl, h.direction) })),
            ),
        );
        const holes = board.holes ?? [];
        expect(holes).toHaveLength(
          2 *
            (id === 'crossbar'
              ? p.hardware.crossbarBolts.perJoint
              : p.hardware.gussetBolts.perJoint),
        );
        for (const hole of holes) {
          const at = world(pl, hole.entry);
          // Square to the frame, so it runs along x into the leg beside the board.
          expect(Math.abs(turn(pl, hole.direction).x)).toBeCloseTo(1, 9);
          const match = legs.find(
            (l) => Math.abs(l.at.y - at.y) < 1e-9 && Math.abs(l.at.z - at.z) < 1e-9,
          );
          expect(match, `${id} hole at ${hole.entry.u}, ${hole.entry.v}`).toBeDefined();
          expect(Math.abs(match?.dir.x ?? 0)).toBeCloseTo(1, 9);
        }
      }
    });

    it('keeps 7D of end distance to each end cut, on every bolt line', () => {
      const D =
        id === 'crossbar' ? p.hardware.crossbarBolts.diameter : p.hardware.gussetBolts.diameter;
      const tan = Math.tan((out.geometry.splay * Math.PI) / 180);
      for (const hole of board.holes ?? []) {
        const { u, v } = hole.entry;
        const toEnd = Math.min(u - v * tan, board.length - v * tan - u);
        expect(toEnd).toBeGreaterThanOrEqual(7 * D - 1e-9);
      }
    });
  });
});

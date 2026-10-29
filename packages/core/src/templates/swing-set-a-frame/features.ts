import { formatLength } from '../../units/length.ts';
import type { BoltArea, Hole, Taper } from '../types.ts';
import type { Dimensions, FrameGeometry } from './geometry.ts';
import type { SwingSetParams } from './params.ts';

// Holes, bolt areas, and the flush cut, in each part's own frame (spec, Holes and joints;
// template version 4). Frames as in placements.ts: u along the part from its first end, v across
// from its reference edge, n through its thickness.

const RAD = Math.PI / 180;

export interface PartFeatures {
  referenceEdge: string;
  holes: Hole[];
  boltAreas: BoltArea[];
  tapers: Taper[];
}

type Point = { u: number; v: number };

export function features(
  p: SwingSetParams,
  dims: Dimensions,
  g: FrameGeometry,
): Record<'beam' | 'leg' | 'crossbar' | 'gusset', PartFeatures> {
  const a = g.splay * RAD;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const tan = Math.tan(a);
  const h = p.hardware;
  const top = dims.H + dims.bd;
  const plyThickness = dims.bw / dims.plies;

  // Leg-to-beam bolt (spec, Top of the leg): horizontal, at mid-depth of the beam, through the
  // middle of the leg's thickness. It enters the leg's outer edge and leaves through the flush
  // cut, so it meets the outer face at α from square (the tilted bearing face on the checklist).
  const boltZ = dims.H + dims.bd / 2;
  const legBoltHole: Hole = {
    hardwareId: 'leg-beam-bolts',
    diameter: h.legBoltDiameter,
    // On the outer edge (v = w), where z = top + w·sin α − u·cos α equals the bolt's height.
    entry: { u: (top + dims.w * sin - boltZ) / cos, v: dims.w, n: dims.t / 2 },
    // Toward the beam, horizontally: in the leg's frame, (−sin α, −cos α, 0).
    direction: { u: -sin, v: -cos, n: 0 },
    // Outer face to flush face at the bolt's height: w / cos α − (bd/2)·tan α.
    length: dims.w / cos - (dims.bd / 2) * tan,
  };

  // The flush cut (spec, Top of the leg): a vertical face at y = bw/2, from the beam's underside
  // to the top cut. On the leg it starts on the inner edge bd / cos α from the top corner and ends
  // on the top cut bd·tan α from that corner, bd·sin α in from the edge square to it.
  const flushCut: Taper = {
    description: 'Flush cut',
    start: { u: dims.bd / cos, v: 0 },
    end: { u: dims.bd * sin * tan, v: dims.bd * sin },
    angleToEdge: g.splay,
  };

  // Where a horizontal board, between heights z0 and z1, crosses the leg: a band across the leg's
  // full width, in the leg's frame (u = (top + v·sin α − z) / cos α).
  const band = (z0: number, z1: number): Point[] => {
    const u = (v: number, z: number) => (top + v * sin - z) / cos;
    return [
      { u: u(0, z1), v: 0 },
      { u: u(dims.w, z1), v: dims.w },
      { u: u(dims.w, z0), v: dims.w },
      { u: u(0, z0), v: 0 },
    ];
  };

  // Where a leg crosses a board whose ends are flush with the legs' outer faces, in the board's
  // frame: from the end cut, the leg's width w / cos α along the board, up its full width.
  const ends = (length: number, width: number): [Point[], Point[]] => {
    const across = dims.w / cos;
    return [
      [
        { u: 0, v: 0 },
        { u: across, v: 0 },
        { u: width * tan + across, v: width },
        { u: width * tan, v: width },
      ],
      [
        { u: length, v: 0 },
        { u: length - across, v: 0 },
        { u: length - width * tan - across, v: width },
        { u: length - width * tan, v: width },
      ],
    ];
  };

  const crossbarArea = (outline: Point[], withPart: string): BoltArea => ({
    hardwareId: 'crossbar-bolts',
    count: h.crossbarBolts.perJoint,
    diameter: h.crossbarBolts.diameter,
    withPart,
    outline,
  });
  const gussetArea = (outline: Point[], withPart: string): BoltArea => ({
    hardwareId: 'gusset-bolts',
    count: h.gussetBolts.perJoint,
    diameter: h.gussetBolts.diameter,
    withPart,
    outline,
  });

  const [crossbarFront, crossbarBack] = ends(g.crossbar.bottomEdge, dims.cw);
  const [gussetFront, gussetBack] = ends(g.gusset.bottomWidth, dims.gh);

  // The beam: one leg-to-beam bolt hole per frame, at the frame's centerline and the beam's
  // mid-depth, through each ply. Ply bolts, for a built-up beam, go anywhere along the beam.
  const beamHoles: Hole[] = g.supportsX.map((x) => ({
    hardwareId: 'leg-beam-bolts',
    diameter: h.legBoltDiameter,
    entry: { u: x, v: dims.bd / 2, n: 0 },
    direction: { u: 0, v: 0, n: 1 },
    length: plyThickness,
  }));
  const plyArea: BoltArea[] =
    dims.plies > 1 && h.plyBolts
      ? [
          {
            hardwareId: 'ply-bolts',
            count: h.plyBolts.count,
            diameter: h.plyBolts.diameter,
            withPart: 'beam',
            outline: [
              { u: 0, v: 0 },
              { u: dims.L, v: 0 },
              { u: dims.L, v: dims.bd },
              { u: 0, v: dims.bd },
            ],
          },
        ]
      : [];

  return {
    beam: {
      referenceEdge: 'bottom edge',
      holes: beamHoles,
      boltAreas: plyArea,
      tapers: [],
    },
    leg: {
      referenceEdge: 'inner edge, against the beam',
      holes: [legBoltHole],
      boltAreas: [
        crossbarArea(band(dims.zc - dims.cw, dims.zc), 'crossbar'),
        gussetArea(band(dims.H - dims.gh, dims.H), 'gusset'),
      ],
      tapers: [flushCut],
    },
    crossbar: {
      referenceEdge: 'bottom edge',
      holes: [],
      boltAreas: [crossbarArea(crossbarFront, 'leg-front'), crossbarArea(crossbarBack, 'leg-back')],
      tapers: [],
    },
    gusset: {
      referenceEdge: 'bottom edge',
      holes: [],
      boltAreas: [gussetArea(gussetFront, 'leg-front'), gussetArea(gussetBack, 'leg-back')],
      tapers: [],
    },
  };
}

/**
 * The flush cut as marks a builder can measure (#50): a point on the inner edge from the top
 * corner, a point on the top cut from the same corner, and a line between them.
 */
export function flushCutNote(cut: Taper, angle: string, depthSquare: number): string {
  const alongTopCut = Math.hypot(cut.end.u, cut.end.v);
  return `Flush cut on the inside face at the top: mark the inner edge ${formatLength(cut.start.u)} down from the top corner, and the top cut ${formatLength(alongTopCut)} from that corner (${formatLength(depthSquare)} in from the edge, square to it). Cut along the line between the marks, through the leg; it runs at ${angle} to the inner edge.`;
}

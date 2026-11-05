import { z } from 'zod';
import { stock } from '../../lumber/stock.ts';
import { fullValueEndDistance } from '../../structural/boltDistances.ts';
import type { SwingSetParams } from './params.ts';

// Geometry for template version 1. Every formula here is written out, with a hand-checked worked
// example, in docs/templates/swing-set-a-frame.md; section names below refer to that spec.
// Coordinates: y front to back (front is negative), z up, z = 0 is the ground under the beam. The
// legs', crossbars', and gussets' lengths come from the joints (joints.ts); a plan stores them with
// the rest.

const RAD = Math.PI / 180;

/** Actual dimensions in the orientation each part is used (spec, Parameters). */
export interface Dimensions {
  L: number;
  H: number;
  /** Beam plies: 1 for a solid beam. */
  plies: number;
  /** Thickness of one beam board, to check built-up beams use 2x stock. */
  beamBoardThickness: number;
  /** Beam width (horizontal, all plies together) and depth (vertical). */
  bw: number;
  bd: number;
  /** Leg size toward the beam, and along the beam. */
  w: number;
  t: number;
  /** Crossbar vertical depth, and thickness along the beam. */
  cw: number;
  ct: number;
  zc: number;
  /** Gusset height below the beam, and thickness. */
  gh: number;
  gt: number;
  /** Bolt diameters at the crossbar and gusset joints. */
  cD: number;
  gD: number;
  e: number;
  /** Ground slope as rise per run toward the back: g / 12. */
  k: number;
  d: number;
}

export function dimensions(p: SwingSetParams): Dimensions {
  const beam = stock(p.beamStock);
  const leg = stock(p.legStock);
  const crossbar = stock(p.crossbarStock);
  const gusset = stock(p.gussetStock);
  return {
    L: p.beamLength,
    H: p.beamHeight,
    plies: p.beamPlies,
    beamBoardThickness: beam.thickness,
    bw: beam.thickness * p.beamPlies,
    bd: beam.width,
    w: leg.width,
    t: leg.thickness,
    cw: crossbar.width,
    ct: crossbar.thickness,
    zc: p.crossbarHeight,
    gh: gusset.width,
    gt: gusset.thickness,
    cD: p.hardware.crossbarBolts.diameter,
    gD: p.hardware.gussetBolts.diameter,
    e: p.frameInset,
    k: p.groundSlope / 12,
    d: p.burialDepth,
  };
}

const LegGeometry = z.object({
  /** Height where the leg's centerline meets the ground (spec, Where the leg meets the ground). */
  groundZ: z.number(),
  /** Height of the foot's level cut. */
  footZ: z.number(),
  /** Each edge, top cut to foot cut, from the joints. */
  edgeLength: z.number(),
  /** Long point to long point, from the joints. */
  overallLength: z.number(),
  /** Length of leg below grade, along the leg. */
  belowGrade: z.number(),
  /** Plan-view distance from the beam's centerline to the leg's outer face at grade. */
  outerAtGrade: z.number(),
});
type LegGeometry = z.infer<typeof LegGeometry>;

/** The geometry a plan stores: what is derived before the joints, and the lengths they give. */
export const FrameGeometry = z.object({
  /** Splay from vertical, degrees. */
  splay: z.number(),
  flushCut: z.object({
    /** Depth at the top of the beam, square to the leg's face. */
    depthAtTop: z.number(),
    /**
     * Distance between the flush cut's two ends along the leg's axis, bd·cos α. Not a distance
     * to mark: the marks are the taper on the leg part (spec, Top of the leg; #50).
     */
    lengthAlongLeg: z.number(),
    woodLeftAtTop: z.number(),
    woodLeftAtBolt: z.number(),
  }),
  /** Through both legs and the beam, at mid-depth of the beam. */
  boltGrip: z.number(),
  back: LegGeometry,
  front: LegGeometry,
  footprintDepth: z.number(),
  /**
   * The edges' lengths are from the joints. `pastLeg`: how far each end runs past the legs' outer
   * faces, along the board (spec, Bolt layout; template version 6). Optional so plans made before
   * it read as they are.
   */
  crossbar: z.object({
    topEdge: z.number(),
    bottomEdge: z.number(),
    pastLeg: z.number().optional(),
  }),
  gusset: z.object({
    topWidth: z.number(),
    bottomWidth: z.number(),
    height: z.number(),
    pastLeg: z.number().optional(),
  }),
  /**
   * Frame centerlines along the beam, where the leg-to-beam bolts go. The beam checks support the
   * beam on the gussets instead (`beamSupports` in structural.ts).
   */
  supportsX: z.tuple([z.number(), z.number()]),
});
export type FrameGeometry = z.infer<typeof FrameGeometry>;

type LegShape = Omit<LegGeometry, 'edgeLength' | 'overallLength'>;

/** The geometry derived before the joints: everything a plan stores but the lengths they give. */
export type FrameShape = Omit<FrameGeometry, 'back' | 'front' | 'crossbar' | 'gusset'> & {
  back: LegShape;
  front: LegShape;
  crossbar: Omit<FrameGeometry['crossbar'], 'topEdge' | 'bottomEdge'>;
  gusset: Omit<FrameGeometry['gusset'], 'topWidth' | 'bottomWidth'>;
};

/** A part as its joints cut it: its length and each edge's length (joints/trim.ts). */
interface Cut {
  length: number;
  edges: { reference: number; far: number };
}

/**
 * The geometry a plan stores, with the lengths the joints give, by part ID. A leg is marked along
 * its reference edge, and a board's top edge is its far edge.
 */
export function storedGeometry(g: FrameShape, cutOf: (id: string) => Cut): FrameGeometry {
  const leg = (shape: LegShape, cut: Cut): LegGeometry => ({
    ...shape,
    edgeLength: cut.edges.reference,
    overallLength: cut.length,
  });
  const crossbar = cutOf('crossbar');
  const gusset = cutOf('gusset');
  // Parsed so it has the stored shape exactly.
  return FrameGeometry.parse({
    ...g,
    back: leg(g.back, cutOf('leg-back')),
    front: leg(g.front, cutOf('leg-front')),
    crossbar: {
      ...g.crossbar,
      topEdge: crossbar.edges.far,
      bottomEdge: crossbar.edges.reference,
    },
    gusset: { ...g.gusset, topWidth: gusset.edges.far, bottomWidth: gusset.edges.reference },
  });
}

/**
 * How far a board's end runs past the leg's outer face, along the board (spec, Bolt layout). The
 * bolts sit on the leg's centerline, w / (2·cos α) along the board from the outer face; the end
 * goes far enough past it for the full-value end distance whichever way the bolt bears (NDS 2024
 * Table 12.5.1A, softwood: 7D). Never less than flush.
 */
function pastLeg(dims: Dimensions, splay: number, diameter: number): number {
  const a = splay * RAD;
  return Math.max(0, fullValueEndDistance(diameter, 'softwood') - dims.w / (2 * Math.cos(a)));
}

/** One leg, given the ground slope seen from its side: k for the back leg, −k for the front. */
function leg(dims: Dimensions, splay: number, k: number): LegShape {
  const a = splay * RAD;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const tan = Math.tan(a);
  const qy = dims.bw / 2 + dims.w / (2 * cos);
  const qz = dims.H;
  const s = (qz - k * qy) / (cos + k * sin);
  const groundZ = qz - s * cos;
  return {
    groundZ,
    footZ: groundZ - dims.d,
    belowGrade: dims.d / cos,
    outerAtGrade: (dims.bw / 2 + dims.w / cos + dims.H * tan) / (1 + k * tan),
  };
}

/**
 * Whether the ground meets each leg below the beam. A slope steep enough to make the
 * denominator in `leg` zero or negative has no meaningful foot.
 */
export function legsReachGround(dims: Dimensions, splay: number): boolean {
  const a = splay * RAD;
  return (
    Math.cos(a) + dims.k * Math.sin(a) > 0 &&
    Math.cos(a) - dims.k * Math.sin(a) > 0 &&
    1 + dims.k * Math.tan(a) > 0 &&
    1 - dims.k * Math.tan(a) > 0
  );
}

export function frameGeometry(dims: Dimensions, splay: number): FrameShape {
  const a = splay * RAD;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const tan = Math.tan(a);
  const back = leg(dims, splay, dims.k);
  const front = leg(dims, splay, -dims.k);
  const depthAtTop = dims.bd * sin;
  return {
    splay,
    flushCut: {
      depthAtTop,
      lengthAlongLeg: dims.bd * cos,
      woodLeftAtTop: dims.w - depthAtTop,
      woodLeftAtBolt: dims.w - (dims.bd / 2) * sin,
    },
    boltGrip: dims.bw + 2 * (dims.w / cos - (dims.bd / 2) * tan),
    back,
    front,
    footprintDepth: back.outerAtGrade + front.outerAtGrade,
    crossbar: { pastLeg: pastLeg(dims, splay, dims.cD) },
    gusset: { height: dims.gh, pastLeg: pastLeg(dims, splay, dims.gD) },
    supportsX: [dims.e + dims.t / 2, dims.L - dims.e - dims.t / 2],
  };
}

const SPLAY_RANGE = { min: 5, max: 35 } as const;

/**
 * Splay angle that gives a footprint depth (spec, Footprint at grade), or null when the footprint
 * is outside what the allowed splay range can produce. Footprint depth grows with splay, so
 * bisection converges; 60 halvings narrow a 30° range far below any measurable difference.
 */
export function splayForFootprint(dims: Dimensions, depth: number): number | null {
  const footprint = (splay: number) => frameGeometry(dims, splay).footprintDepth;
  let lo: number = SPLAY_RANGE.min;
  let hi: number = SPLAY_RANGE.max;
  if (!legsReachGround(dims, hi)) return null;
  if (depth < footprint(lo) || depth > footprint(hi)) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (footprint(mid) < depth) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

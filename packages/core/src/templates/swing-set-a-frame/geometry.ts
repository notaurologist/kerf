import { z } from 'zod';
import { stock } from '../../lumber/stock.ts';
import type { SwingSetParams } from './params.ts';

// Geometry for template version 1. Every formula here is written out, with a hand-checked worked
// example, in docs/templates/swing-set-a-frame.md; section names below refer to that spec.
// Coordinates: y front to back (front is negative), z up, z = 0 is the ground under the beam.

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
    e: p.frameInset,
    k: p.groundSlope / 12,
    d: p.burialDepth,
  };
}

export const LegGeometry = z.object({
  /** Height where the leg's centerline meets the ground (spec, Where the leg meets the ground). */
  groundZ: z.number(),
  /** Height of the foot's level cut. */
  footZ: z.number(),
  /** Each edge, top cut to foot cut. */
  edgeLength: z.number(),
  /** Long point to long point. */
  overallLength: z.number(),
  /** Length of leg below grade, along the leg. */
  belowGrade: z.number(),
  /** Plan-view distance from the beam's centerline to the leg's outer face at grade. */
  outerAtGrade: z.number(),
});
export type LegGeometry = z.infer<typeof LegGeometry>;

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
  crossbar: z.object({ topEdge: z.number(), bottomEdge: z.number() }),
  gusset: z.object({ topWidth: z.number(), bottomWidth: z.number(), height: z.number() }),
  /** Frame centerlines along the beam: the supports for the structural checks. */
  supportsX: z.tuple([z.number(), z.number()]),
});
export type FrameGeometry = z.infer<typeof FrameGeometry>;

/** Outer face of the back leg at height z (spec, Leg faces). */
function outerFaceY(dims: Dimensions, splay: number, z: number): number {
  const a = splay * RAD;
  return dims.bw / 2 + (dims.H - z) * Math.tan(a) + dims.w / Math.cos(a);
}

/** One leg, given the ground slope seen from its side: k for the back leg, −k for the front. */
function leg(dims: Dimensions, splay: number, k: number): LegGeometry {
  const a = splay * RAD;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const tan = Math.tan(a);
  const qy = dims.bw / 2 + dims.w / (2 * cos);
  const qz = dims.H;
  const s = (qz - k * qy) / (cos + k * sin);
  const groundZ = qz - s * cos;
  const footZ = groundZ - dims.d;
  const edgeLength = (dims.H + dims.bd - footZ) / cos;
  return {
    groundZ,
    footZ,
    edgeLength,
    overallLength: edgeLength + dims.w * tan,
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

export function frameGeometry(dims: Dimensions, splay: number): FrameGeometry {
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
    crossbar: {
      topEdge: 2 * outerFaceY(dims, splay, dims.zc),
      bottomEdge: 2 * outerFaceY(dims, splay, dims.zc - dims.cw),
    },
    gusset: {
      topWidth: 2 * outerFaceY(dims, splay, dims.H),
      bottomWidth: 2 * outerFaceY(dims, splay, dims.H - dims.gh),
      height: dims.gh,
    },
    supportsX: [dims.e + dims.t / 2, dims.L - dims.e - dims.t / 2],
  };
}

export const SPLAY_RANGE = { min: 5, max: 35 } as const;

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

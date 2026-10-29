import type { Placement, Vec3 } from '../types.ts';
import type { Dimensions, FrameGeometry } from './geometry.ts';

// Where each part instance sits in 3D (spec, Placements; template version 3). Coordinates as in
// geometry.ts: x along the beam from its left end, y front (negative) to back, z up from the
// ground under the beam. Each part's local frame is defined with Placement in ../types.ts.

const RAD = Math.PI / 180;
const X: Vec3 = { x: 1, y: 0, z: 0 };
const MINUS_X: Vec3 = { x: -1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const MINUS_Y: Vec3 = { x: 0, y: -1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

/** Outer face of a leg at height z, as a distance from the beam's centerline (spec, Leg faces). */
function outerFace(dims: Dimensions, splay: number, z: number): number {
  const a = splay * RAD;
  return dims.bw / 2 + (dims.H - z) * Math.tan(a) + dims.w / Math.cos(a);
}

export function placements(dims: Dimensions, g: FrameGeometry): Placement[] {
  const a = g.splay * RAD;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const tan = Math.tan(a);
  const top = dims.H + dims.bd;
  // The legs' inner faces at the top cut, before the flush cut: y_in(H + bd) = bw/2 − bd·tan α.
  const innerAtTop = dims.bw / 2 - dims.bd * tan;
  const plyThickness = dims.bw / dims.plies;

  // Frames: the left frame's legs occupy x from e to e + t, the right frame's from L − e − t to
  // L − e (spec, Positions along the beam). Crossbars and gussets sit on each frame's outside face.
  const frames = [
    { legsFrom: dims.e, outside: dims.e, outward: -1 },
    { legsFrom: dims.L - dims.e - dims.t, outside: dims.L - dims.e, outward: 1 },
  ];

  // The beam: first end at x = 0, reference edge its bottom (z = H), plies stacked from the back
  // face toward the front.
  const beam = Array.from({ length: dims.plies }, (_, i) => ({
    partId: 'beam',
    instance: i,
    origin: { x: 0, y: dims.bw / 2 - i * plyThickness, z: dims.H },
    along: X,
    across: Z,
    through: MINUS_Y,
  }));

  // Legs: first end the top, reference edge the inner edge (against the beam), whose top corner
  // is the top cut's long point. The back leg runs down and outward toward +y; the front leg is
  // its mirror image, so its thickness axis runs toward −x to stay right-handed.
  const legs = frames.flatMap((frame, i) => [
    {
      partId: 'leg-back',
      instance: i,
      origin: { x: frame.legsFrom, y: innerAtTop, z: top },
      along: { x: 0, y: sin, z: -cos },
      across: { x: 0, y: cos, z: sin },
      through: X,
    },
    {
      partId: 'leg-front',
      instance: i,
      origin: { x: frame.legsFrom + dims.t, y: -innerAtTop, z: top },
      along: { x: 0, y: -sin, z: -cos },
      across: { x: 0, y: -cos, z: sin },
      through: MINUS_X,
    },
  ]);

  // Crossbars and gussets: first end at the front, reference edge the bottom (the long edge),
  // ends flush with the legs' outer faces, on the frame's outside face. Through runs +x, so the
  // origin is on the face with the smaller x.
  const boards = (partId: 'crossbar' | 'gusset', bottom: number, thickness: number): Placement[] =>
    frames.map((frame, i) => ({
      partId,
      instance: i,
      origin: {
        x: frame.outward < 0 ? frame.outside - thickness : frame.outside,
        y: -outerFace(dims, g.splay, bottom),
        z: bottom,
      },
      along: Y,
      across: Z,
      through: X,
    }));

  return [
    ...beam,
    ...legs,
    ...boards('crossbar', dims.zc - dims.cw, dims.ct),
    ...boards('gusset', dims.H - dims.gh, dims.gt),
  ];
}

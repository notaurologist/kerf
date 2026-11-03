import type { Dado, Mortise, Notch, Vec3 } from '@kerf/core';
import type { PlacedPart } from './boltedLap.ts';
import type { Plane } from './trim.ts';

// A part's square end housed in another part (docs/explorations/joint-model.md, Option C): in a
// dado across a face, or as a tenon in a mortise or groove. The housed part is trimmed to
// `housingPlane`, the joint's depth inside the housing, so its length includes what goes in;
// `entering` then finds where its end goes in, on which face or edge of the housing, and checks it
// reaches the bottom. A dado stopped short of the housed part's reference edge leaves that corner
// notched.

/** Below this, two lengths are the same. */
const EPSILON = 1e-9;

/** A face or an edge of the housing, as `Mortise` names them. */
export type HousingSide = Mortise['side'];

const same = (a: number, b: number) => Math.abs(a - b) <= EPSILON;
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const plus = (p: Vec3, d: Vec3, k: number): Vec3 => ({
  x: p.x + d.x * k,
  y: p.y + d.y * k,
  z: p.z + d.z * k,
});

/** Where a side is across the housing, and the direction square to it. */
function sideOf(housing: PlacedPart, side: HousingSide) {
  const { across, through } = housing.placement;
  const { thickness, width } = housing.part.stock;
  return {
    near: { normal: through, at: 0 },
    far: { normal: through, at: thickness },
    'reference-edge': { normal: across, at: 0 },
    'far-edge': { normal: across, at: width },
  }[side];
}

/** The plane `depth` into the housing from one of its sides, parallel to it: the joint's bottom. */
export function housingPlane(housing: PlacedPart, side: HousingSide, depth: number): Plane {
  const s = sideOf(housing, side);
  const into = s.at === 0 ? depth : s.at - depth;
  return { point: plus(housing.placement.origin, s.normal, into), normal: s.normal };
}

/** The side a part running in `toward` goes into, if it meets one square. */
export function sideEntered(housing: PlacedPart, toward: Vec3): HousingSide | undefined {
  const { across, through } = housing.placement;
  const intoFace = dot(toward, through);
  const intoEdge = dot(toward, across);
  if (same(intoFace, 1)) return 'near';
  if (same(intoFace, -1)) return 'far';
  if (same(intoEdge, 1)) return 'reference-edge';
  if (same(intoEdge, -1)) return 'far-edge';
  return undefined;
}

/** An end's outline where it enters the housing: u along the housing, a across the side. */
export interface Entering {
  side: HousingSide;
  u0: number;
  u1: number;
  /** v on a face, n on an edge, as `Mortise` has them. */
  a0: number;
  a1: number;
}

/**
 * Where the housed part's end, from v0 to v1 across it and n0 to n1 through it, goes into the
 * housing: the side it enters and its outline there. The end must be square, meet the side square,
 * reach `depth` in, and stay within the housing.
 */
export function entering(
  housing: PlacedPart,
  housed: PlacedPart,
  end: 0 | 1,
  depth: number,
  v: readonly [number, number],
  n: readonly [number, number],
): { ok: true; entering: Entering } | { ok: false; message: string } {
  const p = housed.part;
  const pl = housed.placement;
  const h = housing.placement;
  if (p.ends[end].setting !== 0) return { ok: false, message: 'Only a square end can be housed.' };

  // The side it enters is the one square to the direction the part runs toward this end.
  const toward = end === 1 ? pl.along : plus({ x: 0, y: 0, z: 0 }, pl.along, -1);
  const side = sideEntered(housing, toward);
  if (!side) {
    return { ok: false, message: 'The housed part does not meet the housing square to a side.' };
  }
  const s = sideOf(housing, side);
  const bottom = s.at === 0 ? depth : s.at - depth;
  const onFace = side === 'near' || side === 'far';

  const u = end === 0 ? 0 : p.length;
  const corners = v.flatMap((cv) =>
    n.map((cn) => {
      const world = plus(plus(plus(pl.origin, pl.along, u), pl.across, cv), pl.through, cn);
      const d = sub(world, h.origin);
      const local = { u: dot(d, h.along), v: dot(d, h.across), n: dot(d, h.through) };
      return { u: local.u, a: onFace ? local.v : local.n, in: onFace ? local.n : local.v };
    }),
  );
  if (corners.some((c) => !same(c.in, bottom))) {
    return { ok: false, message: "The housed end does not reach the joint's bottom." };
  }
  const us = corners.map((c) => c.u);
  const as = corners.map((c) => c.a);
  const u0 = Math.min(...us);
  const u1 = Math.max(...us);
  const a0 = Math.min(...as);
  const a1 = Math.max(...as);
  const square = corners.every(
    (c) => (same(c.u, u0) || same(c.u, u1)) && (same(c.a, a0) || same(c.a, a1)),
  );
  if (!square) {
    return { ok: false, message: "The housed end is not square to the housing's edges." };
  }
  const across = onFace ? housing.part.stock.width : housing.part.stock.thickness;
  const length = housing.part.length;
  if (u0 < -EPSILON || a0 < -EPSILON || u1 > length + EPSILON || a1 > across + EPSILON) {
    return { ok: false, message: 'The housed end runs past the housing.' };
  }
  // An outline that reaches an edge of the housing is on it, not a float error past it: a length
  // a hair below zero cannot be shown.
  const onEdge = (value: number, edge: number) => (same(value, edge) ? edge : value);
  return {
    ok: true,
    entering: {
      side,
      u0: onEdge(u0, 0),
      u1: onEdge(u1, length),
      a0: onEdge(a0, 0),
      a1: onEdge(a1, across),
    },
  };
}

export interface HousedEnd {
  housing: PlacedPart;
  /** The housed part, trimmed to `housingPlane` at this end. */
  housed: PlacedPart;
  end: 0 | 1;
  depth: number;
  /** How far the dado stops short of the housed part's reference edge; none runs it out. */
  stop?: number;
}

export type Housed = { ok: true; dado: Dado; notch?: Notch } | { ok: false; message: string };

/** The dado a whole end goes into, and the notch a stopped dado leaves. */
export function housedEnd(joint: HousedEnd): Housed {
  const { housing, housed, end, depth } = joint;
  const stop = joint.stop ?? 0;
  const { width, thickness } = housed.part.stock;
  const found = entering(housing, housed, end, depth, [stop, width], [0, thickness]);
  if (!found.ok) return found;
  const { side, u0, u1, a0, a1 } = found.entering;
  if (side !== 'near' && side !== 'far') {
    return { ok: false, message: 'A dado is cut across a face, not an edge.' };
  }
  return {
    ok: true,
    dado: { withPart: housed.part.id, face: side, u0, u1, v0: a0, v1: a1, depth },
    ...(stop > 0 ? { notch: { end, edge: 'reference', along: depth, across: stop } } : {}),
  };
}

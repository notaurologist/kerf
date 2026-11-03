import type { Dado, Notch, Vec3 } from '@kerf/core';
import type { PlacedPart } from './boltedLap.ts';
import type { Plane } from './trim.ts';

// A part's square end housed in a dado in another part's face (docs/explorations/joint-model.md,
// Option C). The housed part is trimmed to `housingPlane`, the dado's depth inside the housing,
// so its length includes what goes into the dado; `housedEnd` then gives the dado, the shape of
// that end where it enters the housing face, and checks the end reaches the dado's bottom. A dado
// stopped short of the housed part's reference edge leaves that corner notched.

/** Below this, two lengths are the same. */
const EPSILON = 1e-9;

type Face = Dado['face'];

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const plus = (p: Vec3, d: Vec3, k: number): Vec3 => ({
  x: p.x + d.x * k,
  y: p.y + d.y * k,
  z: p.z + d.z * k,
});

/** The plane `depth` into the housing from one of its faces, parallel to it: a dado's bottom. */
export function housingPlane(housing: PlacedPart, face: Face, depth: number): Plane {
  const { origin, through } = housing.placement;
  const n = face === 'near' ? depth : housing.part.stock.thickness - depth;
  return { point: plus(origin, through, n), normal: through };
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

export function housedEnd(joint: HousedEnd): Housed {
  const { housing, housed, end, depth } = joint;
  const stop = joint.stop ?? 0;
  const p = housed.part;
  const pl = housed.placement;
  const h = housing.placement;
  if (p.ends[end].setting !== 0) return { ok: false, message: 'Only a square end can be housed.' };

  // The face it enters: the one the housed part comes in through, toward this end.
  const toward = end === 1 ? pl.along : plus({ x: 0, y: 0, z: 0 }, pl.along, -1);
  const into = dot(toward, h.through);
  if (Math.abs(Math.abs(into) - 1) > EPSILON) {
    return { ok: false, message: 'The housed part does not meet the housing square to its face.' };
  }
  const face: Face = into > 0 ? 'near' : 'far';
  const T = housing.part.stock.thickness;
  const bottom = face === 'near' ? depth : T - depth;

  // The end's four corners, past the stop, in the housing's frame.
  const u = end === 0 ? 0 : p.length;
  const corners = [stop, p.stock.width].flatMap((v) =>
    [0, p.stock.thickness].map((n) => {
      const world = plus(plus(plus(pl.origin, pl.along, u), pl.across, v), pl.through, n);
      const d = sub(world, h.origin);
      return { u: dot(d, h.along), v: dot(d, h.across), n: dot(d, h.through) };
    }),
  );
  if (corners.some((c) => Math.abs(c.n - bottom) > EPSILON)) {
    return { ok: false, message: "The housed end does not reach the dado's bottom." };
  }
  const us = corners.map((c) => c.u);
  const vs = corners.map((c) => c.v);
  const u0 = Math.min(...us);
  const u1 = Math.max(...us);
  const v0 = Math.min(...vs);
  const v1 = Math.max(...vs);
  const square = corners.every(
    (c) =>
      (Math.abs(c.u - u0) <= EPSILON || Math.abs(c.u - u1) <= EPSILON) &&
      (Math.abs(c.v - v0) <= EPSILON || Math.abs(c.v - v1) <= EPSILON),
  );
  if (!square) {
    return { ok: false, message: "The housed end is not square to the housing's edges." };
  }
  if (
    u0 < -EPSILON ||
    v0 < -EPSILON ||
    u1 > housing.part.length + EPSILON ||
    v1 > housing.part.stock.width + EPSILON
  ) {
    return { ok: false, message: 'The housed end runs past the housing.' };
  }
  return {
    ok: true,
    dado: { withPart: p.id, face, u0, u1, v0, v1, depth },
    ...(stop > 0 ? { notch: { end, edge: 'reference', along: depth, across: stop } } : {}),
  };
}

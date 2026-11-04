import { clipPolygon } from '../geometry/clip.ts';
import { convexPieces } from '../geometry/convex.ts';
import { partOutline, type UV } from '../geometry/outline.ts';
import type { Part, Placement, Vec3 } from '../model/types.ts';

// Each placed part as convex solids, for checking that parts don't occupy the same space (#618):
// its outline, with its end cuts, notches, and cutouts, split into convex pieces and run through
// its thickness, stopping at the shoulder of each tenon thinner than the part, with that tenon a
// box of its own, as the drawings make it (`geometry/solid.ts`). Two convex solids overlap unless some axis separates them (the separating axis
// test, for convex polyhedra: each one's face normals, and the cross products of their edges).

export interface Hull {
  points: Vec3[];
  /** Outward face directions, each a unit vector: the prism's faces. */
  normals: Vec3[];
  /** Edge directions, each a unit vector. */
  edges: Vec3[];
}

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const unit = (a: Vec3): Vec3 | undefined => {
  const length = Math.hypot(a.x, a.y, a.z);
  return length > 1e-9 ? scale(a, 1 / length) : undefined;
};

/** The part's convex solids, where its placement puts them. */
export function hulls(part: Part, pl: Placement): Hull[] {
  const T = part.stock.thickness;
  const L = part.length;
  const at = (u: number, v: number, n: number) =>
    add(add(add(pl.origin, scale(pl.along, u)), scale(pl.across, v)), scale(pl.through, n));
  const prism = (points: readonly UV[], n0: number, n1: number): Hull => {
    const sides = points.map((p, i) => {
      const q = points[(i + 1) % points.length] ?? p;
      return add(scale(pl.along, q.u - p.u), scale(pl.across, q.v - p.v));
    });
    return {
      points: points.flatMap((p) => [at(p.u, p.v, n0), at(p.u, p.v, n1)]),
      normals: [pl.through, ...sides.flatMap((d) => unit(cross(d, pl.through)) ?? [])],
      edges: [pl.through, ...sides.flatMap((d) => unit(d) ?? [])],
    };
  };
  const cheeked = part.tenons.filter((t) => t.thickness < T - 1e-9);
  const lerp = (a: UV, b: UV, f: number): UV => ({
    u: a.u + (b.u - a.u) * f,
    v: a.v + (b.v - a.v) * f,
  });
  const body = cheeked.reduce(
    (o, t) => clipPolygon(o, (p) => (t.end === 0 ? p.u - t.length : L - t.length - p.u), lerp),
    partOutline(part),
  );
  const tenons = cheeked.map((t) => {
    const u0 = t.end === 0 ? 0 : L - t.length;
    const rect = [
      { u: u0, v: t.v0 },
      { u: u0 + t.length, v: t.v0 },
      { u: u0 + t.length, v: t.v0 + t.width },
      { u: u0, v: t.v0 + t.width },
    ];
    return prism(rect, t.n0, t.n0 + t.thickness);
  });
  return [...convexPieces(body).map(({ points }) => prism(points, 0, T)), ...tenons];
}

const span = (points: readonly Vec3[], axis: Vec3): [number, number] => {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    const d = dot(p, axis);
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return [lo, hi];
};

/**
 * How far two convex solids overlap: along the axis where they overlap least, which is 0 or less
 * when an axis separates them.
 */
export function overlapDepth(a: Hull, b: Hull): number {
  const axes = [
    ...a.normals,
    ...b.normals,
    ...a.edges.flatMap((e) => b.edges.flatMap((f) => unit(cross(e, f)) ?? [])),
  ];
  let least = Number.POSITIVE_INFINITY;
  for (const axis of axes) {
    const [a0, a1] = span(a.points, axis);
    const [b0, b1] = span(b.points, axis);
    const depth = Math.min(a1, b1) - Math.max(a0, b0);
    if (depth <= 0) return depth;
    if (depth < least) least = depth;
  }
  return least;
}

/** Whether a point is inside a convex solid, more than `margin` in from each face. */
export function inside(point: Vec3, h: Hull, margin: number): boolean {
  return h.normals.every((axis) => {
    const [lo, hi] = span(h.points, axis);
    const d = dot(point, axis);
    return d > lo + margin && d < hi - margin;
  });
}

/** The box around a set of solids, for skipping pairs far apart before the full test. */
export function bounds(hs: readonly Hull[]): { lo: Vec3; hi: Vec3 } {
  const points = hs.flatMap((h) => h.points);
  const axis = (k: 'x' | 'y' | 'z') => points.map((p) => p[k]);
  return {
    lo: { x: Math.min(...axis('x')), y: Math.min(...axis('y')), z: Math.min(...axis('z')) },
    hi: { x: Math.max(...axis('x')), y: Math.max(...axis('y')), z: Math.max(...axis('z')) },
  };
}

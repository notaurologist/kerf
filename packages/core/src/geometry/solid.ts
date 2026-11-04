import { boredSide } from '../model/operations.ts';
import type { BoredHole, LocalPoint, Mortise, Part, Placement } from '../model/types.ts';
import { clipPolygon } from './clip.ts';
import { convexPieces, isConvex } from './convex.ts';
import { partOutline, type UV } from './outline.ts';
import { add, centroid, cross, dot, scale, sub, unit, type Vec3 } from './vec.ts';

// A part instance as a solid: its outline extruded through its thickness and placed in 3D by its
// placement (#49). Every part is a prism, but for a tenon thinner than the part, which is a box of
// its own beyond the shoulder. A face with a notch or cutout is concave, so it comes in convex
// pieces for depth ordering, with the edges between them marked as not the part's own. Each dado,
// mortise, and bored hole is drawn as its outline on the face or edge it is cut into: a decal,
// painted over that face. A mortise or hole that goes through is outlined where it comes out too.

interface Face {
  points: Vec3[];
  /** Outward unit normal. */
  normal: Vec3;
  /** Which edges, from each point to the next, are the part's own; all when left out. */
  edge?: boolean[];
  /** Drawn over the face it lies on, such as a dado's outline. */
  decal?: true;
}

export interface Solid {
  partId: string;
  instance: number;
  faces: Face[];
}

const opposite: Record<Mortise['side'], Mortise['side']> = {
  near: 'far',
  far: 'near',
  'reference-edge': 'far-edge',
  'far-edge': 'reference-edge',
};

/** Sides of the polygon a round hole's outline is drawn as. */
const ROUND = 24;

/** A point in a part's frame, in template coordinates. */
function toWorld(pl: Placement, u: number, v: number, n = 0): Vec3 {
  return add(add(add(pl.origin, scale(pl.along, u)), scale(pl.across, v)), scale(pl.through, n));
}

export function solid(part: Part, pl: Placement, offset: Vec3 = { x: 0, y: 0, z: 0 }): Solid {
  const T = part.stock.thickness;
  const L = part.length;
  // The body stops at the shoulder of each tenon thinner than the part; the tenon is its own box.
  const cheeked = part.tenons.filter((t) => t.thickness < T - 1e-9);
  const lerp = (a: UV, b: UV, f: number): UV => ({
    u: a.u + (b.u - a.u) * f,
    v: a.v + (b.v - a.v) * f,
  });
  const outline = cheeked.reduce(
    (o, t) => clipPolygon(o, (p) => (t.end === 0 ? p.u - t.length : L - t.length - p.u), lerp),
    partOutline(part),
  );
  const at = (p: UV, n: number) => add(toWorld(pl, p.u, p.v, n), offset);
  // A taper that takes off thickness lowers the near face toward the first end: its n at each u.
  const thin = part.tapers.find((t) => t.plane);
  const near = (u: number) =>
    !thin || u >= thin.start.u
      ? 0
      : (thin.end.v * (thin.start.u - u)) / (thin.start.u - thin.end.u);
  if (thin) return tapered(part, pl, outline, near, at);
  const pieces = convexPieces(outline);
  const faces: Face[] = pieces.flatMap((piece) => [
    {
      points: piece.points.map((p) => at(p, 0)).reverse(),
      normal: scale(pl.through, -1),
      // Reversed, the edge from point i runs to i + 1 as the edge from n − 2 − i did.
      edge: piece.edge.map(
        (_, i) => piece.edge[(2 * piece.edge.length - 2 - i) % piece.edge.length] ?? true,
      ),
    },
    { points: piece.points.map((p) => at(p, T)), normal: pl.through, edge: [...piece.edge] },
  ]);
  for (const d of part.dadoes) {
    const corners: UV[] = [
      { u: d.u0, v: d.v0 },
      { u: d.u1, v: d.v0 },
      { u: d.u1, v: d.v1 },
      { u: d.u0, v: d.v1 },
    ];
    const far = d.face === 'far';
    const points = corners.map((p) => at(p, far ? T : 0));
    faces.push({
      points: far ? points : points.reverse(),
      normal: far ? pl.through : scale(pl.through, -1),
      decal: true,
    });
  }
  for (const m of part.mortises) {
    const onEdge = m.side === 'reference-edge' || m.side === 'far-edge';
    const corners: [number, number][] = [
      [m.u0, m.a0],
      [m.u1, m.a0],
      [m.u1, m.a1],
      [m.u0, m.a1],
    ];
    // A mortise as deep as the part is through it: the tenon shows on the other side too.
    const through = m.depth >= (onEdge ? part.stock.width : T) - 1e-9;
    const sides = through ? [m.side, opposite[m.side]] : [m.side];
    for (const side of sides) {
      if (side === 'reference-edge' || side === 'far-edge') {
        const far = side === 'far-edge';
        const v = far ? part.stock.width : 0;
        const points = corners.map(([u, n]) => at({ u, v }, n));
        faces.push({
          points: far ? points.reverse() : points,
          normal: far ? pl.across : scale(pl.across, -1),
          decal: true,
        });
      } else {
        const far = side === 'far';
        const points = corners.map(([u, v]) => at({ u, v }, far ? T : 0));
        faces.push({
          points: far ? points : points.reverse(),
          normal: far ? pl.through : scale(pl.through, -1),
          decal: true,
        });
      }
    }
  }
  for (const hole of part.boredHoles) faces.push(...holeOutlines(pl, hole, at));
  for (const t of cheeked) {
    const u0 = t.end === 0 ? 0 : L - t.length;
    faces.push(
      ...box(pl, offset, [u0, u0 + t.length], [t.v0, t.v0 + t.width], [t.n0, t.n0 + t.thickness]),
    );
  }
  // Side faces: the outline is counterclockwise in (u, v), so (dv, −du) points out.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i] as UV;
    const b = outline[(i + 1) % outline.length] as UV;
    // Clipping at a tenon's shoulder can repeat a point; a side face there has no area and no
    // direction, and a face with no direction cannot order the faces around it.
    if (Math.hypot(b.u - a.u, b.v - a.v) < 1e-9) continue;
    const normal = unit(add(scale(pl.along, b.v - a.v), scale(pl.across, -(b.u - a.u))));
    faces.push({ points: [at(a, 0), at(b, 0), at(b, T), at(a, T)], normal });
  }
  return { partId: pl.partId, instance: pl.instance, faces };
}

/**
 * A bored hole's outline where it enters, and where it comes out when it goes through: the bore,
 * a cylinder about its direction, cut by the plane of that face (square to the axis it mostly
 * runs along), as a polygon of ROUND sides counterclockwise seen from outside.
 */
function holeOutlines(pl: Placement, hole: BoredHole, at: (p: UV, n: number) => Vec3): Face[] {
  const axis = boredSide(hole);
  const d = hole.direction;
  const k = Math.hypot(d.u, d.v, d.n);
  const dir: LocalPoint = { u: d.u / k, v: d.v / k, n: d.n / k };
  const out = { u: pl.along, v: pl.across, n: pl.through }[axis];
  // Two directions square to the bore and to each other.
  const helper: LocalPoint = Math.abs(dir.u) < 0.9 ? { u: 1, v: 0, n: 0 } : { u: 0, v: 1, n: 0 };
  const crossL = (a: LocalPoint, b: LocalPoint): LocalPoint => ({
    u: a.v * b.n - a.n * b.v,
    v: a.n * b.u - a.u * b.n,
    n: a.u * b.v - a.v * b.u,
  });
  const e1 = crossL(dir, helper);
  const k1 = Math.hypot(e1.u, e1.v, e1.n);
  const a: LocalPoint = { u: e1.u / k1, v: e1.v / k1, n: e1.n / k1 };
  const b = crossL(dir, a);
  const r = hole.diameter / 2;
  const exit: LocalPoint = {
    u: hole.entry.u + dir.u * hole.depth,
    v: hole.entry.v + dir.v * hole.depth,
    n: hole.entry.n + dir.n * hole.depth,
  };
  // The bore runs into the part, so the entry face faces against it and the exit face with it.
  const ends: [LocalPoint, number][] = [[hole.entry, -Math.sign(dir[axis])]];
  if (hole.through) ends.push([exit, Math.sign(dir[axis])]);
  return ends.map(([c, sign]) => {
    const ring = Array.from({ length: ROUND }, (_, i) => {
      const t = (2 * Math.PI * i) / ROUND;
      const p: LocalPoint = {
        u: c.u + r * (Math.cos(t) * a.u + Math.sin(t) * b.u),
        v: c.v + r * (Math.cos(t) * a.v + Math.sin(t) * b.v),
        n: c.n + r * (Math.cos(t) * a.n + Math.sin(t) * b.n),
      };
      // Slid along the bore onto the face's plane.
      const f = (c[axis] - p[axis]) / dir[axis];
      return { u: p.u + f * dir.u, v: p.v + f * dir.v, n: p.n + f * dir.n };
    });
    const points = ring.map((p) => at({ u: p.u, v: p.v }, p.n));
    const normal = scale(out, sign);
    const [p0, p1, p2] = points as [Vec3, Vec3, Vec3];
    const turn = cross(sub(p1, p0), sub(p2, p0));
    return { points: dot(turn, normal) < 0 ? points.reverse() : points, normal, decal: true };
  });
}

/**
 * A part whose near face is lowered by a taper (Taper.plane): its face outline, convex, split
 * where the taper starts so each part of the near face is flat, and its sides following the near
 * face down. Joinery is not drawn on such a part.
 */
function tapered(
  part: Part,
  pl: Placement,
  outline: readonly UV[],
  near: (u: number) => number,
  at: (p: UV, n: number) => Vec3,
): Solid {
  if (!isConvex(outline)) throw new Error(`${part.id} has a thickness taper and a concave face`);
  const T = part.stock.thickness;
  const s = part.tapers.find((t) => t.plane)?.start.u ?? 0;
  const lerp = (a: UV, b: UV, f: number): UV => ({
    u: a.u + (b.u - a.u) * f,
    v: a.v + (b.v - a.v) * f,
  });
  // The outline with a point wherever an edge crosses u = s, so every side face is flat.
  const points = outline.flatMap((a, i) => {
    const b = outline[(i + 1) % outline.length] as UV;
    const crosses = (a.u - s) * (b.u - s) < -1e-12;
    return crosses ? [a, lerp(a, b, (s - a.u) / (b.u - a.u))] : [a];
  });
  // Clipping through a corner on the line repeats it, so repeated points are dropped.
  const distinct = (ps: UV[]) =>
    ps.filter((p, i) => {
      const q = ps[(i + 1) % ps.length] as UV;
      return Math.abs(p.u - q.u) > 1e-12 || Math.abs(p.v - q.v) > 1e-12;
    });
  const halves = [
    distinct(clipPolygon(points, (p) => s - p.u, lerp)),
    distinct(clipPolygon(points, (p) => p.u - s, lerp)),
  ].filter((h) => h.length >= 3);
  const normalOf = (ps: Vec3[]) =>
    unit(cross(sub(ps[1] as Vec3, ps[0] as Vec3), sub(ps[2] as Vec3, ps[0] as Vec3)));
  const faces: Face[] = halves.map((h) => {
    const ps = h.map((p) => at(p, near(p.u))).reverse();
    return { points: ps, normal: normalOf(ps) };
  });
  faces.push({ points: points.map((p) => at(p, T)), normal: pl.through });
  // A point on a straight run of the outline, such as one added at u = s, joins two side faces in
  // one plane: the edge between them is not the part's own.
  const straight = (i: number) => {
    const n = points.length;
    const p = points[(i + n - 1) % n] as UV;
    const a = points[i] as UV;
    const b = points[(i + 1) % n] as UV;
    return Math.abs((a.u - p.u) * (b.v - a.v) - (a.v - p.v) * (b.u - a.u)) < 1e-9;
  };
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as UV;
    const b = points[(i + 1) % points.length] as UV;
    const normal = unit(add(scale(pl.along, b.v - a.v), scale(pl.across, -(b.u - a.u))));
    faces.push({
      points: [at(a, near(a.u)), at(b, near(b.u)), at(b, T), at(a, T)],
      normal,
      edge: [true, !straight((i + 1) % points.length), true, !straight(i)],
    });
  }
  return { partId: pl.partId, instance: pl.instance, faces };
}

/** A box's six faces, each counterclockwise seen from outside, from ranges in u, v, and n. */
function box(
  pl: Placement,
  offset: Vec3,
  [u0, u1]: [number, number],
  [v0, v1]: [number, number],
  [n0, n1]: [number, number],
): Face[] {
  const p = (u: number, v: number, n: number) => add(toWorld(pl, u, v, n), offset);
  const neg = (d: Vec3) => scale(d, -1);
  return [
    {
      points: [p(u0, v0, n0), p(u0, v1, n0), p(u1, v1, n0), p(u1, v0, n0)],
      normal: neg(pl.through),
    },
    { points: [p(u0, v0, n1), p(u1, v0, n1), p(u1, v1, n1), p(u0, v1, n1)], normal: pl.through },
    {
      points: [p(u0, v0, n0), p(u1, v0, n0), p(u1, v0, n1), p(u0, v0, n1)],
      normal: neg(pl.across),
    },
    { points: [p(u0, v1, n0), p(u0, v1, n1), p(u1, v1, n1), p(u1, v1, n0)], normal: pl.across },
    { points: [p(u0, v0, n0), p(u0, v0, n1), p(u0, v1, n1), p(u0, v1, n0)], normal: neg(pl.along) },
    { points: [p(u1, v0, n0), p(u1, v1, n0), p(u1, v1, n1), p(u1, v0, n1)], normal: pl.along },
  ];
}

export const solidCentroid = (s: Solid): Vec3 => centroid(s.faces.flatMap((f) => f.points));

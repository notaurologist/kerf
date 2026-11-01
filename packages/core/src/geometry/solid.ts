import type { Part, Placement } from '../model/types.ts';
import { clipPolygon } from './clip.ts';
import { convexPieces, isConvex } from './convex.ts';
import { partOutline, type UV } from './outline.ts';
import { add, centroid, cross, scale, sub, unit, type Vec3 } from './vec.ts';

// A part instance as a solid: its outline extruded through its thickness and placed in 3D by its
// placement (#49). Every part is a prism, but for a tenon thinner than the part, which is a box of
// its own beyond the shoulder. A face with a notch or cutout is concave, so it comes in convex
// pieces for depth ordering, with the edges between them marked as not the part's own. Each dado
// and mortise is drawn as its outline on the face or edge it is cut into: a decal, painted over
// that face.

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

/** A point in a part's frame, in template coordinates. */
function toWorld(pl: Placement, u: number, v: number, n = 0): Vec3 {
  return add(add(add(pl.origin, scale(pl.along, u)), scale(pl.across, v)), scale(pl.through, n));
}

export function solid(part: Part, pl: Placement, offset: Vec3 = { x: 0, y: 0, z: 0 }): Solid {
  const T = part.stock.thickness;
  const L = part.length;
  // The body stops at the shoulder of each tenon thinner than the part; the tenon is its own box.
  const cheeked = (part.tenons ?? []).filter((t) => t.thickness < T - 1e-9);
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
  for (const m of part.mortises ?? []) {
    const onEdge = m.side === 'reference-edge' || m.side === 'far-edge';
    const corners: [number, number][] = [
      [m.u0, m.a0],
      [m.u1, m.a0],
      [m.u1, m.a1],
      [m.u0, m.a1],
    ];
    if (onEdge) {
      const far = m.side === 'far-edge';
      const v = far ? part.stock.width : 0;
      const points = corners.map(([u, n]) => at({ u, v }, n));
      faces.push({
        points: far ? points.reverse() : points,
        normal: far ? pl.across : scale(pl.across, -1),
        decal: true,
      });
    } else {
      const far = m.side === 'far';
      const points = corners.map(([u, v]) => at({ u, v }, far ? T : 0));
      faces.push({
        points: far ? points : points.reverse(),
        normal: far ? pl.through : scale(pl.through, -1),
        decal: true,
      });
    }
  }
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
    const normal = unit(add(scale(pl.along, b.v - a.v), scale(pl.across, -(b.u - a.u))));
    faces.push({ points: [at(a, 0), at(b, 0), at(b, T), at(a, T)], normal });
  }
  return { partId: pl.partId, instance: pl.instance, faces };
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
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as UV;
    const b = points[(i + 1) % points.length] as UV;
    const normal = unit(add(scale(pl.along, b.v - a.v), scale(pl.across, -(b.u - a.u))));
    faces.push({ points: [at(a, near(a.u)), at(b, near(b.u)), at(b, T), at(a, T)], normal });
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

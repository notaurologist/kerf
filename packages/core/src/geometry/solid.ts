import type { Part, Placement } from '../model/types.ts';
import { convexPieces } from './convex.ts';
import { partOutline, type UV } from './outline.ts';
import { add, centroid, scale, unit, type Vec3 } from './vec.ts';

// A part instance as a solid: its outline extruded through its thickness and placed in 3D by its
// placement (#49). Every part is a prism. A face with a notch or cutout is concave, so it comes in
// convex pieces for depth ordering, with the edges between them marked as not the part's own. Each
// dado is drawn as its outline on the face it is cut into: a decal, painted over that face.

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
  const outline = partOutline(part);
  const T = part.stock.thickness;
  const at = (p: UV, n: number) => add(toWorld(pl, p.u, p.v, n), offset);
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
  // Side faces: the outline is counterclockwise in (u, v), so (dv, −du) points out.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i] as UV;
    const b = outline[(i + 1) % outline.length] as UV;
    const normal = unit(add(scale(pl.along, b.v - a.v), scale(pl.across, -(b.u - a.u))));
    faces.push({ points: [at(a, 0), at(b, 0), at(b, T), at(a, T)], normal });
  }
  return { partId: pl.partId, instance: pl.instance, faces };
}

export const solidCentroid = (s: Solid): Vec3 => centroid(s.faces.flatMap((f) => f.points));

import type { Part, Placement } from '../model/types.ts';
import { partOutline, type UV } from './outline.ts';
import { add, centroid, scale, unit, type Vec3 } from './vec.ts';

// A part instance as a solid: its outline extruded through its thickness and placed in 3D by its
// placement (#49). Every part is a prism, so its faces are convex polygons.

export interface Face {
  points: Vec3[];
  /** Outward unit normal. */
  normal: Vec3;
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
  const back = outline.map((p) => at(p, 0)).reverse();
  const front = outline.map((p) => at(p, T));
  const faces: Face[] = [
    { points: back, normal: scale(pl.through, -1) },
    { points: front, normal: pl.through },
  ];
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

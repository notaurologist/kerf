import type { Part } from '../templates/types.ts';

// A part's face outline in its own frame (DOMAIN.md, Geometry; Placement in templates/types.ts):
// u along the part from its first end's long point, v across from its reference edge. The
// outline follows from the cut-list data alone (spec, Placements):
//
// - first end cut:  u = v·tan(s₁)
// - second end cut: u = L − (W − v)·tan(s₂) when the ends are parallel, else u = L − v·tan(s₂)
//
// A taper (#50) runs from a point on the reference edge to a point on the first end cut and
// removes the corner between them.

export interface UV {
  u: number;
  v: number;
}

const RAD = Math.PI / 180;

/** The uncut blank's four corners, counterclockwise from the first end's long point. */
export function blankOutline(part: Part): UV[] {
  const L = part.length;
  const W = part.stock.width;
  const t1 = Math.tan(part.ends[0].setting * RAD);
  const t2 = Math.tan(part.ends[1].setting * RAD);
  const second = (v: number) => (part.endsParallel ? L - (W - v) * t2 : L - v * t2);
  return [
    { u: 0, v: 0 },
    { u: second(0), v: 0 },
    { u: second(W), v: W },
    { u: W * t1, v: W },
  ];
}

/** The outline after tapers, counterclockwise. */
export function partOutline(part: Part): UV[] {
  const [first, ...rest] = blankOutline(part);
  if (!first) return [];
  const taper = part.tapers?.[0];
  if (!taper) return [first, ...rest];
  // The taper replaces the first corner: from its start on the reference edge, around the
  // blank, back to its end on the first end cut.
  return [taper.start, ...rest, taper.end];
}

/** The two long edges' lengths on the blank: along the reference edge (v = 0) and the far edge. */
export function edgeLengths(part: Part): { reference: number; far: number } {
  const [a, b, c, d] = blankOutline(part) as [UV, UV, UV, UV];
  return { reference: b.u - a.u, far: c.u - d.u };
}

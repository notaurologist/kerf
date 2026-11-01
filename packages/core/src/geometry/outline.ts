import type { Part } from '../model/types.ts';

// A part's face outline in its own frame (DOMAIN.md, Geometry; Placement in model/types.ts):
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

/**
 * The path along one square end, through its notches and cutouts (Part.notches, Part.cutouts),
 * in the outline's counterclockwise direction: the second end from the reference edge to the far
 * edge, the first end back from the far edge to the reference edge. Null when the end has none.
 */
function endPath(part: Part, end: 0 | 1, corner: UV): UV[] | null {
  const notches = part.notches.filter((n) => n.end === end);
  const cutouts = part.cutouts.filter((c) => c.end === end);
  if (notches.length === 0 && cutouts.length === 0) return null;
  if (part.ends[end].setting !== 0)
    throw new Error(`${part.id} has a notch or cutout on an angled end`);
  const W = part.stock.width;
  const at = corner.u;
  /** u at a distance d in from this end. */
  const inward = (d: number) => (end === 1 ? at - d : at + d);
  const ref = notches.find((n) => n.edge === 'reference');
  const far = notches.find((n) => n.edge === 'far');
  // Walked from the reference edge to the far edge; the first end reverses it.
  const path: UV[] = [
    ...(ref
      ? [
          { u: inward(ref.along), v: 0 },
          { u: inward(ref.along), v: ref.across },
          { u: at, v: ref.across },
        ]
      : [{ u: at, v: 0 }]),
    ...[...cutouts]
      .sort((a, b) => a.v0 - b.v0)
      .flatMap((c) => [
        { u: at, v: c.v0 },
        { u: inward(c.depth), v: c.v0 },
        { u: inward(c.depth), v: c.v1 },
        { u: at, v: c.v1 },
      ]),
    ...(far
      ? [
          { u: at, v: W - far.across },
          { u: inward(far.along), v: W - far.across },
          { u: inward(far.along), v: W },
        ]
      : [{ u: at, v: W }]),
  ];
  return end === 1 ? path : path.reverse();
}

/** The outline after tapers, notches, and cutouts, counterclockwise. */
export function partOutline(part: Part): UV[] {
  const [a, b, c, d] = blankOutline(part) as [UV, UV, UV, UV];
  const second = endPath(part, 1, b) ?? [b, c];
  const first = endPath(part, 0, a) ?? [d, a];
  const taper = part.tapers[0];
  if (!taper) return [first[first.length - 1] as UV, ...second, ...first.slice(0, -1)];
  if (first.length > 2)
    throw new Error(`${part.id} has a taper and a notch or cutout at its first end`);
  // The taper replaces the first corner: from its start on the reference edge, around the
  // blank, back to its end on the first end cut.
  return [taper.start, ...second, d, taper.end];
}

/** The two long edges' lengths on the blank: along the reference edge (v = 0) and the far edge. */
export function edgeLengths(part: Part): { reference: number; far: number } {
  const [a, b, c, d] = blankOutline(part) as [UV, UV, UV, UV];
  return { reference: b.u - a.u, far: c.u - d.u };
}

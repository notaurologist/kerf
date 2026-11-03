import type { EndCut, Vec3 } from '@kerf/core';

// A part trimmed to a plane at each end (docs/explorations/joint-model.md, Option C). The template
// says where the part runs and what it is cut to; this gives the end cuts, the length, and where the
// part's origin is, by intersecting its edges with the planes. Single-angle cuts in the part's face
// only (miters): a plane that tilts through the thickness would need a bevel or a compound cut.

/** Any point on the plane, and a direction square to it, of any length. */
export interface Plane {
  point: Vec3;
  normal: Vec3;
}

/** A part before its ends are cut: its frame (Placement) and width. */
export interface Member {
  /** Unit vectors, right-handed: along × across = through. */
  along: Vec3;
  across: Vec3;
  through: Vec3;
  /** Any point on the reference edge, on the face where `through` starts. */
  referenceEdge: Vec3;
  width: number;
}

export type Trimmed =
  | {
      ok: true;
      /** The corner where the first end meets the reference edge (Placement). */
      origin: Vec3;
      /** Long point to long point. */
      length: number;
      ends: [Pick<EndCut, 'setting' | 'measuredFrom'>, Pick<EndCut, 'setting' | 'measuredFrom'>];
      endsParallel: boolean;
      /** Each edge between the end cuts. */
      edges: { reference: number; far: number };
    }
  | { ok: false; end: 0 | 1; code: TrimRefusal; message: string };

type TrimRefusal =
  | 'not-a-miter'
  | 'never-meets'
  | 'long-point-on-far-edge'
  | 'second-end-not-representable'
  | 'ends-cross';

/** Below this, two slopes or a plane's tilt through the thickness count as zero. */
const EPSILON = 1e-12;

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const along = (p: Vec3, d: Vec3, k: number): Vec3 => ({
  x: p.x + d.x * k,
  y: p.y + d.y * k,
  z: p.z + d.z * k,
});
const degrees = (slope: number) => (Math.atan(slope) * 180) / Math.PI;

/**
 * Where a plane crosses the line v across the face, as u = at0 + slope·v, or why it can't be cut
 * as a miter.
 */
function crossing(
  member: Member,
  plane: Plane,
  end: 0 | 1,
): { ok: true; at0: number; slope: number } | Extract<Trimmed, { ok: false }> {
  const m = plane.normal;
  const size = Math.sqrt(dot(m, m));
  const ma = dot(m, member.along) / size;
  if (Math.abs(ma) < EPSILON) {
    return {
      ok: false,
      end,
      code: 'never-meets',
      message: 'The plane runs along the part, so it never crosses it.',
    };
  }
  if (Math.abs(dot(m, member.through) / size) > EPSILON) {
    return {
      ok: false,
      end,
      code: 'not-a-miter',
      message: 'The plane tilts through the thickness: a bevel or compound cut, not a miter.',
    };
  }
  const mc = dot(m, member.across) / size;
  return {
    ok: true,
    at0: dot(m, sub(plane.point, member.referenceEdge)) / size / ma,
    slope: -mc / ma,
  };
}

export function trim(member: Member, planes: readonly [Plane, Plane]): Trimmed {
  const first = crossing(member, planes[0], 0);
  if (!first.ok) return first;
  const second = crossing(member, planes[1], 1);
  if (!second.ok) return second;
  const W = member.width;

  // The first end's long point is on the reference edge, so the cut moves away from the end as v
  // grows: u = v·tan(setting).
  if (first.slope < -EPSILON) {
    return {
      ok: false,
      end: 0,
      code: 'long-point-on-far-edge',
      message:
        "The first end's long point is on the far edge; the reference edge is the other one.",
    };
  }
  const parallel = Math.abs(second.slope - first.slope) <= EPSILON;
  // Otherwise the second end's long point is on the reference edge too: u = length − v·tan.
  if (!parallel && second.slope > EPSILON) {
    return {
      ok: false,
      end: 1,
      code: 'second-end-not-representable',
      message:
        'The second end slopes the same way as the first at a different angle, which a part cannot record.',
    };
  }

  const u0 = (v: number) => first.at0 + first.slope * v;
  const u1 = (v: number) => second.at0 + second.slope * v;
  const edges = { reference: u1(0) - u0(0), far: u1(W) - u0(W) };
  if (edges.reference <= 0 || edges.far <= 0) {
    return {
      ok: false,
      end: 1,
      code: 'ends-cross',
      message: 'The end cuts meet or cross within the part.',
    };
  }
  return {
    ok: true,
    origin: along(member.referenceEdge, member.along, u0(0)),
    length: (parallel ? u1(W) : u1(0)) - u0(0),
    ends: [
      { setting: degrees(Math.max(0, first.slope)), measuredFrom: 'reference-edge' },
      {
        setting: degrees(Math.max(0, parallel ? second.slope : -second.slope)),
        measuredFrom: 'reference-edge',
      },
    ],
    endsParallel: parallel,
    edges,
  };
}

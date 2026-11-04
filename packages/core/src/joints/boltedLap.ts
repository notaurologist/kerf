import type { Hole, Part, Placement, Vec3 } from '../model/types.ts';
import { boltHoleDiameter } from '../structural/boltHoles.ts';

// A bolt through a stack of parts (decision 0020): the hole in each
// part is where the bolt's line runs inside it, and the grip is the wood along the line. Each part
// is a convex solid here: its stock, end cuts, and tapers. Notches, cutouts, and joinery make it
// concave, so a part with any is refused.

/** Where a hole is drilled from, in the part's own terms (Placement). */
export type Side = 'near-face' | 'far-face' | 'reference-edge' | 'far-edge';

export interface PlacedPart {
  part: Part;
  placement: Placement;
}

export interface Bolt {
  hardwareId: string;
  /** The bolt's diameter; each hole is drilled over it (NDS 2024 12.1.3.2). */
  diameter: number;
  /** Any point on the bolt's axis, and its direction, of any length. */
  point: Vec3;
  direction: Vec3;
  /** The parts it passes through, in order along `direction`, touching, each drilled from a side. */
  stack: readonly (PlacedPart & { from: Side })[];
}

export type Lapped =
  | {
      ok: true;
      /** One hole per part in the stack, in its order, in that part's frame. */
      holes: { partId: string; instance: number; hole: Hole }[];
      /** The wood the bolt passes through: every hole's length. */
      grip: number;
    }
  | { ok: false; partId: string; instance: number; message: string };

/** Below this, a point is on a face, and two parts touch. */
const EPSILON = 1e-9;

type UVN = { u: number; v: number; n: number };

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const local = (pl: Placement, d: Vec3): UVN => ({
  u: dot(d, pl.along),
  v: dot(d, pl.across),
  n: dot(d, pl.through),
});
/** Without negative zeros, which a stored plan cannot keep. */
const plain = (p: UVN): UVN => ({ u: p.u + 0, v: p.v + 0, n: p.n + 0 });
const at = (p: UVN, d: UVN, t: number): UVN => ({
  u: p.u + d.u * t,
  v: p.v + d.v * t,
  n: p.n + d.n * t,
});

/** The part as half-spaces a·(u, v, n) ≤ b. */
function halfSpaces(part: Part): { a: UVN; b: number }[] | string {
  if (
    part.notches.length + part.cutouts.length + part.dadoes.length + part.mortises.length > 0 ||
    part.tenons.length + part.grooves.length + part.rabbets.length + part.recesses.length > 0
  ) {
    return 'Only parts without notches, cutouts, or joinery can be bolted for now.';
  }
  const T = part.stock.thickness;
  const W = part.stock.width;
  const L = part.length;
  const RAD = Math.PI / 180;
  const tan1 = Math.tan(part.ends[0].setting * RAD);
  const tan2 = Math.tan(part.ends[1].setting * RAD);
  const faces = [
    { a: { u: 0, v: 0, n: -1 }, b: 0 },
    { a: { u: 0, v: 0, n: 1 }, b: T },
    { a: { u: 0, v: -1, n: 0 }, b: 0 },
    { a: { u: 0, v: 1, n: 0 }, b: W },
    // The first end: u ≥ v·tan(setting).
    { a: { u: -1, v: tan1, n: 0 }, b: 0 },
    // The second end: u ≤ length − (width − v)·tan for parallel ends, u ≤ length − v·tan otherwise.
    part.endsParallel
      ? { a: { u: 1, v: -tan2, n: 0 }, b: L - W * tan2 }
      : { a: { u: 1, v: tan2, n: 0 }, b: L },
  ];
  // A taper keeps the side of its line away from the corner of the first end and the reference
  // edge (or the near face, for one through the thickness).
  for (const taper of part.tapers) {
    const across = taper.plane === 'thickness' ? 'n' : 'v';
    const du = taper.end.u - taper.start.u;
    const dw = taper.end.v - taper.start.v;
    // side(p) = du·(p_w − start_w) − dw·(p_u − start_u). The corner (0, 0) is on the removed side,
    // so the part is where s·side(p) ≤ 0, s being the corner's sign.
    const s = Math.sign(du * -taper.start.v - dw * -taper.start.u);
    const a = { u: -s * dw, v: 0, n: 0 };
    a[across] = s * du;
    faces.push({ a, b: s * (du * taper.start.v - dw * taper.start.u) });
  }
  return faces;
}

const onSide = (p: UVN, side: Side, part: Part) => {
  const value = {
    'near-face': p.n,
    'far-face': p.n - part.stock.thickness,
    'reference-edge': p.v,
    'far-edge': p.v - part.stock.width,
  }[side];
  return Math.abs(value) <= EPSILON;
};

export function boltedLap(bolt: Bolt): Lapped {
  const size = Math.sqrt(dot(bolt.direction, bolt.direction));
  const d: Vec3 = {
    x: bolt.direction.x / size,
    y: bolt.direction.y / size,
    z: bolt.direction.z / size,
  };
  const holes: { partId: string; instance: number; hole: Hole }[] = [];
  let grip = 0;
  let reached: number | undefined;

  for (const { part, placement, from } of bolt.stack) {
    const refuse = (message: string): Lapped => ({
      ok: false,
      partId: part.id,
      instance: placement.instance,
      message,
    });
    const faces = halfSpaces(part);
    if (typeof faces === 'string') return refuse(faces);
    const p0 = local(placement, sub(bolt.point, placement.origin));
    const dl = local(placement, d);

    // Clip the line to every half-space (Cyrus–Beck): t from tIn to tOut is inside the part.
    let tIn = Number.NEGATIVE_INFINITY;
    let tOut = Number.POSITIVE_INFINITY;
    for (const { a, b } of faces) {
      const ad = a.u * dl.u + a.v * dl.v + a.n * dl.n;
      const room = b - (a.u * p0.u + a.v * p0.v + a.n * p0.n);
      if (Math.abs(ad) < 1e-15) {
        if (room < -EPSILON) return refuse('The bolt misses the part.');
        continue;
      }
      const t = room / ad;
      if (ad > 0) tOut = Math.min(tOut, t);
      else tIn = Math.max(tIn, t);
    }
    if (!(tOut - tIn > EPSILON)) return refuse('The bolt misses the part.');
    if (reached !== undefined && Math.abs(tIn - reached) > EPSILON) {
      return refuse(
        tIn > reached
          ? 'There is a gap before this part along the bolt.'
          : 'This part overlaps the one before it along the bolt.',
      );
    }
    reached = tOut;

    const start = at(p0, dl, tIn);
    const end = at(p0, dl, tOut);
    const forward = onSide(start, from, part);
    if (!forward && !onSide(end, from, part)) {
      return refuse(`The bolt does not pass through the part's ${from}.`);
    }
    const length = tOut - tIn;
    grip += length;
    holes.push({
      partId: part.id,
      instance: placement.instance,
      hole: {
        hardwareId: bolt.hardwareId,
        diameter: boltHoleDiameter(bolt.diameter),
        boltDiameter: bolt.diameter,
        entry: plain(forward ? start : end),
        direction: plain(forward ? dl : { u: -dl.u, v: -dl.v, n: -dl.n }),
        length,
      },
    });
  }
  return { ok: true, holes, grip };
}

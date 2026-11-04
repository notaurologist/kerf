import { suggestDovetailLayout } from '../joinery/dovetails.ts';
import type {
  Dado,
  Dovetails,
  EdgeGroove,
  EdgeRabbet,
  Mortise,
  Part,
  ScrewHole,
  Tenon,
  Vec3,
} from '../model/types.ts';
import type { PlacedPart } from './boltedLap.ts';
import { entering, housingPlane, sideEntered } from './housedEnd.ts';

// Joints between two parts (decision 0020): a tenon in a mortise or through it, a stub tenon in a
// groove, a panel floating in its frame's grooves or in grooves cut into faces, screws through one
// part into another that moves across its grain, and through dovetails at a corner. Each derives the features both parts need
// from where they are placed.

/** Below this, two lengths are the same. */
const EPSILON = 1e-9;

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const plus = (p: Vec3, d: Vec3, k: number): Vec3 => ({
  x: p.x + d.x * k,
  y: p.y + d.y * k,
  z: p.z + d.z * k,
});
const parallel = (a: Vec3, b: Vec3) => Math.abs(Math.abs(dot(a, b)) - 1) <= EPSILON;

type Refused = { ok: false; message: string };

/** A tenon's outline on the end it is cut from: v0 and width across, n0 and thickness through. */
interface TenonSize {
  v0: number;
  width: number;
  n0: number;
  thickness: number;
}

export interface MortiseAndTenon {
  mortised: PlacedPart;
  /** Trimmed to `housingPlane(mortised, side, depth)` at this end, so its length includes the tenon. */
  tenoned: PlacedPart;
  end: 0 | 1;
  depth: number;
  tenon: TenonSize;
  /** What the mortise records it houses; the tenoned part's ID unless the template names its role. */
  withPart?: string;
}

/** The tenon on the end and the mortise it fits, on whichever side of the mortised part it enters. */
export function mortiseAndTenon(
  joint: MortiseAndTenon,
): { ok: true; mortise: Mortise; tenon: Tenon } | Refused {
  const { mortised, tenoned, end, depth, tenon } = joint;
  const found = entering(
    mortised,
    tenoned,
    end,
    depth,
    [tenon.v0, tenon.v0 + tenon.width],
    [tenon.n0, tenon.n0 + tenon.thickness],
  );
  if (!found.ok) return found;
  const { side, u0, u1, a0, a1 } = found.entering;
  return {
    ok: true,
    mortise: { withPart: joint.withPart ?? tenoned.part.id, side, u0, u1, a0, a1, depth },
    tenon: { end, length: depth, ...tenon },
  };
}

export interface ThroughTenon {
  mortised: PlacedPart;
  /** Trimmed flush with the mortised part's far side at this end, so its length includes the tenon. */
  tenoned: PlacedPart;
  end: 0 | 1;
  tenon: TenonSize;
  /** The mortise made longer on one side, the way the mortised part moves there, by `by`. */
  lengthen?: { toward: Vec3; by: number };
  withPart?: string;
}

/**
 * A tenon through the mortised part, flush with its far side: a mortise as deep as the part, on
 * the side the tenon enters. Where the mortised part moves across its grain at the joint, the
 * mortise is lengthened on that side, so the tenon is held at one side and the wood moves past it.
 */
export function throughTenon(
  joint: ThroughTenon,
): { ok: true; mortise: Mortise; tenon: Tenon } | Refused {
  const { mortised, tenoned, end, lengthen } = joint;
  const pl = tenoned.placement;
  const toward = end === 1 ? pl.along : plus({ x: 0, y: 0, z: 0 }, pl.along, -1);
  const side = sideEntered(mortised, toward);
  if (!side) {
    return { ok: false, message: 'The tenoned part does not meet the other square to a side.' };
  }
  const onFace = side === 'near' || side === 'far';
  const { thickness, width } = mortised.part.stock;
  const made = mortiseAndTenon({ ...joint, depth: onFace ? thickness : width });
  if (!made.ok || !lengthen) return made;

  const m = mortised.placement;
  const aAxis = onFace ? m.across : m.through;
  const aSize = onFace ? width : thickness;
  const mortise: Mortise = { ...made.mortise };
  if (!(lengthen.by > 0)) return { ok: false, message: 'A mortise is lengthened by more than 0.' };
  const room = (at: 'u0' | 'u1' | 'a0' | 'a1') => {
    mortise[at] += at.endsWith('1') ? lengthen.by : -lengthen.by;
    mortise.room = { at, length: lengthen.by };
  };
  if (parallel(lengthen.toward, m.along)) {
    room(dot(lengthen.toward, m.along) > 0 ? 'u1' : 'u0');
  } else if (parallel(lengthen.toward, aAxis)) {
    room(dot(lengthen.toward, aAxis) > 0 ? 'a1' : 'a0');
  } else {
    return { ok: false, message: 'The mortise is lengthened at an angle to the part.' };
  }
  if (
    mortise.u0 < -EPSILON ||
    mortise.a0 < -EPSILON ||
    mortise.u1 > mortised.part.length + EPSILON ||
    mortise.a1 > aSize + EPSILON
  ) {
    return { ok: false, message: 'The lengthened mortise runs past the part.' };
  }
  return { ok: true, mortise, tenon: made.tenon };
}

export interface ThroughDovetails {
  /** The board with the tails, trimmed flush with the pin board's outside face at this end. */
  tails: PlacedPart;
  tailsEnd: 0 | 1;
  /** The board with the pins, trimmed flush with the tail board's outside face at this end. */
  pins: PlacedPart;
  pinsEnd: 0 | 1;
  /** The slope, 1 in `slope`. */
  slope: number;
}

/**
 * Through dovetails at a corner where two boards' ends meet, their widths running the same way:
 * each end reaches through the other board to its outside face. The joint lies across the width
 * the boards share, as where a drawer's back is cut short, with the suggested layout for it.
 */
export function throughDovetails(
  joint: ThroughDovetails,
): { ok: true; tails: Dovetails; pins: Dovetails } | Refused {
  const { tails, pins, tailsEnd, pinsEnd, slope } = joint;
  const t = tails.placement;
  const p = pins.placement;
  if (!parallel(t.across, p.across)) {
    return { ok: false, message: 'The boards’ widths do not run the same way.' };
  }
  // Each board's width, from its reference edge, where the other board is.
  const shared = (of: PlacedPart, other: PlacedPart): [number, number] => {
    const start = dot(sub(other.placement.origin, of.placement.origin), of.placement.across);
    const end = start + other.part.stock.width * dot(other.placement.across, of.placement.across);
    return [Math.max(0, Math.min(start, end)), Math.min(of.part.stock.width, Math.max(start, end))];
  };
  const tailSpan = shared(tails, pins);
  const pinSpan = shared(pins, tails);
  const width = tailSpan[1] - tailSpan[0];
  if (width <= EPSILON || Math.abs(width - (pinSpan[1] - pinSpan[0])) > EPSILON) {
    return { ok: false, message: 'The boards do not overlap across their widths.' };
  }
  const T = tails.part.stock.thickness;
  const P = pins.part.stock.thickness;
  const intoPins = entering(pins, tails, tailsEnd, P, tailSpan, [0, T]);
  if (!intoPins.ok) return intoPins;
  const intoTails = entering(tails, pins, pinsEnd, T, pinSpan, [0, P]);
  if (!intoTails.ok) return intoTails;
  const faces = ['near', 'far'];
  if (!faces.includes(intoPins.entering.side) || !faces.includes(intoTails.entering.side)) {
    return { ok: false, message: 'Dovetails go into a board’s face, not its edge.' };
  }
  const layout = suggestDovetailLayout(width, slope, P);
  if (!layout) return { ok: false, message: 'No dovetail layout fits the corner.' };
  const span = (range: [number, number], of: PlacedPart) =>
    range[0] > EPSILON || range[1] < of.part.stock.width - EPSILON
      ? { span: { v0: range[0], v1: range[1] } }
      : {};
  return {
    ok: true,
    tails: {
      board: 'tails',
      withPart: pins.part.id,
      end: tailsEnd,
      baseline: P,
      ...layout,
      ...span(tailSpan, tails),
    },
    pins: {
      board: 'pins',
      withPart: tails.part.id,
      end: pinsEnd,
      baseline: T,
      // The tails come through the pin board to the face away from the one they enter.
      outside: intoPins.entering.side === 'near' ? 'far' : 'near',
      ...layout,
      ...span(pinSpan, pins),
    },
  };
}

export interface TenonInGroove {
  /** The part whose groove houses the tenon. */
  grooved: PlacedPart;
  /** Trimmed to the groove's bottom at this end. */
  tenoned: PlacedPart;
  end: 0 | 1;
  /** Across the tenoned part: a stub tenon is often its full width. */
  v: readonly [number, number];
}

/**
 * A stub tenon in a groove that runs along the grooved part's edge: as thick as the groove is
 * wide and as long as it is deep, where the groove is. The groove is the grooved part's own.
 */
export function tenonInGroove(joint: TenonInGroove): { ok: true; tenon: Tenon } | Refused {
  const { grooved, tenoned, end, v } = joint;
  const g = grooved.placement;
  const t = tenoned.placement;
  if (!parallel(g.through, t.through)) {
    return { ok: false, message: "The parts' thicknesses do not run the same way." };
  }
  for (const groove of grooved.part.grooves) {
    // The groove's two faces, through the tenoned part.
    const [nA, nB] = [groove.n0, groove.n0 + groove.width]
      .map((n) => dot(sub(plus(g.origin, g.through, n), t.origin), t.through))
      .sort((a, b) => a - b) as [number, number];
    const found = entering(grooved, tenoned, end, groove.depth, v, [nA, nB]);
    if (!found.ok) continue;
    const e = found.entering;
    const edge = groove.edge === 'far' ? 'far-edge' : 'reference-edge';
    if (e.side !== edge || e.u0 < groove.u0 - EPSILON || e.u1 > groove.u1 + EPSILON) continue;
    return {
      ok: true,
      tenon: {
        end,
        length: groove.depth,
        n0: nA,
        thickness: nB - nA,
        v0: v[0],
        width: v[1] - v[0],
      },
    };
  }
  return { ok: false, message: 'The tenon reaches no groove in the part.' };
}

export interface FloatingPanel {
  /** The frame around the panel, each with the edge toward it. */
  frame: readonly (PlacedPart & { edge: EdgeGroove['edge'] })[];
  /** The frame's grooves, centered in each part's thickness. */
  groove: { width: number; depth: number };
  /** The panel, for its ID and stock, and the directions it runs: its grain along its length. */
  panel: { part: Part; along: Vec3; across: Vec3; through: Vec3 };
  /** Short of each groove's bottom: at each end, along the grain, and at each edge, across it. */
  gaps: { ends: number; edges: number };
}

/**
 * A panel floating in grooves around a frame, unglued (DOMAIN.md, Joints that let wood move): the
 * grooves, and the panel's length and place between their bottoms less its gaps, centered in them,
 * rabbeted on both faces at every edge to a tongue as thick as the grooves are wide. Its width is
 * its stock's, which must be the space between the side grooves less a gap at each edge.
 */
export function floatingPanel(joint: FloatingPanel):
  | {
      ok: true;
      grooves: { partId: string; groove: EdgeGroove }[];
      origin: Vec3;
      length: number;
      rabbets: EdgeRabbet[];
    }
  | Refused {
  const { frame, groove, panel, gaps } = joint;
  const grooves = frame.map((f) => ({
    partId: f.part.id,
    groove: {
      edge: f.edge,
      u0: 0,
      u1: f.part.length,
      n0: (f.part.stock.thickness - groove.width) / 2,
      width: groove.width,
      depth: groove.depth,
    },
  }));
  // Each groove's bottom, and where it is along or across the panel.
  const bottoms = frame.map((f) =>
    housingPlane(f, f.edge === 'far' ? 'far-edge' : 'reference-edge', groove.depth),
  );
  const at = (direction: Vec3) =>
    bottoms
      .filter((b) => parallel(b.normal, direction))
      .map((b) => dot(b.point, direction))
      .sort((a, b) => a - b);
  const ends = at(panel.along);
  const edges = at(panel.across);
  if (ends.length !== 2 || edges.length !== 2 || ends.length + edges.length !== frame.length) {
    return { ok: false, message: 'The frame is not two parts at the ends and two at the edges.' };
  }
  const [s0, s1] = ends as [number, number];
  const [e0, e1] = edges as [number, number];
  const width = e1 - e0 - 2 * gaps.edges;
  if (Math.abs(width - panel.part.stock.width) > EPSILON) {
    return {
      ok: false,
      message: "The panel is not the space between the frame's grooves less its gaps.",
    };
  }
  // Centered in the grooves, which are centered in the frame.
  const centers = frame.map((f) =>
    dot(plus(f.placement.origin, f.placement.through, f.part.stock.thickness / 2), panel.through),
  );
  if (centers.some((c) => Math.abs(c - (centers[0] as number)) > EPSILON)) {
    return { ok: false, message: "The frame's grooves are not in one plane." };
  }
  const T = panel.part.stock.thickness;
  const tongue = (T - groove.width) / 2;
  if (tongue <= 0) return { ok: false, message: 'The panel is no thicker than the grooves.' };
  const origin = plus(
    plus(plus({ x: 0, y: 0, z: 0 }, panel.along, s0 + gaps.ends), panel.across, e0 + gaps.edges),
    panel.through,
    (centers[0] as number) - T / 2,
  );
  return {
    ok: true,
    grooves,
    origin,
    length: s1 - s0 - 2 * gaps.ends,
    rabbets: (['reference', 'far', 'first-end', 'second-end'] as const).flatMap((edge) =>
      (['near', 'far'] as const).map((face) => ({
        edge,
        face,
        width: groove.depth,
        depth: tongue,
      })),
    ),
  };
}

const RABBETED = ['reference', 'far', 'first-end', 'second-end'] as const;

export interface PanelInFaces {
  /** The parts around the panel, each with the face its groove is cut into. */
  frame: readonly (PlacedPart & { face: Dado['face'] })[];
  groove: { width: number; depth: number };
  /** The panel's ID and thickness, and the directions it runs: its grain along `along`. */
  panel: { id: string; thickness: number; along: Vec3; across: Vec3; through: Vec3 };
  /** Where the panel's middle is along `through`; the grooves are centered on it. */
  middle: number;
  /** Short of each groove's bottom: at each end, along the grain, and at each edge, across it. */
  gaps: { ends: number; edges: number };
  /**
   * Where the panel runs to on a side with no groove, along `along` or `across`, as a drawer
   * bottom runs on under a short back. That side gets no tongue.
   */
  open?: number;
  /**
   * The panel's face flush with its grooves' wall on that side, the tongue rabbeted from the other
   * face only, as a drawer bottom's top is flush with its groove's. Centered when absent.
   */
  flush?: 'near' | 'far';
}

/**
 * A panel floating in grooves cut into the faces of the parts around it, end to end along each,
 * unglued (DOMAIN.md, Joints that let wood move): each groove, centered on the panel, and the
 * panel's size and place between their bottoms less its gaps, rabbeted on both faces at every edge
 * to a tongue as thick as the grooves are wide.
 */
export function panelInFaces(joint: PanelInFaces):
  | {
      ok: true;
      dadoes: { partId: string; dado: Dado }[];
      origin: Vec3;
      length: number;
      width: number;
      rabbets: EdgeRabbet[];
    }
  | Refused {
  const { frame, groove, panel, middle, gaps } = joint;
  const T = panel.thickness;
  const extra = T - groove.width;
  if (extra <= 0) return { ok: false, message: 'The panel is no thicker than the grooves.' };
  // How much each face's rabbet takes off, and where the panel's near face is along `through`.
  const rabbet = {
    near: joint.flush === 'near' ? 0 : joint.flush === 'far' ? extra : extra / 2,
    far: joint.flush === 'far' ? 0 : joint.flush === 'near' ? extra : extra / 2,
  };
  const nearFace = middle - groove.width / 2 - rabbet.near;
  const dadoes: { partId: string; dado: Dado }[] = [];
  const ends: number[] = [];
  const edges: number[] = [];
  for (const f of frame) {
    const pl = f.placement;
    // The groove runs along the part, across its face, centered on the panel's middle.
    if (!parallel(pl.across, panel.through)) {
      return { ok: false, message: 'A groove would not run along its part in the panel’s plane.' };
    }
    const center = (middle - dot(pl.origin, panel.through)) * dot(pl.across, panel.through);
    const v0 = center - groove.width / 2;
    const v1 = center + groove.width / 2;
    if (v0 < -EPSILON || v1 > f.part.stock.width + EPSILON) {
      return { ok: false, message: 'A groove runs off its part’s face.' };
    }
    dadoes.push({
      partId: f.part.id,
      dado: {
        withPart: panel.id,
        face: f.face,
        u0: 0,
        u1: f.part.length,
        v0,
        v1,
        depth: groove.depth,
      },
    });
    const bottom = housingPlane(f, f.face, groove.depth);
    if (parallel(bottom.normal, panel.along)) ends.push(dot(bottom.point, panel.along));
    else if (parallel(bottom.normal, panel.across)) edges.push(dot(bottom.point, panel.across));
    else return { ok: false, message: 'A grooved face does not meet the panel’s edge or end.' };
  }
  // An open side is where the frame has only one groove across that way.
  let free: (typeof RABBETED)[number] | undefined;
  if (joint.open !== undefined) {
    const at = joint.open;
    const [list, low, high] =
      ends.length === 1
        ? ([ends, 'first-end', 'second-end'] as const)
        : ([edges, 'reference', 'far'] as const);
    free = list.length === 1 && at < (list[0] as number) ? low : high;
    list.push(at);
  }
  if (ends.length !== 2 || edges.length !== 2) {
    return { ok: false, message: 'The panel is not held at both ends and both edges.' };
  }
  const [s0, s1] = ends.sort((a, b) => a - b) as [number, number];
  const [e0, e1] = edges.sort((a, b) => a - b) as [number, number];
  // No gap at the open side: the panel runs to it.
  const gap = (edge: (typeof RABBETED)[number], size: number) => (edge === free ? 0 : size);
  const start0 = s0 + gap('first-end', gaps.ends);
  const side0 = e0 + gap('reference', gaps.edges);
  const origin = plus(
    plus(plus({ x: 0, y: 0, z: 0 }, panel.along, start0), panel.across, side0),
    panel.through,
    nearFace,
  );
  return {
    ok: true,
    dadoes,
    origin,
    length: s1 - gap('second-end', gaps.ends) - start0,
    width: e1 - gap('far', gaps.edges) - side0,
    rabbets: RABBETED.filter((edge) => edge !== free).flatMap((edge) =>
      (['near', 'far'] as const)
        .filter((face) => rabbet[face] > 0)
        .map((face) => ({ edge, face, width: groove.depth, depth: rabbet[face] })),
    ),
  };
}

export interface SlottedScrews {
  hardwareId: string;
  /** The part the screws pass through, and where, on its face against the other. */
  through: PlacedPart;
  at: readonly { u: number; v: number }[];
  /** The part they hold, which moves across its grain, and the edge it is held still at. */
  into: PlacedPart;
  heldAt: 'reference-edge' | 'far-edge';
  /** How far the held part moves at the screws, beyond the hole: each slot's extra length. */
  slot: number;
}

/**
 * Screws through one part into another that moves across its grain (DOMAIN.md, Joints that let
 * wood move): the screw nearest the edge it is held at goes in a round hole, and the rest in slots
 * the way it moves.
 */
export function slottedScrews(joint: SlottedScrews): { ok: true; holes: ScrewHole[] } | Refused {
  const { through, into } = joint;
  const s = through.placement;
  const h = into.placement;
  // Its faces must lie against one of the other part's.
  const facesOf = (pl: PlacedPart) =>
    [0, pl.part.stock.thickness].map((n) =>
      dot(plus(pl.placement.origin, pl.placement.through, n), h.through),
    );
  if (!parallel(s.through, h.through)) {
    return { ok: false, message: 'The parts do not lie face to face.' };
  }
  const touching = facesOf(through).some((a) =>
    facesOf(into).some((b) => Math.abs(a - b) <= EPSILON),
  );
  if (!touching) return { ok: false, message: 'The parts do not lie face to face.' };
  // It moves across its grain, its width.
  const direction = parallel(h.across, s.along)
    ? ('along' as const)
    : parallel(h.across, s.across)
      ? ('across' as const)
      : undefined;
  if (!direction) return { ok: false, message: 'The held part moves at an angle to this one.' };

  const across = joint.at.map(({ u, v }) => {
    const world = plus(plus(s.origin, s.along, u), s.across, v);
    const d = sub(world, h.origin);
    return { u: dot(d, h.along), v: dot(d, h.across) };
  });
  if (
    across.some(
      (p) =>
        p.u < -EPSILON ||
        p.u > into.part.length + EPSILON ||
        p.v < -EPSILON ||
        p.v > into.part.stock.width + EPSILON,
    )
  ) {
    return { ok: false, message: 'A screw misses the held part.' };
  }
  const fromHeld = across.map((p) =>
    joint.heldAt === 'reference-edge' ? p.v : into.part.stock.width - p.v,
  );
  const nearest = Math.min(...fromHeld);
  return {
    ok: true,
    holes: joint.at.map(({ u, v }, i) => ({
      hardwareId: joint.hardwareId,
      u,
      v,
      slot: Math.abs((fromHeld[i] as number) - nearest) <= EPSILON ? 0 : joint.slot,
      direction,
    })),
  };
}

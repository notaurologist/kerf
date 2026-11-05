import { type Bolt, boltedLap, type Side } from '../../joints/boltedLap.ts';
import { compare } from '../../joints/compare.ts';
import { type Member, type Plane, type Trimmed, trim } from '../../joints/trim.ts';
import type { Hole, Part, Placement, Vec3 } from '../../model/types.ts';
import {
  type Dimensions,
  type FrameGeometry,
  type FrameShape,
  storedGeometry,
} from './geometry.ts';
import { HANGER_BOLTS } from './hardware.ts';
import type { SwingGeometry } from './layout.ts';
import type { SwingSetParams } from './params.ts';

// The swing set's joints (decision 0020): each part's end cuts, length, marked edges, and
// placement from trims, and every bolt hole and bolt's grip from bolted laps. The template gives
// the closing geometry: the splay, where each foot is cut, how far the boards run past the legs,
// and where the bolts go. Each part is declared by where it runs and the planes it is cut to, and
// each bolt by its line and the parts it passes through, as in the spec's Derived geometry,
// Placements, and Bolt layout.

const RAD = Math.PI / 180;
const X: Vec3 = { x: 1, y: 0, z: 0 };
const MINUS_X: Vec3 = { x: -1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const MINUS_Y: Vec3 = { x: 0, y: -1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };
const MINUS_Z: Vec3 = { x: 0, y: 0, z: -1 };

interface Trim {
  partId: string;
  instance: number;
  member: Member;
  planes: [Plane, Plane];
}

const level = (z: number): Plane => ({ point: { x: 0, y: 0, z }, normal: Z });

/**
 * A part as the template stands it, before its joints give its length. Each marked length is an
 * edge of the cut part: a leg's reference edge, or a board's top (far) or bottom (reference) edge.
 */
export type UncutPart = Omit<Part, 'length' | 'markLengths'> & {
  marks: { label: string; edge: 'reference' | 'far' }[];
};

export function joined(
  params: SwingSetParams,
  dims: Dimensions,
  g: FrameShape,
  swings: SwingGeometry,
  uncut: UncutPart[],
): {
  geometry: FrameGeometry;
  parts: Part[];
  placements: Placement[];
  /** Each bolted hardware line's grip, by hardware ID. */
  grips: ReadonlyMap<string, number>;
} {
  const a = g.splay * RAD;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const top = dims.H + dims.bd;
  const plyThickness = dims.bw / dims.plies;

  // The left frame's legs occupy x from e to e + t, the right frame's from L − e − t to L − e.
  const frames = [
    { legsFrom: dims.e, outside: dims.e, outward: -1 },
    { legsFrom: dims.L - dims.e - dims.t, outside: dims.L - dims.e, outward: 1 },
  ];

  // The beam's plies, square at x = 0 and x = L.
  const beam: Trim[] = Array.from({ length: dims.plies }, (_, i) => ({
    partId: 'beam',
    instance: i,
    member: {
      along: X,
      across: Z,
      through: MINUS_Y,
      referenceEdge: { x: 0, y: dims.bw / 2 - i * plyThickness, z: dims.H },
      width: dims.bd,
    },
    planes: [
      { point: { x: 0, y: 0, z: 0 }, normal: X },
      { point: { x: dims.L, y: 0, z: 0 }, normal: X },
    ],
  }));

  // Each leg's inner edge passes the beam's lower corner (spec, Leg faces); its top is cut level
  // with the top of the beam and its foot level at the foot cut.
  const backAcross: Vec3 = { x: 0, y: cos, z: sin };
  const frontAcross: Vec3 = { x: 0, y: -cos, z: sin };
  const legs: Trim[] = frames.flatMap((frame, i) => [
    {
      partId: 'leg-back',
      instance: i,
      member: {
        along: { x: 0, y: sin, z: -cos },
        across: backAcross,
        through: X,
        referenceEdge: { x: frame.legsFrom, y: dims.bw / 2, z: dims.H },
        width: dims.w,
      },
      planes: [level(top), level(g.back.footZ)],
    },
    {
      partId: 'leg-front',
      instance: i,
      member: {
        along: { x: 0, y: -sin, z: -cos },
        across: frontAcross,
        through: MINUS_X,
        referenceEdge: { x: frame.legsFrom + dims.t, y: -dims.bw / 2, z: dims.H },
        width: dims.w,
      },
      planes: [level(top), level(g.front.footZ)],
    },
  ]);

  // Crossbars and gussets run front to back on each frame's outside face, cut parallel to the
  // legs' outer faces, `past` beyond them along the board (spec, Bolt layout).
  const outerAtBeam = dims.bw / 2 + dims.w / cos;
  const boards = (
    partId: string,
    bottom: number,
    width: number,
    thickness: number,
    past: number,
  ): Trim[] =>
    frames.map((frame, i) => ({
      partId,
      instance: i,
      member: {
        along: Y,
        across: Z,
        through: X,
        referenceEdge: {
          x: frame.outward < 0 ? frame.outside - thickness : frame.outside,
          y: 0,
          z: bottom,
        },
        width,
      },
      planes: [
        { point: { x: 0, y: -(outerAtBeam + past), z: dims.H }, normal: frontAcross },
        { point: { x: 0, y: outerAtBeam + past, z: dims.H }, normal: backAcross },
      ],
    }));

  const trims = [
    ...beam,
    ...legs,
    ...boards('crossbar', dims.zc - dims.cw, dims.cw, dims.ct, g.crossbar.pastLeg ?? 0),
    ...boards('gusset', dims.H - dims.gh, dims.gh, dims.gt, g.gusset.pastLeg ?? 0),
  ].map((t) => ({ ...t, cut: cut(t) }));

  const placements: Placement[] = trims.map((t) => ({
    partId: t.partId,
    instance: t.instance,
    origin: t.cut.origin,
    along: t.member.along,
    across: t.member.across,
    through: t.member.through,
  }));

  const cuts = new Map<string, Extract<Trimmed, { ok: true }>>();
  const trimmed = uncut.map(({ marks, ...part }): Part => {
    const [first, ...others] = trims.filter((t) => t.partId === part.id).map((t) => t.cut);
    if (!first) throw new Error(`${part.id} has no joints to cut it to length.`);
    for (const other of others) {
      if (Math.abs(other.length - first.length) > 1e-9) {
        throw new Error(`The pieces of ${part.id} are trimmed to different lengths.`);
      }
    }
    cuts.set(part.id, first);
    return {
      ...part,
      length: first.length,
      markLengths: marks.map((mark) => ({ label: mark.label, value: first.edges[mark.edge] })),
      ends: [
        { ...part.ends[0], ...first.ends[0] },
        { ...part.ends[1], ...first.ends[1] },
      ],
      endsParallel: first.endsParallel,
    };
  });

  // Bolts (spec, Top of the leg and Bolt layout), in the order each part lists its holes.
  const h = params.hardware;
  const piece = (partId: string, instance: number, from: Side) => {
    const part = trimmed.find((p) => p.id === partId);
    const placement = placements.find((p) => p.partId === partId && p.instance === instance);
    if (!part || !placement) throw new Error(`No ${partId} ${instance} to bolt.`);
    return { part, placement, from };
  };
  const plies = Array.from({ length: dims.plies }, (_, i) => piece('beam', i, 'near-face'));

  // Leg to beam: level at the beam's mid-depth on the frame's centerline, back to front, each leg
  // drilled from its outer edge and each ply from its back face.
  const legBeam: Bolt[] = frames.map((frame, i) => ({
    hardwareId: 'leg-beam-bolts',
    diameter: h.legBoltDiameter,
    point: { x: frame.legsFrom + dims.t / 2, y: 0, z: dims.H + dims.bd / 2 },
    direction: MINUS_Y,
    stack: [piece('leg-back', i, 'far-edge'), ...plies, piece('leg-front', i, 'far-edge')],
  }));

  // Crossbar and gusset: across the frame, on the leg's centerline, one in the middle of each
  // equal strip of the board's width, through the board and then the leg from the outside face.
  const legCenter = (z: number) => dims.bw / 2 + (dims.H - z) * Math.tan(a) + dims.w / (2 * cos);
  const boardBolts = (
    partId: string,
    hardwareId: string,
    bolts: { diameter: number; perJoint: number },
    bottom: number,
    width: number,
  ): Bolt[] =>
    Array.from({ length: bolts.perJoint }, (_, k) => bottom + ((k + 0.5) * width) / bolts.perJoint)
      .flatMap((z) => [
        { leg: 'leg-front', y: -legCenter(z), z },
        { leg: 'leg-back', y: legCenter(z), z },
      ])
      .flatMap(({ leg, y, z }) =>
        frames.map((frame, i) => {
          const board = piece(partId, i, 'near-face');
          const legPiece = piece(leg, i, 'near-face');
          return {
            hardwareId,
            diameter: bolts.diameter,
            point: { x: 0, y, z },
            direction: X,
            stack: frame.outward < 0 ? [board, legPiece] : [legPiece, board],
          };
        }),
      );

  // Vertical hanger bolts, down through the beam's centerline: in the ply they cut most, the
  // seam of two plies or the middle of three. Horizontal ones are drilled through the bracket.
  const m = h.hangerMounting;
  const hangers: Bolt[] =
    m?.kind === 'vertical-bolt'
      ? swings.hangersX.map((x) => ({
          hardwareId: HANGER_BOLTS,
          diameter: m.diameter,
          point: { x, y: 0, z: top },
          direction: MINUS_Z,
          stack: [piece('beam', Math.floor((dims.plies - 1) / 2), 'far-edge')],
        }))
      : [];

  const bolts = [
    ...legBeam,
    ...boardBolts('crossbar', 'crossbar-bolts', h.crossbarBolts, dims.zc - dims.cw, dims.cw),
    ...boardBolts('gusset', 'gusset-bolts', h.gussetBolts, dims.H - dims.gh, dims.gh),
    ...hangers,
  ];
  const holes = new Map<string, Hole[]>();
  const grips = new Map<string, number>();
  for (const bolt of bolts) {
    const lapped = boltedLap(bolt);
    if (!lapped.ok) {
      throw new Error(
        `${bolt.hardwareId} at ${lapped.partId} ${lapped.instance}: ${lapped.message}`,
      );
    }
    const grip = grips.get(bolt.hardwareId);
    if (grip !== undefined && Math.abs(grip - lapped.grip) > 1e-9) {
      throw new Error(`The ${bolt.hardwareId} have different grips.`);
    }
    grips.set(bolt.hardwareId, lapped.grip);
    // A part's pieces share its hole list, so a hole another piece already has is not listed again.
    for (const { partId, hole } of lapped.holes) {
      const list = holes.get(partId) ?? [];
      if (!list.some((other) => compare(other, hole).length === 0)) list.push(hole);
      holes.set(partId, list);
    }
  }

  const parts = trimmed.map((part) => ({ ...part, holes: holes.get(part.id) ?? [] }));
  const legBeamGrip = grips.get('leg-beam-bolts');
  if (legBeamGrip === undefined) throw new Error('No leg-to-beam bolts.');
  const cutOf = (id: string) => {
    const found = cuts.get(id);
    if (!found) throw new Error(`No ${id} cut.`);
    return found;
  };
  return {
    geometry: storedGeometry(g, cutOf, legBeamGrip),
    parts,
    placements,
    grips,
  };
}

function cut(t: Trim): Extract<Trimmed, { ok: true }> {
  const made = trim(t.member, t.planes);
  if (!made.ok) throw new Error(`${t.partId} ${t.instance}, end ${made.end}: ${made.message}`);
  return made;
}

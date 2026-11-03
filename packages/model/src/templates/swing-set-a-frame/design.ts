import { type Part, type Placement, swingSetAFrame, type Vec3 } from '@kerf/core';
import { type Member, type Plane, type Trimmed, trim } from '../../trim.ts';

// The swing set's design with every part's end cuts, length, and placement derived from trim
// joints (docs/explorations/joint-model.md, step 2). The template still gives the closing
// geometry: the splay, where each foot is cut, and how far the boards run past the legs. Each
// part is declared by where it runs and the planes it is cut to, as in the spec's Derived
// geometry and Placements.

const RAD = Math.PI / 180;
const X: Vec3 = { x: 1, y: 0, z: 0 };
const MINUS_X: Vec3 = { x: -1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const MINUS_Y: Vec3 = { x: 0, y: -1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

interface Trim {
  partId: string;
  instance: number;
  member: Member;
  planes: [Plane, Plane];
}

const level = (z: number): Plane => ({ point: { x: 0, y: 0, z }, normal: Z });

export const design: typeof swingSetAFrame.design = (input, plyBolts) => {
  const made = swingSetAFrame.design(input, plyBolts);
  if (!made.ok) return made;
  const { params, geometry: g } = made.output;
  const dims = swingSetAFrame.dimensions(params);
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

  const parts = made.output.parts.map((part): Part => {
    const [first, ...others] = trims.filter((t) => t.partId === part.id).map((t) => t.cut);
    if (!first) return part;
    for (const other of others) {
      if (Math.abs(other.length - first.length) > 1e-9) {
        throw new Error(`The pieces of ${part.id} are trimmed to different lengths.`);
      }
    }
    const edges = MARKS[part.role]?.map((edge) => first.edges[edge]) ?? [];
    if (edges.length !== part.markLengths.length) {
      throw new Error(`${part.id} marks ${part.markLengths.length} lengths, not ${edges.length}.`);
    }
    return {
      ...part,
      length: first.length,
      markLengths: part.markLengths.map((mark, i) => ({ ...mark, value: edges[i] as number })),
      ends: [
        { ...part.ends[0], ...first.ends[0] },
        { ...part.ends[1], ...first.ends[1] },
      ],
      endsParallel: first.endsParallel,
    };
  });

  return { ok: true, output: { ...made.output, parts, placements } };
};

/** Which edge each of a part's marked lengths is, by role: a leg's either edge; a board's top, then bottom. */
const MARKS: Record<string, readonly ('reference' | 'far')[]> = {
  beam: [],
  leg: ['reference'],
  crossbar: ['far', 'reference'],
  gusset: ['far', 'reference'],
};

function cut(t: Trim): Extract<Trimmed, { ok: true }> {
  const made = trim(t.member, t.planes);
  if (!made.ok) throw new Error(`${t.partId} ${t.instance}, end ${made.end}: ${made.message}`);
  return made;
}

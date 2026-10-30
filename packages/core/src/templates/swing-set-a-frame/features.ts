import {
  type BoltJoint,
  edgeDistance,
  endDistance,
  formatDiameters,
  shortfalls,
  spacingBetweenRows,
  spacingInRow,
  spreadAcrossGrain,
} from '../../structural/boltDistances.ts';
import { boltHoleDiameter } from '../../structural/boltHoles.ts';
import { formatAngle } from '../../units/angle.ts';
import { formatLength } from '../../units/length.ts';
import type { BoltArea, Flag, Hole, Taper } from '../types.ts';
import type { Dimensions, FrameGeometry } from './geometry.ts';
import type { SwingSetParams } from './params.ts';

// Holes, bolt areas, and the flush cut, in each part's own frame (spec, Holes and joints;
// template version 4; crossbar and gusset bolt holes, spec, Bolt layout, template version 6). Frames as in placements.ts: u along the part from its first end, v across
// from its reference edge, n through its thickness.

const RAD = Math.PI / 180;

/** A hole's size for its bolt: drilled over the bolt's diameter (NDS 2024 12.1.3.2, #110). */
const boltHole = (boltDiameter: number) => ({
  diameter: boltHoleDiameter(boltDiameter),
  boltDiameter,
});

export interface PartFeatures {
  referenceEdge: string;
  holes: Hole[];
  boltAreas: BoltArea[];
  tapers: Taper[];
}

/** Where a board's bolts go, at each end, in the board's own frame. */
export interface BoardBolts {
  hardwareId: 'crossbar-bolts' | 'gusset-bolts';
  diameter: number;
  /** Across the board, from its bottom (reference) edge. */
  vs: number[];
  /** Along the board, from an end cut to the bolt line: past the leg, then half the leg. */
  toBoltLine: number;
  /** The board's width, thickness, overall length, and the height of its bottom edge. */
  width: number;
  thickness: number;
  length: number;
  bottomZ: number;
  pastLeg: number;
}

/** The crossbar and gusset bolt layout (spec, Bolt layout). */
export function boardBolts(
  p: SwingSetParams,
  dims: Dimensions,
  g: FrameGeometry,
): Record<'crossbar' | 'gusset', BoardBolts> {
  const cos = Math.cos(g.splay * RAD);
  const layout = (
    hardwareId: BoardBolts['hardwareId'],
    bolts: { diameter: number; perJoint: number },
    width: number,
    thickness: number,
    length: number,
    bottomZ: number,
    pastLeg: number,
  ): BoardBolts => ({
    hardwareId,
    diameter: bolts.diameter,
    vs: Array.from({ length: bolts.perJoint }, (_, i) => ((i + 0.5) * width) / bolts.perJoint),
    toBoltLine: pastLeg + dims.w / (2 * cos),
    width,
    thickness,
    length,
    bottomZ,
    pastLeg,
  });
  return {
    crossbar: layout(
      'crossbar-bolts',
      p.hardware.crossbarBolts,
      dims.cw,
      dims.ct,
      g.crossbar.bottomEdge,
      dims.zc - dims.cw,
      g.crossbar.pastLeg ?? 0,
    ),
    gusset: layout(
      'gusset-bolts',
      p.hardware.gussetBolts,
      dims.gh,
      dims.gt,
      g.gusset.bottomWidth,
      dims.H - dims.gh,
      g.gusset.pastLeg ?? 0,
    ),
  };
}

export function features(
  p: SwingSetParams,
  dims: Dimensions,
  g: FrameGeometry,
): Record<'beam' | 'leg' | 'crossbar' | 'gusset', PartFeatures> {
  const a = g.splay * RAD;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const tan = Math.tan(a);
  const h = p.hardware;
  const top = dims.H + dims.bd;
  const plyThickness = dims.bw / dims.plies;

  // Leg-to-beam bolt (spec, Top of the leg): horizontal, at mid-depth of the beam, through the
  // middle of the leg's thickness. It enters the leg's outer edge and leaves through the flush
  // cut, so it meets the outer face at α from square (the tilted bearing face on the checklist).
  const boltZ = dims.H + dims.bd / 2;
  const legBoltHole: Hole = {
    hardwareId: 'leg-beam-bolts',
    ...boltHole(h.legBoltDiameter),
    // On the outer edge (v = w), where z = top + w·sin α − u·cos α equals the bolt's height.
    entry: { u: (top + dims.w * sin - boltZ) / cos, v: dims.w, n: dims.t / 2 },
    // Toward the beam, horizontally: in the leg's frame, (−sin α, −cos α, 0).
    direction: { u: -sin, v: -cos, n: 0 },
    // Outer face to flush face at the bolt's height: w / cos α − (bd/2)·tan α.
    length: dims.w / cos - (dims.bd / 2) * tan,
  };

  // The flush cut (spec, Top of the leg): a vertical face at y = bw/2, from the beam's underside
  // to the top cut. On the leg it starts on the inner edge bd / cos α from the top corner and ends
  // on the top cut bd·tan α from that corner, bd·sin α in from the edge square to it.
  const flushCut: Taper = {
    description: 'Flush cut',
    start: { u: dims.bd / cos, v: 0 },
    end: { u: dims.bd * sin * tan, v: dims.bd * sin },
    angleToEdge: g.splay,
  };

  // Crossbar and gusset bolts (spec, Bolt layout; template version 6): on the leg's centerline,
  // one in the middle of each equal strip across the board's width. Each is a hole through the
  // board and through the leg.
  const boardHoles = boardBolts(p, dims, g);
  const throughHole = (
    hardwareId: string,
    diameter: number,
    u: number,
    v: number,
    length: number,
  ): Hole => ({
    hardwareId,
    ...boltHole(diameter),
    entry: { u, v, n: 0 },
    direction: { u: 0, v: 0, n: 1 },
    length,
  });
  const boardFeatures = (board: BoardBolts): Hole[] =>
    board.vs.flatMap((v) => [
      throughHole(board.hardwareId, board.diameter, v * tan + board.toBoltLine, v, board.thickness),
      throughHole(
        board.hardwareId,
        board.diameter,
        board.length - v * tan - board.toBoltLine,
        v,
        board.thickness,
      ),
    ]);
  // In the leg's frame, a bolt at height z on the centerline: u = (top + (w/2)·sin α − z) / cos α.
  const legHoles = [boardHoles.crossbar, boardHoles.gusset].flatMap((board) =>
    board.vs.map((v) =>
      throughHole(
        board.hardwareId,
        board.diameter,
        (top + (dims.w / 2) * sin - (board.bottomZ + v)) / cos,
        dims.w / 2,
        dims.t,
      ),
    ),
  );

  // The beam: one leg-to-beam bolt hole per frame, at the frame's centerline and the beam's
  // mid-depth, through each ply. Ply bolts, for a built-up beam, go anywhere along the beam.
  const beamHoles: Hole[] = g.supportsX.map((x) => ({
    hardwareId: 'leg-beam-bolts',
    ...boltHole(h.legBoltDiameter),
    entry: { u: x, v: dims.bd / 2, n: 0 },
    direction: { u: 0, v: 0, n: 1 },
    length: plyThickness,
  }));
  const plyArea: BoltArea[] =
    dims.plies > 1 && h.plyBolts
      ? [
          {
            hardwareId: 'ply-bolts',
            count: h.plyBolts.count,
            diameter: h.plyBolts.diameter,
            withPart: 'beam',
            outline: [
              { u: 0, v: 0 },
              { u: dims.L, v: 0 },
              { u: dims.L, v: dims.bd },
              { u: 0, v: dims.bd },
            ],
          },
        ]
      : [];

  return {
    beam: {
      referenceEdge: 'bottom edge',
      holes: beamHoles,
      boltAreas: plyArea,
      tapers: [],
    },
    leg: {
      referenceEdge: 'inner edge, against the beam',
      holes: [legBoltHole, ...legHoles],
      boltAreas: [],
      tapers: [flushCut],
    },
    crossbar: {
      referenceEdge: 'bottom edge',
      holes: boardFeatures(boardHoles.crossbar),
      boltAreas: [],
      tapers: [],
    },
    gusset: {
      referenceEdge: 'bottom edge',
      holes: boardFeatures(boardHoles.gusset),
      boltAreas: [],
      tapers: [],
    },
  };
}

/**
 * The flush cut as marks a builder can measure (#50): a point on the inner edge from the top
 * corner, a point on the top cut from the same corner, and a line between them.
 */
export function flushCutNote(cut: Taper, angle: string, depthSquare: number): string {
  const alongTopCut = Math.hypot(cut.end.u, cut.end.v);
  return `Flush cut on the inside face at the top: mark the inner edge ${formatLength(cut.start.u)} down from the top corner, and the top cut ${formatLength(alongTopCut)} from that corner (${formatLength(depthSquare)} in from the edge, square to it). Cut along the line between the marks, through the leg; it runs at ${angle} to the inner edge.`;
}

/**
 * Each bolted joint's distances against NDS 2024 12.5.1 (spec, Bolt layout; #93). The swing set
 * is built from softwood dimension lumber. Loads assumed: along each board's grain, and across
 * the leg's grain (the board meets it at 90° − α); at the beam, across its grain.
 */
export function boltJoints(p: SwingSetParams, dims: Dimensions, g: FrameGeometry): BoltJoint[] {
  const a = g.splay * RAD;
  const bolts = boardBolts(p, dims, g);
  const angle = formatAngle(g.splay);
  const across = formatAngle(90 - g.splay);

  const boardJoint = (title: string, member: string, b: BoardBolts): BoltJoint => {
    const n = b.vs.length;
    const D = b.diameter;
    // ℓ/D: the lesser of the bolt's length in the leg and in the board, over D (Table 12.5.1C).
    const lOverD = Math.min(dims.t, b.thickness) / D;
    const rowSpacing = b.width / n;
    const distances = [
      endDistance(
        member,
        b.toBoltLine,
        D,
        'parallel',
        'softwood',
        "End distance, along the grain on each bolt's line",
      ),
      edgeDistance(member, b.vs[0] ?? 0, D, 'parallel', lOverD, rowSpacing),
      ...(n > 1
        ? [
            spacingBetweenRows(member, rowSpacing, D, 'parallel', lOverD),
            spreadAcrossGrain(member, (n - 1) * rowSpacing),
          ]
        : []),
      edgeDistance('Leg', dims.w / 2, D, 'perpendicular', lOverD),
      ...(n > 1 ? [spacingInRow('Leg', rowSpacing / Math.cos(a), D, 'perpendicular')] : []),
    ];
    return {
      title,
      bolts: n,
      diameter: D,
      distances,
      notes: [
        `The bolts sit on the leg's centerline, one in the middle of each equal strip across the ${member.toLowerCase()}'s width.`,
        b.pastLeg > 0
          ? `The ${member.toLowerCase()} runs ${formatLength(b.pastLeg)} past each leg's outer face, so each bolt has 7D of end distance whichever way it bears.`
          : `The leg is wide enough for 7D of end distance with the ${member.toLowerCase()} flush with it.`,
        `End distance is measured along the grain on each bolt's line; the end is cut at ${angle} from square, parallel to the leg.`,
        `Assumed: load along the ${member.toLowerCase()}'s grain, and across the leg's grain, which the ${member.toLowerCase()} meets at ${across}. Softwood lumber.`,
      ],
    };
  };

  // Leg-to-beam bolt: through the beam at the frame's centerline and mid-depth.
  const D = p.hardware.legBoltDiameter;
  const beamOverD = dims.bw / dims.plies / D;
  const legToBeam: BoltJoint = {
    title: 'Leg to beam',
    bolts: 1,
    diameter: D,
    distances: [
      endDistance('Beam', g.supportsX[0], D, 'perpendicular', 'softwood'),
      edgeDistance('Beam', dims.bd / 2, D, 'perpendicular', beamOverD),
    ],
    notes: [
      "The bolt is at the beam's mid-depth, at the frame's centerline.",
      "In the leg the bolt runs through the leg's width at an angle, which Tables 12.5.1A to 12.5.1D do not describe; it stays on the confirmation checklist.",
      'Assumed: the swing loads cross the beam’s grain. Softwood lumber.',
    ],
  };

  return [
    boardJoint('Crossbar to leg', 'Crossbar', bolts.crossbar),
    boardJoint('Gusset to leg', 'Gusset', bolts.gusset),
    legToBeam,
  ];
}

/** An expert check for each joint with a distance under an NDS row (spec, Bolt layout). */
export function boltFlags(joints: readonly BoltJoint[]): Flag[] {
  return joints.flatMap((joint) => {
    const items = joint.distances.flatMap((d) => {
      const short = shortfalls(d);
      if (short.length === 0) return [];
      const rows = short
        .map(
          (r) =>
            `${r.gives === 'maximum' ? 'over' : 'under'} ${r.multiple} (${formatLength(r.value)}) for ${r.gives}, ${r.condition}`,
        )
        .join('; ');
      return [
        `${d.member.toLowerCase()} ${d.label.toLowerCase()} ${formatLength(d.value)} (${formatDiameters(d.value, joint.diameter)}): ${rows}`,
      ];
    });
    if (items.length === 0) return [];
    return [
      {
        category: 'load-bearing' as const,
        ask: `${joint.title}, ${joint.bolts} ${formatLength(joint.diameter)} bolt${joint.bolts > 1 ? 's' : ''}: ${items.join('. ')}. Confirm the bolt size and layout with these distances.`,
        why: 'NDS 2024 12.5.1 sets these distances for bolts in wood (Tables 12.5.1A to 12.5.1D). Below a full-value distance, the joint is designed for less load.',
      },
    ];
  });
}

/** The crossbar and gusset ends project past the legs (spec, Bolt layout): ask about them. */
export function projectionFlags(bolts: Record<'crossbar' | 'gusset', BoardBolts>): Flag[] {
  const past = [bolts.crossbar, bolts.gusset].filter((b) => b.pastLeg > 0);
  if (past.length === 0) return [];
  const where = past
    .map(
      (b) =>
        `the ${b.hardwareId === 'crossbar-bolts' ? 'crossbar' : 'gusset'} ends ${formatLength(b.pastLeg)}, ${formatLength(b.bottomZ, 'feet-inches')} to ${formatLength(b.bottomZ + b.width, 'feet-inches')} above the ground`,
    )
    .join(', and ');
  return [
    {
      category: 'load-bearing',
      ask: `For the bolts' end distance, ${where} project past the legs. Confirm the projecting ends are acceptable where children play, with their edges and corners eased.`,
      why: 'The projecting ends are new to this design, and children reach the crossbar.',
    },
  ];
}

import { z } from 'zod';
import type { BoardGuideId } from '../../knowledge/boardSelection.ts';
import { stock } from '../../lumber/stock.ts';
import { preservativeFor } from '../../lumber/treatment.ts';
import { withLetters } from '../../model/letters.ts';
import {
  cutAndDrillOperations,
  Operation,
  tighteningOperations,
  treatmentOperations,
} from '../../model/operations.ts';
import {
  Flag,
  type GenerateResult,
  HardwareItem,
  type Issue,
  Part,
  Placement,
} from '../../model/types.ts';
import { BoltJoint } from '../../structural/boltDistances.ts';
import { formatAngle } from '../../units/angle.ts';
import { formatLength } from '../../units/length.ts';
import {
  type BoardBolts,
  boardBolts,
  boltFlags,
  boltJoints,
  features,
  flushCutNote,
  projectionFlags,
} from './features.ts';
import {
  type Dimensions,
  dimensions,
  FrameGeometry,
  frameGeometry,
  legsReachGround,
  splayForFootprint,
} from './geometry.ts';
import { HARDWARE_NOTES, hardware, PRESERVATIVE_GROUP, validateHardware } from './hardware.ts';
import { SiteLayout, SwingGeometry, siteLayout, swingGeometry } from './layout.ts';
import { SwingSetParams } from './params.ts';
import { placements } from './placements.ts';
import { assemblyOrderFlag, flags, validate, validateSwings } from './validate.ts';

/**
 * Bump whenever output for the same parameters would change (decision 0008).
 * Version 1 matches docs/templates/swing-set-a-frame.md, status v1. Version 2 adds sources to
 * G, the pendulum factor, and the beam's breadth and depth in the structural working (#36); no
 * number changes. Version 3 adds a 3D placement for every part instance (#49); no other output
 * changes. Version 4 adds holes, bolt areas, the flush cut, and each end cut's reference edge as
 * part data, and rewords the flush-cut note as two marks a builder can measure (#50). Version 5
 * letters the parts in cut-list order (#66); no number changes. Version 6 runs the crossbar and
 * gusset ends past the legs, places their bolts as holes, and reports each bolted joint's
 * distances against NDS 2024 (#93, decision 0016). Version 7 adds what to look for when choosing
 * each part's board (#53); no number changes. Version 8 adds the operations each part and the site
 * need (#103); no number changes. Version 9 drills each bolt hole 1/16" over its bolt, per NDS 2024
 * 12.1.3.2 (#110); bolt sizes and positions do not change. Version 10 names the parts and hardware
 * each flag and checklist item concerns (#51); no number or wording changes. Version 11 stores the
 * board plan's kerf and end trim (#58), the values it always used; nothing else changes. Version 12
 * puts each hardware item and shopping line in a store group (#59), and rewords each bolt's note
 * as #68's audit asked; no number changes. Version 15 reports the dynamic factor at which each
 * strength check reaches margin 1.0 (#401), and lists the factor in the working after the loads it
 * multiplies; no margin changes. Version 16 plans legs on pads before the anchor count is entered
 * (#406), listing the anchors with the input their count waits for; parameters that generated
 * before give the same output. Version 17 leaves out each part list that is empty (#430). Version
 * 18 names the structural input behind each entered quantity in the working, and the parameters
 * behind each bolted joint's size and count, so a suggested value can say so (#417); the
 * leg-to-beam checklist item no longer calls its bolt size entered. No number changes. Version 19
 * changes only how its build steps read: with no method fitting, a step lists every method closest
 * to the owner's tools first, and says when the toolbox is empty (#459). Stored output is the same.
 * Version 20 rewords the leg's flush-cut note to give one measurement for each mark and to call the
 * cut a taper, as its build step does (#455); its board drawings show each piece's end angles, and
 * its cut details name each leg's ends. No number changes.
 * Version 21 changes only how its build steps read: every power-tool method says to wear eye
 * protection, and hearing protection for saws, routers, jointers and planers, and the leg taper
 * cut with a circular saw says to let the blade stop before lifting the saw (#457).
 * Version 22 gives each bolt the length to buy, from its grip, two USS flat washers, and a
 * nylon-insert locknut, names each bolt's shopping line by it, carries each item's notes to its
 * line, and names the fastener materials IRC 2021 R317.3.1 allows in treated lumber (#449).
 * Version 23 supports the beam at the middle of each gusset's top edge, where it bears, instead of
 * at the frame centerlines, which lengthens the span by one leg's plus one gusset's thickness (#445).
 * Version 24 keeps the lengths that fit each bolt, and each bolt line's bolt and items, so a bolt
 * bought before a change can be compared with the new grip (#514). No number changes.
 * Version 25 moves the note about a shorter board onto its lumber line, and gives each line what
 * else to buy when the store has none of its boards: other lengths, and other beam sizes that keep
 * the beam checks' margin, each with its margin (#450). No number changes.
 * Version 26 asks whether buried legs need use category UC4B rather than UC4A, asks what each leg's
 * end stands on, and cites NDS Table 2.3.2 for the C_D cap (#464). No number changes.
 * Version 27 marks every part as treated lumber, so each part's cuts and each bolt's holes get a
 * coat of preservative (IRC 2021 R317.1.1), in a step after easing the edges and before each bolt
 * goes in, and the shopping list adds the preservative (#447). No number changes.
 * Version 28 also measures the gusset's bolts against the beam's weight, which crosses its grain:
 * end distance, the loaded top edge and the bottom edge, and spacing in a row (#456).
 * Version 29 adds the steps that put the frame up after the beam is bolted: stand the A-frames up
 * and brace them, plumb them and backfill the leg holes or anchor the feet, tighten every bolt and
 * cap its end, and hang the swings, each with the CPSC rules for it. It also asks which order the
 * frame goes up in (#451). No number changes.
 */
export const TEMPLATE_VERSION = 29;

/**
 * Board selection guides for each part (knowledge/boardSelection.ts; spec, Board selection). The
 * legs stand in or on the ground whether buried or on pads, so they always get ground contact.
 */
/** Two A-frames hold the beam, and two swings hang from it. */
const FRAMES = 2;
const SWINGS = 2;

const SELECTION = {
  beam: ['structural', 'span', 'bolted'],
  leg: ['structural', 'along-length', 'bolted', 'ground-contact'],
  crossbar: ['structural', 'bolted'],
  gusset: ['structural', 'bolted'],
} as const satisfies Record<string, readonly BoardGuideId[]>;
export const TEMPLATE_ID = 'swing-set-a-frame';

export const SwingSetOutput = z.object({
  params: SwingSetParams,
  geometry: FrameGeometry,
  swings: SwingGeometry,
  layout: SiteLayout,
  parts: z.array(Part),
  /** Where each part instance sits in 3D. Plans made before version 3 have none (decision 0014). */
  placements: z.array(Placement).optional(),
  hardware: z.array(HardwareItem),
  /** Notes to show with the hardware shopping list. */
  hardwareNotes: z.array(z.string()).readonly(),
  flags: z.array(Flag),
  /** Each bolted joint's distances against NDS 2024 (#93). Plans made before version 6 have none. */
  boltLayout: z.array(BoltJoint).optional(),
  /** What needs doing to each part, and on the site (#103). Plans made before version 8 have none. */
  operations: z.array(Operation).optional(),
});
export type SwingSetOutput = z.infer<typeof SwingSetOutput>;

function parseIssues(error: z.ZodError): Issue[] {
  return error.issues.map((issue) => ({
    code: `invalid-${issue.code}`,
    message: issue.message,
    params: issue.path.length > 0 ? [String(issue.path[0])] : [],
  }));
}

/** "Back leg (uphill)", or no slope note on level ground. Ground falls toward the front when g > 0. */
function legName(side: 'back' | 'front', groundSlope: number): string {
  const name = side === 'back' ? 'Back leg' : 'Front leg';
  if (groundSlope === 0) return name;
  const uphill = (side === 'back') === groundSlope > 0;
  return `${name} (${uphill ? 'uphill' : 'downhill'})`;
}

/** The parts in cut-list order, which sets their letters (#66). */
function parts(p: SwingSetParams, dims: Dimensions, g: FrameGeometry): Omit<Part, 'letter'>[] {
  const angle = formatAngle(g.splay);
  const f = features(p, dims, g);
  // Every end cut on the swing set is a miter: drawn on the face, from the reference edge.
  const levelCut = (where: string) => ({
    setting: g.splay,
    description: `${where}: level cut`,
    measuredFrom: 'reference-edge' as const,
  });
  // Crossbar and gusset ends run past the leg, parallel to it, for the bolts' end distance (spec,
  // Bolt layout). Flush only when the leg alone is wide enough.
  const boardEnd = (past: number) => ({
    setting: g.splay,
    description:
      past > 0 ? `${formatLength(past)} past the leg, parallel to it` : 'Flush with the leg',
    measuredFrom: 'reference-edge' as const,
  });
  const bolts = boardBolts(p, dims, g);
  const drilling = (b: BoardBolts) =>
    `Bolt holes, ${b.vs.length} at each end: on a line parallel to the end cut, ${formatLength(b.toBoltLine)} from it, ${b.vs.map((v) => formatLength(v)).join(' and ')} up from the bottom edge. Clamp it in place and drill through it and the leg together.`;
  const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
  const flushCut = f.leg.tapers[0];
  const leg = (side: 'back' | 'front'): Omit<Part, 'letter'> => {
    const l = g[side];
    return {
      id: `leg-${side}`,
      name: legName(side, p.groundSlope),
      role: 'leg',
      selection: [...SELECTION.leg],
      treated: true,
      stock: stock(p.legStock),
      quantity: 2,
      length: l.overallLength,
      markLengths: [{ label: 'Each edge, top cut to foot cut', value: l.edgeLength }],
      ends: [levelCut('Top'), levelCut('Foot')],
      endsParallel: true,
      notes: [
        ...(flushCut ? [flushCutNote(flushCut, angle)] : []),
        ...(dims.d > 0 ? [`${formatLength(l.belowGrade)} of this leg is below grade.`] : []),
      ],
      ...f.leg,
    };
  };

  return [
    {
      id: 'beam',
      name: p.beamPlies > 1 ? 'Beam ply' : 'Beam',
      role: 'beam',
      selection: [...SELECTION.beam],
      treated: true,
      stock: stock(p.beamStock),
      quantity: p.beamPlies,
      length: dims.L,
      markLengths: [],
      ends: [square, square],
      endsParallel: true,
      notes:
        p.beamPlies > 1
          ? [
              `${p.beamPlies} plies fastened face to face make one ${formatLength(dims.bw)} wide beam.`,
            ]
          : [],
      ...f.beam,
    },
    leg('back'),
    leg('front'),
    {
      id: 'crossbar',
      name: 'Crossbar',
      role: 'crossbar',
      selection: [...SELECTION.crossbar],
      treated: true,
      stock: stock(p.crossbarStock),
      quantity: 2,
      length: g.crossbar.bottomEdge,
      markLengths: [
        { label: 'Top edge', value: g.crossbar.topEdge },
        { label: 'Bottom edge', value: g.crossbar.bottomEdge },
      ],
      ends: [boardEnd(bolts.crossbar.pastLeg), boardEnd(bolts.crossbar.pastLeg)],
      endsParallel: false,
      notes: ['Fastened to the outside face of the legs.', drilling(bolts.crossbar)],
      ...f.crossbar,
    },
    {
      id: 'gusset',
      name: 'Gusset',
      role: 'gusset',
      selection: [...SELECTION.gusset],
      treated: true,
      stock: stock(p.gussetStock),
      quantity: 2,
      length: g.gusset.bottomWidth,
      markLengths: [
        { label: 'Top edge (against the beam)', value: g.gusset.topWidth },
        { label: 'Bottom edge', value: g.gusset.bottomWidth },
      ],
      ends: [boardEnd(bolts.gusset.pastLeg), boardEnd(bolts.gusset.pastLeg)],
      endsParallel: false,
      notes: [
        "On the outside face of the frame, top edge against the beam's underside.",
        drilling(bolts.gusset),
      ],
      ...f.gusset,
    },
  ];
}

export function generate(input: unknown): GenerateResult<SwingSetOutput> {
  const parsed = SwingSetParams.safeParse(input);
  if (!parsed.success) return { ok: false, issues: parseIssues(parsed.error) };
  const p = parsed.data;
  const dims = dimensions(p);

  let splay: number;
  if (p.splay.kind === 'angle') {
    splay = p.splay.degrees;
  } else {
    const solved = splayForFootprint(dims, p.splay.depth);
    if (solved === null) {
      return {
        ok: false,
        issues: [
          {
            code: 'footprint-out-of-range',
            message:
              'No splay between 5° and 35° gives that footprint depth with these parameters.',
            params: ['splay'],
          },
        ],
      };
    }
    splay = solved;
  }

  if (!legsReachGround(dims, splay)) {
    return {
      ok: false,
      issues: [
        {
          code: 'slope-too-steep',
          message:
            'The ground is too steep for this splay: a leg would not meet it below the beam.',
          params: ['groundSlope', 'splay'],
        },
      ],
    };
  }

  const g = frameGeometry(dims, splay);
  const swings = swingGeometry(p);
  const frameIssues = validate(dims, g);
  // Swings are checked against the span between the frames, which overlapping frames don't have.
  const fits = !frameIssues.some((issue) => issue.code === 'frames-do-not-fit');
  const issues = [
    ...frameIssues,
    ...(fits ? validateSwings(dims, swings) : []),
    ...validateHardware(p),
  ];
  if (issues.length > 0) return { ok: false, issues };

  const joints = boltJoints(p, dims, g);
  const madeParts = withLetters(parts(p, dims, g));
  // Every part is pressure-treated lumber: the beam checks take a waterborne treatment
  // (structural.ts), and the legs stand in or on the ground.
  const madeHardware = [...hardware(p, dims, g), ...preservativeFor(madeParts, PRESERVATIVE_GROUP)];
  return {
    ok: true,
    output: {
      params: p,
      geometry: g,
      swings,
      layout: siteLayout(p, g, swings),
      parts: madeParts,
      placements: placements(dims, g),
      hardware: madeHardware,
      hardwareNotes: HARDWARE_NOTES,
      flags: [
        ...flags(dims, g),
        ...boltFlags(joints),
        ...projectionFlags(boardBolts(p, dims, g)),
        assemblyOrderFlag(dims),
      ],
      boltLayout: joints.map((j) => j.joint),
      operations: operations(madeParts, madeHardware, dims, p.swings.seatHeight),
    },
  };
}

/**
 * The spec's operations (Operations): every cut and bolt hole, from the parts and hardware; easing
 * the edges of every part, since children touch every surface (DOMAIN.md, Lumber and finish); and
 * the legs' holes (buried) or pads (d = 0); then a coat of preservative on every cut and in every
 * bolt hole, since every part is treated lumber. Last, the work of putting the frame up: raising
 * and bracing each A-frame, backfilling the leg holes or anchoring the feet, tightening every bolt,
 * and hanging the swings.
 */
function operations(
  madeParts: readonly Part[],
  items: readonly HardwareItem[],
  dims: Dimensions,
  seatHeight: number,
) {
  const legs = madeParts
    .filter((part) => part.role === 'leg')
    .reduce((n, part) => n + part.quantity, 0);
  const site: Operation =
    dims.d > 0
      ? { id: 'site/dig-holes', type: 'dig-holes', count: legs, depth: dims.d }
      : { id: 'site/level-pads', type: 'level-pads', count: legs };
  const ops = [
    ...cutAndDrillOperations(madeParts, items),
    ...madeParts.map(
      (part): Operation => ({
        id: `${part.id}/ease-edges`,
        type: 'ease-edges',
        partId: part.id,
        count: part.quantity,
      }),
    ),
    site,
  ];
  const set: Operation =
    dims.d > 0
      ? { id: 'site/backfill', type: 'backfill', count: legs, depth: dims.d }
      : { id: 'site/anchor', type: 'anchor', count: legs };
  const assembly: Operation[] = [
    {
      id: 'frames/raise',
      type: 'raise',
      count: FRAMES,
      partIds: madeParts.filter((part) => part.role !== 'beam').map((part) => part.id),
      // The legs' tops, level with the top of the beam.
      height: dims.H + dims.bd,
    },
    set,
    ...tighteningOperations(ops),
    { id: 'swings/hang', type: 'hang', count: SWINGS, height: seatHeight },
  ];
  return [...ops, ...treatmentOperations(madeParts, ops), ...assembly];
}

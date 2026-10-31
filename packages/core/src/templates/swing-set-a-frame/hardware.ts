import type { HardwareItem, Issue } from '../../model/types.ts';
import { formatLength } from '../../units/length.ts';
import type { Dimensions, FrameGeometry } from './geometry.ts';
import type { SwingSetParams } from './params.ts';

// Hardware (docs/templates/swing-set-a-frame.md, Hardware). Sizes and counts are inputs; this
// computes quantities and grips only.

/** Where each item is found in a store (#59), in the order the checklist shows them. */
const GROUPS = {
  bolts: 'Bolts and fittings',
  swing: 'Swing hardware',
  anchors: 'Ground anchors',
} as const;

const FRAMES = 2;
/** Each frame has two legs, and the crossbar and the gusset each meet both. */
const JOINTS = 4;
const FEET = 4;

/** Inputs the hardware needs that depend on other choices. */
export function validateHardware(p: SwingSetParams): Issue[] {
  const issues: Issue[] = [];
  if (p.beamPlies > 1 && p.hardware.plyBolts === undefined) {
    issues.push({
      code: 'ply-bolts-missing',
      message: 'A built-up beam needs ply bolts: enter their diameter and count.',
      params: ['hardware'],
    });
  }
  if (p.burialDepth === 0 && p.hardware.anchorsPerFoot === undefined) {
    issues.push({
      code: 'anchors-missing',
      message: 'Legs on pads need ground anchors: enter how many per foot.',
      params: ['hardware', 'burialDepth'],
    });
  }
  return issues;
}

function bolts(
  id: string,
  name: string,
  quantity: number,
  diameter: number,
  grip: number,
): HardwareItem {
  return {
    id,
    name,
    quantity,
    // CPSC Pub. 324, p. 3: a washer at each end, a locking nut, and a cap on the exposed end.
    bolt: { diameter, grip, washers: 2, nut: 'locking', cap: true },
    structural: true,
    // Worded as #68's audit asked (docs/design/words.html): the length after its subject.
    notes: [
      `${formatLength(diameter)} through-bolt. Length: at least ${formatLength(grip)} plus two washers and a locking nut, and no more than ${formatLength(diameter)} past the nut.`,
    ],
    group: GROUPS.bolts,
  };
}

/** Notes for the hardware shopping list, from the CPSC home handbook (spec, Hardware). */
export const HARDWARE_NOTES = [
  'Bolt length: at least the grip plus two washers and the nut, and no more than one bolt diameter past the nut (CPSC Pub. 324, p. 3).',
  "All hardware corrosion-resistant and compatible with the lumber's pressure treatment (CPSC Pub. 324, p. 3).",
] as const;

export function hardware(p: SwingSetParams, dims: Dimensions, g: FrameGeometry): HardwareItem[] {
  const h = p.hardware;
  const items: HardwareItem[] = [
    bolts('leg-beam-bolts', 'Leg-to-beam bolts', FRAMES, h.legBoltDiameter, g.boltGrip),
    bolts(
      'crossbar-bolts',
      'Crossbar bolts',
      JOINTS * h.crossbarBolts.perJoint,
      h.crossbarBolts.diameter,
      dims.ct + dims.t,
    ),
    bolts(
      'gusset-bolts',
      'Gusset bolts',
      JOINTS * h.gussetBolts.perJoint,
      h.gussetBolts.diameter,
      dims.gt + dims.t,
    ),
  ];
  if (p.beamPlies > 1 && h.plyBolts) {
    items.push(
      bolts('ply-bolts', 'Beam ply bolts', h.plyBolts.count, h.plyBolts.diameter, dims.bw),
    );
  }
  items.push(
    {
      id: 'swing-hangers',
      name: 'Swing hangers',
      quantity: 4,
      structural: true,
      notes: ['Rated for swing use. The rating is checked in the structural review.'],
      group: GROUPS.swing,
    },
    {
      id: 'swing-seats',
      name: 'Swing seats with chain',
      quantity: 2,
      structural: false,
      notes: [
        `Lightweight seats (CPSC Pub. 324, p. 4). Set the chain to ${formatLength(p.beamHeight - p.swings.seatHeight)} from pivot to seat, less the hanger's drop.`,
      ],
      group: GROUPS.swing,
    },
  );
  if (p.burialDepth === 0 && h.anchorsPerFoot) {
    items.push({
      id: 'ground-anchors',
      name: 'Ground anchors',
      quantity: FEET * h.anchorsPerFoot,
      structural: true,
      notes: ['Bury or cover the anchors (CPSC Pub. 324, p. 4).'],
      group: GROUPS.anchors,
    });
  }
  return items;
}

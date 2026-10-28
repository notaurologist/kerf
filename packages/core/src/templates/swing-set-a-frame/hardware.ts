import { formatLength } from '../../units/length.ts';
import type { HardwareItem, Issue } from '../types.ts';
import type { Dimensions, FrameGeometry } from './geometry.ts';
import type { SwingSetParams } from './params.ts';

// Hardware (docs/templates/swing-set-a-frame.md, Hardware). Sizes and counts are inputs; this
// computes quantities and grips only.

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
    bolt: { diameter, grip },
    structural: true,
    notes: [
      `${formatLength(diameter)} through-bolt, at least ${formatLength(grip)} plus two washers and a locking nut long, ending no more than ${formatLength(diameter)} past the nut.`,
    ],
  };
}

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
    },
    {
      id: 'swing-seats',
      name: 'Swing seats with chain',
      quantity: 2,
      structural: false,
      notes: [
        `Lightweight seats (CPSC Pub. 324, p. 4). Set the chain to ${formatLength(p.beamHeight - p.swings.seatHeight)} from pivot to seat, less the hanger's drop.`,
      ],
    },
  );
  if (p.burialDepth === 0 && h.anchorsPerFoot) {
    items.push({
      id: 'ground-anchors',
      name: 'Ground anchors',
      quantity: FEET * h.anchorsPerFoot,
      structural: true,
      notes: ['Bury or cover the anchors (CPSC Pub. 324, p. 4).'],
    });
  }
  return items;
}

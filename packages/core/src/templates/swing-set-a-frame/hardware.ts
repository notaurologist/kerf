import type { HardwareItem, Issue } from '../../model/types.ts';
import { boltHoleDiameter } from '../../structural/boltHoles.ts';
import { boltLength } from '../../structural/boltLength.ts';
import { formatLength, formatLimit } from '../../units/length.ts';
import type { Dimensions, FrameGeometry } from './geometry.ts';
import type { SwingSetParams } from './params.ts';

// Hardware (docs/templates/swing-set-a-frame.md, Hardware). Sizes and counts are inputs; this
// computes quantities, grips, and the bolt lengths to buy.

/** Where each item is found in a store (#59), in the order the checklist shows them. */
const GROUPS = {
  bolts: 'Bolts and fittings',
  swing: 'Swing hardware',
  anchors: 'Ground anchors',
} as const;

/** Where the preservative for field-treating cuts is found (`preservativeFor`). */
export const PRESERVATIVE_GROUP = 'Paint and stain';

/** Names of the hardware whose ratings and counts are read at the store (`storeReadings.ts`). */
export const HANGERS = 'Swing hangers';
export const ANCHORS = 'Ground anchors';
/** The anchor count's field, as the form labels it. */
export const ANCHORS_PER_FOOT = 'Ground anchors per leg foot';
/** The anchor rating's field, as the form labels it. */
export const ANCHOR_RATING = 'Ground anchor rated pull-out, one anchor';

const FRAMES = 2;
/** Each frame has two legs, and the crossbar and the gusset each meet both. */
const JOINTS = 4;
const FEET = 4;

/**
 * Inputs the hardware needs that depend on other choices. A beam compared in the structural review
 * is generated without its ply bolts, which the beam checks do not read.
 */
export function validateHardware(p: SwingSetParams, dims: Dimensions, plyBolts = true): Issue[] {
  const issues: Issue[] = [];
  const m = p.hardware.hangerMounting;
  if (m?.kind === 'horizontal-bolts') {
    const r = boltHoleDiameter(m.diameter) / 2;
    if (m.holeHeight - r <= 0 || m.holeHeight + r >= dims.bd) {
      issues.push({
        code: 'hanger-holes-outside-beam',
        message: `The swing hanger bolt holes, ${formatLength(boltHoleDiameter(m.diameter))} across, must fit within the beam's ${formatLength(dims.bd)} depth at that height.`,
        params: ['hardware'],
      });
    }
  }
  if (plyBolts && p.beamPlies > 1 && p.hardware.plyBolts === undefined) {
    issues.push({
      code: 'ply-bolts-missing',
      message: 'A built-up beam needs ply bolts: enter their diameter and count.',
      params: ['hardware'],
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
  // CPSC Pub. 324, p. 3: a washer at each end, a locking nut, a cap on the exposed end, and no
  // more than one bolt diameter past the nut.
  const fittings = { washers: 2, nut: 'locking', cap: true } as const;
  const fits = boltLength(diameter, grip, fittings.washers, fittings.nut, diameter);
  return {
    id,
    name,
    quantity,
    bolt: {
      diameter,
      grip,
      ...(fits?.length ? { length: fits.length } : {}),
      ...(fits ? { fits: { min: fits.min, max: fits.max } } : {}),
      ...fittings,
    },
    structural: true,
    notes: [
      fits
        ? `Grip ${formatLength(grip)}. Any length from ${formatLimit(fits.min, 'min')} to ${formatLimit(fits.max, 'max')} fits: through the grip, two USS flat washers, and a nylon-insert locking nut, and no more than ${formatLength(diameter)} past the nut (CPSC Pub. 324, p. 3).`
        : `Grip ${formatLength(grip)}. Length: at least the grip plus two washers and a locking nut, and no more than ${formatLength(diameter)} past the nut (CPSC Pub. 324, p. 3).`,
    ],
    group: GROUPS.bolts,
  };
}

/** The hanger bolts' ID, which the beam's holes and structural checks refer to. */
export const HANGER_BOLTS = 'hanger-bolts';

const HANGERS_COUNT = 4;

/**
 * The bolts that fasten the hangers, when they are bolted. The hanger's own plate or bracket is
 * part of the grip and only the hanger says how thick it is, so the line gives the wood's grip and
 * says to add it, with no length to buy.
 */
function hangerBolts(p: SwingSetParams, dims: Dimensions): HardwareItem | undefined {
  const m = p.hardware.hangerMounting;
  if (m === undefined || m.kind === 'other') return undefined;
  const vertical = m.kind === 'vertical-bolt';
  const grip = vertical ? dims.bd : dims.bw;
  const what = vertical
    ? "the beam's depth, plus the hanger's plate under it"
    : "the beam's breadth, plus the two sides of the hanger's bracket";
  return {
    id: HANGER_BOLTS,
    name: 'Swing hanger bolts',
    quantity: HANGERS_COUNT * (vertical ? 1 : m.perHanger),
    bolt: { diameter: m.diameter, grip, washers: 2, nut: 'locking', cap: true },
    structural: true,
    notes: [
      `Grip ${formatLength(grip)}: ${what}. Length: at least the grip, the hanger's thickness, two USS flat washers, and a nylon-insert locking nut, and no more than ${formatLength(m.diameter)} past the nut (CPSC Pub. 324, p. 3).`,
      'Many hangers come with their bolts: check those against this length.',
    ],
    group: GROUPS.bolts,
  };
}

/**
 * Notes for the hardware shopping list (spec, Hardware). The second follows IRC 2021 R317.3.1 and
 * its exception 2, read November 2026. Its exception 1 lets steel bolts 1/2" and larger go
 * uncoated, but CPSC Pub. 324, p. 3 asks for corrosion-resistant hardware on a play set, so the
 * note names the code's materials for every bolt.
 */
export const HARDWARE_NOTES = [
  "All hardware corrosion-resistant and compatible with the lumber's pressure treatment (CPSC Pub. 324, p. 3).",
  'Bolts, washers, and nuts in pressure-treated lumber: hot-dip galvanized steel (zinc coating to ASTM A153), stainless steel, silicon bronze, or copper, or mechanically galvanized steel to ASTM B695 Class 55 or heavier (IRC 2021 R317.3.1).',
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
  const forHangers = hangerBolts(p, dims);
  if (forHangers) items.push(forHangers);
  items.push(
    {
      id: 'swing-hangers',
      name: HANGERS,
      quantity: HANGERS_COUNT,
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
  // On pads the anchors are listed with or without their count, which is read from the anchor
  // maker's instructions at the store (#406).
  if (p.burialDepth === 0) {
    items.push({
      id: 'ground-anchors',
      name: ANCHORS,
      ...(h.anchorsPerFoot === undefined
        ? { quantityNeeded: { key: 'hardware.anchorsPerFoot', label: ANCHORS_PER_FOOT } }
        : { quantity: FEET * h.anchorsPerFoot }),
      structural: true,
      notes: ['Bury or cover the anchors (CPSC Pub. 324, p. 4).'],
      group: GROUPS.anchors,
    });
  }
  return items;
}

import { z } from 'zod';
import { formatLength } from '../units/length.ts';
import type { FormField } from './form.ts';
import type { BoredHole, HardwareItem, HingePlate, Issue, Part, Placement, Vec3 } from './types.ts';

// A bought concealed cup hinge for an inset door: a round cup set in a flat-bottomed hole in the
// door's back face, and an arm that clips to a mounting plate screwed to the inside face of the
// case side. Every size is the owner's, read from the maker's instructions (hard rule 3), so
// nothing here has a default. Fine Homebuilding (Striegler, "How to Install European Cup Hinges",
// issue 213) says the cup's hole is usually 35 mm across and that its depth and place vary by hinge.
//
// The hinge's own frame, with the door closed: the cup's center is on the back face, the cup's
// rim `cupFromEdge` in from the edge the hinge is on; the plate's screws are on the case side's
// face, on a line `plateSetback` behind the plane of the door's back face, centered on the cup's
// height and `plateScrewSpacing` apart along the hinge's axis when there are two.

const SIXTEENTH = 1 / 16;

export const CupHinge = z.object({
  /** The cup's hole: its diameter and depth, as the maker gives them. */
  cupDiameter: z.number().min(SIXTEENTH).max(3),
  cupDepth: z.number().min(SIXTEENTH).max(2),
  /** From the edge the hinge is on to the near side of the cup's hole. */
  cupFromEdge: z.number().min(0).max(2),
  /** From the plane of the closed door's back face back to the line of the plate's screws. */
  plateSetback: z.number().min(0).max(6),
  /** Screws that hold the plate, on one line along the hinge's axis. */
  plateScrews: z.union([z.literal(1), z.literal(2)]),
  /** Between the two screws' centers. Left out for a plate with one. */
  plateScrewSpacing: z.number().min(SIXTEENTH).max(6).optional(),
  /** The thinnest and thickest door the hinge is made for. */
  minThickness: z.number().min(SIXTEENTH).max(3),
  maxThickness: z.number().min(SIXTEENTH).max(3),
});
export type CupHinge = z.infer<typeof CupHinge>;

const FROM_THE_MAKER =
  "Read it in the maker's instructions or on the product page. Kerf takes inches: divide millimeters by 25.4.";

/**
 * The form fields for one concealed hinge, under `path` in the template's parameters, each entered
 * by the owner from the maker's instructions for the inset version of the hinge.
 */
export function cupHingeFields(path: string): FormField[] {
  return [
    {
      path: `${path}.cupDiameter`,
      label: 'Cup diameter',
      kind: 'length',
      help: `The hole the hinge's cup sits in, often 35 mm. The drilling diagram gives it; ${FROM_THE_MAKER}`,
      confirmed: true,
    },
    {
      path: `${path}.cupDepth`,
      label: 'Cup depth',
      kind: 'length',
      help: `How deep to bore the cup's hole, from the drilling diagram. ${FROM_THE_MAKER} Bore a test hole in scrap and check the hinge sits flat before boring the door.`,
      confirmed: true,
    },
    {
      path: `${path}.cupFromEdge`,
      label: 'Cup from the edge',
      kind: 'length',
      help: `From the door's edge to the near side of the cup's hole, called the boring distance or tab in the drilling diagram. If the hinge allows a range, enter the one you will bore. ${FROM_THE_MAKER}`,
      confirmed: true,
    },
    {
      path: `${path}.plateSetback`,
      label: 'Plate screws behind the door',
      kind: 'length',
      help: `From the back face of the closed door to the line of the mounting plate's screws, along the case side. The diagram for an inset door may give it from the case's front edge as a figure plus the door's thickness: enter that figure. ${FROM_THE_MAKER}`,
      confirmed: true,
    },
    {
      path: `${path}.plateScrews`,
      label: 'Screws in each plate',
      kind: 'choice',
      options: [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two, one above the other' },
      ],
      help: 'Count the screw holes in a mounting plate, or read the parts list in the instructions.',
      confirmed: true,
    },
    {
      path: `${path}.plateScrewSpacing`,
      label: 'Between the plate screws',
      kind: 'length',
      help: `From the center of one of the plate's screw holes to the other's. The drilling diagram gives it; or measure it on a plate. ${FROM_THE_MAKER}`,
      when: (value) => value(`${path}.plateScrews`) === '2',
      confirmed: true,
    },
    {
      path: `${path}.minThickness`,
      label: 'Thinnest door',
      kind: 'length',
      help: `The thinnest door the hinge is made for, listed as the door thickness in the specifications. ${FROM_THE_MAKER}`,
      confirmed: true,
    },
    {
      path: `${path}.maxThickness`,
      label: 'Thickest door',
      kind: 'length',
      help: `The thickest door the hinge is made for, listed as the door thickness in the specifications. ${FROM_THE_MAKER}`,
      confirmed: true,
    },
  ];
}

/** A hinge's line in the hardware list, with the sizes entered for it as notes. */
export function cupHingeItem(
  item: { id: string; name: string; group: string },
  hinge: CupHinge,
  quantity: number,
): HardwareItem {
  const screws =
    hinge.plateScrews === 2 && hinge.plateScrewSpacing !== undefined
      ? `two screws ${formatLength(hinge.plateScrewSpacing)} apart`
      : 'one screw';
  return {
    ...item,
    quantity,
    structural: false,
    hinge,
    notes: [
      `Inset hinges for a door ${formatLength(hinge.minThickness)} to ${formatLength(hinge.maxThickness)} thick, each with its mounting plate.`,
      `Bore each cup ${formatLength(hinge.cupDiameter)} across and ${formatLength(hinge.cupDepth)} deep, ${formatLength(hinge.cupFromEdge)} in from the edge, as the maker says.`,
      `Screw each plate to the case side with ${screws}, ${formatLength(hinge.plateSetback)} behind the door's back face, using the screws the maker says.`,
    ],
  };
}

/**
 * A problem with a hinge's sizes for a door `thickness` thick: the door is outside the thicknesses
 * the hinge is made for, its cup would go through the door, or its plate's second screw has no
 * spacing. `path` is where the hinge's fields are in the parameters; `thicknessParam` is the
 * door's thickness parameter.
 */
export function cupHingeIssues(
  hinge: CupHinge,
  path: string,
  thickness: number,
  thicknessParam: string,
): Issue[] {
  const issues: Issue[] = [];
  if (hinge.minThickness > hinge.maxThickness) {
    issues.push({
      code: 'hinge-thickness-range',
      message: `The hinge's thinnest door, ${formatLength(hinge.minThickness)}, is more than its thickest, ${formatLength(hinge.maxThickness)}.`,
      params: [`${path}.minThickness`, `${path}.maxThickness`],
    });
  } else if (thickness > hinge.maxThickness) {
    issues.push({
      code: 'hinge-too-thick',
      message: `The door is ${formatLength(thickness)} thick, but the hinge is made for doors up to ${formatLength(hinge.maxThickness)}.`,
      params: [thicknessParam, `${path}.maxThickness`],
    });
  } else if (thickness < hinge.minThickness) {
    issues.push({
      code: 'hinge-too-thin',
      message: `The door is ${formatLength(thickness)} thick, but the hinge is made for doors at least ${formatLength(hinge.minThickness)}.`,
      params: [thicknessParam, `${path}.minThickness`],
    });
  }
  if (hinge.cupDepth >= thickness) {
    issues.push({
      code: 'hinge-cup-depth',
      message: `The hinge's cup is ${formatLength(hinge.cupDepth)} deep, which would go through a door ${formatLength(thickness)} thick.`,
      params: [thicknessParam, `${path}.cupDepth`],
    });
  }
  if (hinge.plateScrews === 2 && hinge.plateScrewSpacing === undefined) {
    issues.push({
      code: 'hinge-plate-spacing',
      message: "Enter the distance between the mounting plate's two screws.",
      params: [`${path}.plateScrewSpacing`],
    });
  }
  return issues;
}

interface Piece {
  part: Part;
  placement: Placement;
}

type UVN = { u: number; v: number; n: number };

function toWorld(pl: Placement, p: UVN): Vec3 {
  const { origin: o, along: a, across: c, through: t } = pl;
  return {
    x: o.x + a.x * p.u + c.x * p.v + t.x * p.n,
    y: o.y + a.y * p.u + c.y * p.v + t.y * p.n,
    z: o.z + a.z * p.u + c.z * p.v + t.z * p.n,
  };
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

function toLocal(pl: Placement, w: Vec3): UVN {
  const d = { x: w.x - pl.origin.x, y: w.y - pl.origin.y, z: w.z - pl.origin.z };
  return { u: dot(d, pl.along), v: dot(d, pl.across), n: dot(d, pl.through) };
}

const EPSILON = 1e-6;

/** The offsets of a plate's screws along the hinge's axis from the cup's center. */
export function plateScrewOffsets(hinge: CupHinge): number[] {
  if (hinge.plateScrews === 1) return [0];
  if (hinge.plateScrewSpacing === undefined) {
    throw new Error('A mounting plate with two screws needs the distance between them.');
  }
  return [-hinge.plateScrewSpacing / 2, hinge.plateScrewSpacing / 2];
}

/**
 * The cups and plates for hinges `hardwareId` hanging one door from one case side: a cup in the
 * door's `back` face at each height in `cups` (u along the door from its first end), its rim
 * `cupFromEdge` in from the door's `edge`, and a plate on the face of the case side that faces
 * that edge, its screws where the hinge's sizes put them. The door's length runs along the hinge's
 * axis, and its width square to the case side. Both pieces are where the template places them; the
 * plates' screws are worked out in the case side's frame from those placements.
 */
export function cupHingePair(
  hinge: CupHinge,
  hardwareId: string,
  door: Piece,
  caseSide: Piece,
  at: { edge: 'reference' | 'far'; back: 'near' | 'far'; cups: readonly number[] },
): { cups: BoredHole[]; plates: HingePlate[] } {
  const T = door.part.stock.thickness;
  const W = door.part.stock.width;
  const sideT = caseSide.part.stock.thickness;
  if (Math.abs(Math.abs(dot(door.placement.across, caseSide.placement.through)) - 1) > EPSILON) {
    throw new Error("A hinge's case side must be square to the door's width.");
  }
  const center = hinge.cupFromEdge + hinge.cupDiameter / 2;
  const v = at.edge === 'reference' ? center : W - center;
  const vEdge = at.edge === 'reference' ? 0 : W;
  const nBack = at.back === 'near' ? 0 : T;
  const inward = at.back === 'near' ? 1 : -1;
  const offsets = plateScrewOffsets(hinge);
  const cups: BoredHole[] = [];
  const plates: HingePlate[] = [];
  for (const u of at.cups) {
    cups.push({
      use: 'for a hinge cup',
      diameter: hinge.cupDiameter,
      entry: { u, v, n: nBack },
      direction: { u: 0, v: 0, n: inward },
      depth: hinge.cupDepth,
      through: false,
      hinge: hardwareId,
    });
    const screws = offsets.map((d) =>
      toLocal(
        caseSide.placement,
        toWorld(door.placement, { u: u + d, v: vEdge, n: nBack - inward * hinge.plateSetback }),
      ),
    );
    const n = (screws[0] as UVN).n;
    const face = n <= EPSILON ? 'near' : n >= sideT - EPSILON ? 'far' : undefined;
    if (!face) throw new Error("The door's hinge edge is inside its case side.");
    plates.push({ hardwareId, face, screws: screws.map((s) => ({ u: s.u, v: s.v })) });
  }
  return { cups, plates };
}

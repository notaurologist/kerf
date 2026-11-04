import { z } from 'zod';
import { formatLength } from '../units/length.ts';
import type { FormField } from './form.ts';
import type { BoredHole, HardwareItem, Issue } from './types.ts';

// A bought vise screw: the threaded screw with its handle, the nut fixed behind the bench's jaw,
// and any guide bars that keep the moving jaw square. Every size is the owner's, read from the
// maker's instructions (hard rule 3), so nothing here has a default; a template puts these fields
// in its form and the values in its parameters. The template makes the wooden jaws, and bores
// the holes these sizes give through them (`viseHoles`).

const SIXTEENTH = 1 / 16;

export const ViseScrew = z.object({
  /** The hole to bore through both jaws for the screw, as the maker gives it. */
  screwHole: z.number().min(SIXTEENTH).max(4),
  /** The widest the jaws open, as the maker gives it. */
  maxOpening: z.number().min(SIXTEENTH).max(48),
  /** How many guide bars run beside the screw: none, one, or a pair either side of it. */
  guides: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  /** The hole to bore for each guide bar. Left out when there are none. */
  guideHole: z.number().min(SIXTEENTH).max(4).optional(),
  /** From the screw's center to each guide bar's center. Left out when there are none. */
  guideFromScrew: z.number().min(SIXTEENTH).max(24).optional(),
  /** Wood screws that hold the nut's flange to the back of the bench's jaw. */
  mountingScrews: z.number().int().min(0).max(24),
});
export type ViseScrew = z.infer<typeof ViseScrew>;

const FROM_THE_MAKER =
  "Read it in the maker's instructions or on the product page. Kerf takes inches: divide millimeters by 25.4.";

/**
 * The form fields for one vise screw, under `path` in the template's parameters (such as
 * `frontVise`), each entered by the owner from the maker's instructions.
 */
export function viseScrewFields(path: string): FormField[] {
  const hasGuides = (value: (p: string) => string) => {
    const n = value(`${path}.guides`);
    return n === '1' || n === '2';
  };
  return [
    {
      path: `${path}.screwHole`,
      label: 'Hole for the screw',
      kind: 'length',
      help: `The size of hole to bore through both jaws for the screw. ${FROM_THE_MAKER} If it gives only the screw's diameter, ask the maker what hole to bore; it is a little larger.`,
      confirmed: true,
    },
    {
      path: `${path}.maxOpening`,
      label: 'Widest opening',
      kind: 'length',
      help: `How far apart the jaws can open, listed as the capacity or the opening. ${FROM_THE_MAKER}`,
      confirmed: true,
    },
    {
      path: `${path}.guides`,
      label: 'Guide bars',
      kind: 'choice',
      options: [
        { value: 0, label: 'None' },
        { value: 1, label: 'One' },
        { value: 2, label: 'Two, one each side of the screw' },
      ],
      help: 'The round bars that come with the screw and slide through both jaws beside it. Count them in the box, or read the parts list in the instructions.',
      confirmed: true,
    },
    {
      path: `${path}.guideHole`,
      label: 'Hole for each guide bar',
      kind: 'length',
      help: `The size of hole to bore for each guide bar. ${FROM_THE_MAKER} If it is not given, measure across a bar with a tape and ask the maker how much larger to bore.`,
      when: hasGuides,
      confirmed: true,
    },
    {
      path: `${path}.guideFromScrew`,
      label: 'Guide bar from the screw',
      kind: 'length',
      help: `From the center of the screw to the center of a guide bar. The instructions' drilling diagram gives it; if they give the bars' distance apart, halve it. Or measure it on the nut's flange, between the centers of its holes.`,
      when: hasGuides,
      confirmed: true,
    },
    {
      path: `${path}.mountingScrews`,
      label: 'Screws to mount the nut',
      kind: 'integer',
      unit: 'screws',
      help: "How many wood screws hold the nut's flange to the back of the jaw: count the holes in the flange, or read the parts list. Use the size the instructions give.",
      confirmed: true,
    },
  ];
}

/** A vise screw's line in the hardware list, with the sizes entered for it as notes. */
export function viseScrewItem(
  item: { id: string; name: string; group: string },
  screw: ViseScrew,
): HardwareItem {
  const guides =
    screw.guides === 0 || screw.guideHole === undefined || screw.guideFromScrew === undefined
      ? []
      : [
          `${screw.guides === 1 ? 'One guide bar' : 'Two guide bars'}: bore ${formatLength(screw.guideHole)} for each, ${formatLength(screw.guideFromScrew)} from the screw's center.`,
        ];
  return {
    ...item,
    quantity: 1,
    structural: false,
    notes: [
      `Bore ${formatLength(screw.screwHole)} through both jaws for the screw, as its maker says.`,
      `Opens to ${formatLength(screw.maxOpening)}.`,
      ...guides,
      `Mount the nut with ${screw.mountingScrews} wood screws, of the size its maker says.`,
    ],
  };
}

/**
 * The holes a jaw needs for a vise screw, bored through it from the face at n = 0: the screw's at
 * `center`, and each guide bar's `guideFromScrew` from it along u or v (`guidesAlong`), the first
 * toward larger values. The template places the center and makes the jaw thick enough to hold
 * them; the fit checks hold each hole inside it.
 */
export function viseHoles(
  screw: ViseScrew,
  at: { center: { u: number; v: number }; thickness: number; guidesAlong: 'u' | 'v' },
): BoredHole[] {
  const { center, thickness, guidesAlong } = at;
  const through = (use: string, diameter: number, u: number, v: number): BoredHole => ({
    use,
    diameter,
    entry: { u, v, n: 0 },
    direction: { u: 0, v: 0, n: 1 },
    depth: thickness,
    through: true,
  });
  const holes = [through('for the screw', screw.screwHole, center.u, center.v)];
  if (screw.guides === 0) return holes;
  if (screw.guideHole === undefined || screw.guideFromScrew === undefined) {
    throw new Error('A vise screw with guide bars needs their hole and distance from the screw.');
  }
  const offsets = screw.guides === 1 ? [1] : [1, -1];
  for (const k of offsets) {
    const d = k * screw.guideFromScrew;
    holes.push(
      through(
        'for a guide bar',
        screw.guideHole,
        guidesAlong === 'u' ? center.u + d : center.u,
        guidesAlong === 'v' ? center.v + d : center.v,
      ),
    );
  }
  return holes;
}

/**
 * A problem with a vise's sizes: the opening the plan asks for is wider than the screw opens, or
 * its guide bars' sizes are missing. `path` is where the screw's fields are in the parameters.
 */
export function viseIssues(screw: ViseScrew, path: string, opening: number): Issue[] {
  const issues: Issue[] = [];
  if (opening > screw.maxOpening) {
    issues.push({
      code: 'vise-opening',
      message: `The plan opens this vise ${formatLength(opening)}, but its screw opens only ${formatLength(screw.maxOpening)}.`,
      params: [`${path}.maxOpening`],
    });
  }
  if (screw.guides > 0 && (screw.guideHole === undefined || screw.guideFromScrew === undefined)) {
    issues.push({
      code: 'vise-guides',
      message: 'Enter the hole for each guide bar and its distance from the screw.',
      params: [`${path}.guideHole`, `${path}.guideFromScrew`],
    });
  }
  return issues;
}

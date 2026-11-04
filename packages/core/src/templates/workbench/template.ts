import { z } from 'zod';
import { drawerSlideItem } from '../../model/drawerSlide.ts';
import { withLetters } from '../../model/letters.ts';
import { cutAndDrillOperations, Operation } from '../../model/operations.ts';
import {
  type GenerateResult,
  HardwareItem,
  type Issue,
  Part,
  Placement,
} from '../../model/types.ts';
import { formatLength } from '../../units/length.ts';
import { BOTTOM_SCREWS, FRONT_SCREWS } from './design.ts';
import { WorkbenchParams } from './params.ts';
import { type WorkbenchReview, type WorkbenchStructuralInputs, workbench } from './structural.ts';

// The workbench's design from its parameters (docs/templates/workbench.md): parts in cut-list
// order, placements, operations, hardware, and the structural review. Pure.

export const TEMPLATE_ID = 'workbench';
export const TEMPLATE_VERSION = 1;

export const WorkbenchGeometry = z.object({
  underside: z.number(),
  baseLength: z.number(),
  baseDepth: z.number(),
  legVisible: z.number(),
  caseInside: z.number(),
  upperOpenings: z.number(),
  lowerOpening: z.number(),
  slides: z.record(z.string(), z.number()),
  spans: z.object({
    tenons: z.number(),
    back: z.number(),
    bottom: z.number(),
    doorPanel: z.number(),
  }),
});

export const WorkbenchDesign = z.object({
  params: WorkbenchParams,
  geometry: WorkbenchGeometry,
  parts: z.array(Part),
  placements: z.array(Placement),
  operations: z.array(Operation),
  hardware: z.array(HardwareItem),
  hardwareNotes: z.array(z.string()),
});
export type WorkbenchDesign = z.infer<typeof WorkbenchDesign>;

const GROUP = 'Glue and finish';

/**
 * A wood screw's length through `through` into `into`: the first's thickness plus about
 * two-thirds of the second's, to the nearest quarter inch, as the record cabinet's cleat screws.
 */
function screwLength(through: number, into: number) {
  const length = Math.round((through + (2 * into) / 3) * 4) / 4;
  return { length, left: through + into - length };
}

/** Combinations the spec refuses before anything is built (spec, Validation and flags). */
function validate(p: WorkbenchParams): Issue[] {
  const issues: Issue[] = [];
  if (p.railThickness >= p.legSize) {
    issues.push({
      code: 'rail-thickness',
      message: `The rails are ${formatLength(p.railThickness)} thick, as thick as the ${formatLength(p.legSize)} legs or more. Make them thinner than the legs.`,
      params: ['railThickness', 'legSize'],
    });
  }
  const lowerOpening = p.drawerBand - 3 * p.caseThickness - p.upperOpening;
  if (lowerOpening < 2) {
    issues.push({
      code: 'drawer-band',
      message: `The drawer band leaves less than 2" for the lower drawer, below its three shelves and the upper drawers' ${formatLength(p.upperOpening)}. Make the band taller or the upper opening shorter.`,
      params: ['drawerBand', 'upperOpening', 'caseThickness'],
    });
  }
  if (p.vise.dogs.stopShort >= p.topThickness) {
    issues.push({
      code: 'dog-depth',
      message: `The dog holes stop ${formatLength(p.vise.dogs.stopShort)} short of the top's underside, no less than the ${formatLength(p.topThickness)} top is thick.`,
      params: ['vise.dogs.stopShort', 'topThickness'],
    });
  }
  return issues;
}

export function generate(
  params: WorkbenchParams,
  structuralInputs: WorkbenchStructuralInputs,
): GenerateResult<{ design: WorkbenchDesign; review: WorkbenchReview }> {
  const issues = validate(params);
  if (issues.length > 0) return { ok: false, issues };
  const made = workbench(params, structuralInputs);
  if (!made.ok) {
    return { ok: false, issues: [{ code: 'refused', message: made.message, params: [] }] };
  }
  const { base, review } = made;
  const g = base.geometry;
  const parts = withLetters(base.parts);
  const all = parts.map((part) => part.id);
  const has = (test: (id: string) => boolean) => all.filter(test);
  const legs = ['leg-vise', 'leg-a', 'leg-b'];
  const endFrames = has((id) => [...legs, 'foot', 'end-rail'].includes(id));
  const frame = [...endFrames, 'low-rail', 'top'];
  const caseParts = has(
    (id) => id.startsWith('case-') || id.startsWith('shelf-') || id === 'divider',
  );
  const drawerBoxes = has((id) => /-drawer-(box|side)-/.test(id));
  const doorParts = has((id) => id.startsWith('door-'));
  const count = (hardwareId: string) =>
    parts
      .flatMap((part) =>
        part.screwHoles.filter((h) => h.hardwareId === hardwareId).map(() => part.quantity),
      )
      .reduce((a, b) => a + b, 0);
  const frontScrews = count(FRONT_SCREWS);
  const bottomScrews = count(BOTTOM_SCREWS);
  const d = params.drawer;
  // A front within the flattening allowance of its board keeps the board's thickness.
  const ft = parts.find((part) => part.id === 'lower-drawer-front')?.stock.thickness ?? 0;
  const front = screwLength(d.boxThickness, ft);
  const bottom = screwLength(d.bottomThickness, d.boxThickness * 3);
  const reach = params.topLength;
  const operations = [
    ...cutAndDrillOperations(parts, base.hardware),
    { id: 'bench/dry-fit', type: 'dry-fit', count: 1, partIds: all, reach },
    {
      id: 'end-frames/glue',
      type: 'glue-assembly',
      count: 2,
      partIds: endFrames,
      reach: g.baseDepth + 2 * params.footPast,
    },
    {
      id: 'frame/glue',
      type: 'glue-assembly',
      count: 1,
      partIds: has((id) => frame.includes(id)),
      reach: g.baseLength,
    },
    { id: 'case/glue', type: 'glue-assembly', count: 1, partIds: caseParts, reach: g.baseLength },
    ...(drawerBoxes.length > 0
      ? [
          {
            id: 'drawers/glue',
            type: 'glue-assembly' as const,
            count: 3,
            partIds: drawerBoxes,
            reach: g.lowerOpening + g.caseInside,
          },
          {
            id: 'drawers/fasten',
            type: 'fasten' as const,
            count: frontScrews + bottomScrews,
            partIds: has((id) => id.includes('-drawer-')),
          },
        ]
      : []),
    {
      id: 'doors/glue',
      type: 'glue-assembly',
      count: 2,
      partIds: doorParts,
      reach: g.caseInside / 2,
    },
    ...parts.map(
      (part): Operation => ({
        id: `${part.id}/ease-edges`,
        type: 'ease-edges',
        partId: part.id,
        count: part.quantity,
      }),
    ),
    { id: 'bench/finish', type: 'finish', count: 1, partIds: all },
  ] satisfies Operation[];
  const slidesEntered = Object.keys(g.slides).length > 0;
  const slideItems = Object.entries(g.slides).map(([prefix, slideLength]) =>
    drawerSlideItem(
      {
        id: `${prefix}-slides`,
        name: `${prefix === 'upper-drawer' ? 'Upper' : 'Lower'} drawer slides, ${formatLength(slideLength)}`,
        group: 'Drawer slides',
      },
      prefix === 'upper-drawer' ? 2 : 1,
      slideLength,
      params.slides.sideClearance ?? 0,
    ),
  );
  const screws: HardwareItem[] = [
    {
      id: FRONT_SCREWS,
      name: `Wood screws, ${formatLength(front.length)} long`,
      quantity: frontScrews,
      structural: false,
      notes: [
        `Through each box front into its drawer front, two to a drawer. Length: the box front’s ${formatLength(d.boxThickness)} plus about two-thirds of the drawer front’s ${formatLength(ft)}, to the nearest quarter inch, so the points stop ${formatLength(front.left)} short of its show face.`,
        'Gauge: ask the hardware supplier which size suits hardwood of that thickness, and what pilot hole it needs.',
      ],
      group: 'Screws',
    },
    {
      id: BOTTOM_SCREWS,
      name: `Wood screws, ${formatLength(bottom.length)} long, with washers`,
      quantity: bottomScrews,
      structural: false,
      notes: [
        `Up through the slot at the back of each drawer bottom into the box back’s lower edge, one to a drawer, with a washer so the bottom can slide under the head. Length: the bottom’s ${formatLength(d.bottomThickness)} plus about twice the box back’s ${formatLength(d.boxThickness)} thickness into its edge, to the nearest quarter inch.`,
        'Leave it snug, not tight, and never glue the bottom: it moves front to back with the seasons.',
      ],
      group: 'Screws',
    },
  ];
  const hardware: HardwareItem[] = [
    ...base.hardware,
    ...(slidesEntered
      ? [...slideItems, ...screws]
      : [
          {
            id: 'slides',
            name: 'Drawer slides, side-mount',
            quantity: 3,
            structural: false,
            notes: [
              'Input needed: enter the slides’ figures from their instructions. Until then the plan does not size the drawer boxes, so it has no boxes, bottoms, or screws for them.',
            ],
            group: 'Drawer slides',
          },
        ]),
    {
      id: 'pulls',
      name: 'Drawer pulls',
      quantity: 3,
      structural: false,
      notes: ['One for each drawer front. Any pull whose screws suit the front’s thickness.'],
      group: 'Pulls',
    },
    {
      id: 'glue',
      name: 'Wood glue',
      quantity: 1,
      structural: false,
      notes: [
        'Enough for the top’s and legs’ strip glue-ups, the panel glue-ups, and every glued joint.',
      ],
      group: GROUP,
    },
    {
      id: 'finish',
      name: 'Finish',
      quantity: 1,
      structural: false,
      notes: [
        'Choose it with an experienced builder, and follow its instructions for ventilation. Many benches leave the top with a thin oil finish so it does not get slippery.',
      ],
      group: GROUP,
    },
  ];
  return {
    ok: true,
    output: {
      design: {
        params,
        geometry: g,
        parts,
        placements: base.placements,
        operations,
        hardware,
        hardwareNotes: [
          'The base is glued for good: the legs’ tenons into the feet and through the top, and the rails’ into the legs. The back legs’ tenons go unglued in their long mortises so the top can move.',
          'The case back, door panels, and drawer bottoms float in their grooves, unglued.',
        ],
      },
      review,
    },
  };
}

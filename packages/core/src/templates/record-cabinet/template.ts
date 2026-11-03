import { z } from 'zod';
import { withLetters } from '../../model/letters.ts';
import { cutAndDrillOperations, Operation } from '../../model/operations.ts';
import { type GenerateResult, HardwareItem, Part, Placement } from '../../model/types.ts';
import { formatLength } from '../../units/length.ts';
import { CabinetGeometry, cabinetGeometry, validate } from './geometry.ts';
import { RecordCabinetParams } from './params.ts';
import { cabinetParts } from './parts.ts';
import type { Allowances } from './structural.ts';

// The record cabinet's design from its parameters (docs/templates/record-cabinet.md): geometry,
// parts in cut-list order, placements, operations, and hardware. Pure.

export const TEMPLATE_ID = 'record-cabinet';
/**
 * Version 13 names the structural input behind each entered quantity in the working, so a
 * suggested value can say so (#417); no number changes. Version 14 changes only how its build
 * steps read: with no method fitting, a step lists every method closest to the owner's tools
 * first, and says when the toolbox is empty (#459). Stored output is the same. Version 15 changes
 * only how its build steps read: every power-tool method says to wear eye protection, and hearing
 * protection for saws, routers, jointers and planers, and the leg taper cut with a circular saw
 * says to let the blade stop before lifting the saw (#457). Stored output is the same.
 */
export const TEMPLATE_VERSION = 15;

export const CabinetDesign = z.object({
  params: RecordCabinetParams,
  geometry: CabinetGeometry,
  parts: z.array(Part),
  placements: z.array(Placement),
  operations: z.array(Operation),
  hardware: z.array(HardwareItem),
  hardwareNotes: z.array(z.string()),
});
export type CabinetDesign = z.infer<typeof CabinetDesign>;

const GROUP = 'Glue and finish';

export function generate(
  params: RecordCabinetParams,
  /** The case bottom's slots and the door panels' gaps, from the wood's movement. */
  allowances: Allowances,
): GenerateResult<CabinetDesign> {
  const g = cabinetGeometry(params);
  const issues = validate(params, g);
  // At its narrowest, each door panel must still reach into its grooves.
  const gap = allowances.panelGap.length;
  if (g.door && 2 * gap - 1 / 32 >= params.door.grooveDepth) {
    issues.push({
      code: 'panel-out-of-groove',
      message: `At its narrowest, each door panel would pull out of its ${formatLength(params.door.grooveDepth)} grooves.`,
      params: ['door.grooveDepth', 'door.frameWidth'],
    });
  }
  if (issues.length > 0) return { ok: false, issues };
  const made = cabinetParts(params, g, allowances);
  if (!made.ok) return made;
  const parts = withLetters(made.parts);
  const all = parts.map((part) => part.id);
  const has = (ids: readonly string[]) => all.filter((id) => ids.includes(id));
  const baseParts = has(['leg', 'apron-long', 'apron-short']);
  const caseParts = has(['bottom', 'side-left', 'side-right', 'partition', 'rail']);
  // The top sits in dadoes on the sides and partitions only.
  const topJoins = has(['top', 'side-left', 'side-right', 'partition']);
  // Each door's frame is glued around its panel, which floats unglued.
  const doorParts = has(['door-stile-outer', 'door-stile-inner', 'door-rail', 'door-panel']);
  const screws = parts.flatMap((part) => part.screwHoles.map(() => part.quantity));
  const screwCount = screws.reduce((a, b) => a + b, 0);
  const ta = parts.find((part) => part.id === 'apron-short')?.stock.thickness ?? 0;
  const tc = parts.find((part) => part.id === 'cleat')?.stock.width ?? 0;
  // Clamps reach along the base and the case, across a side apron and its cleat, and from the
  // top down to the case bottom.
  const operations = [
    ...cutAndDrillOperations(parts, []),
    { id: 'case/dry-fit', type: 'dry-fit', count: 1, partIds: all, reach: g.caseWidth },
    { id: 'base/glue', type: 'glue-assembly', count: 1, partIds: baseParts, reach: g.caseWidth },
    {
      id: 'cleats/glue',
      type: 'glue-assembly',
      count: 2,
      partIds: has(['apron-short', 'cleat']),
      reach: ta + tc,
    },
    { id: 'case/glue', type: 'glue-assembly', count: 1, partIds: caseParts, reach: g.caseWidth },
    {
      id: 'top/glue',
      type: 'glue-assembly',
      count: 1,
      partIds: topJoins,
      reach: g.height - g.baseHeight,
    },
    ...(g.door
      ? [
          {
            id: 'doors/glue',
            type: 'glue-assembly' as const,
            count: 2,
            partIds: doorParts,
            reach: g.door.width,
          },
        ]
      : []),
    { id: 'case/fasten', type: 'fasten', count: screwCount, partIds: has(['bottom', 'cleat']) },
    ...parts.map(
      (part): Operation => ({
        id: `${part.id}/ease-edges`,
        type: 'ease-edges',
        partId: part.id,
        count: part.quantity,
      }),
    ),
    { id: 'case/finish', type: 'finish', count: 1, partIds: all },
  ] satisfies Operation[];
  const hardware: HardwareItem[] = [
    {
      id: 'screws',
      name: 'Wood screws',
      quantity: screwCount,
      structural: false,
      notes: [
        'Length: the cleat’s thickness plus about two-thirds of the case bottom’s thickness, so the points stop short of its top face. Measure both on the cut parts, since surfaced stock is thinner than its name.',
        'Gauge: ask the lumber or hardware supplier which size suits a hardwood cleat of that thickness, and what pilot hole it needs. The screws hold the case to the base and carry none of its weight.',
      ],
      group: 'Screws',
    },
    {
      id: 'glue',
      name: 'Wood glue',
      quantity: 1,
      structural: false,
      notes: ['Enough for every panel glue-up and every dado joint.'],
      group: GROUP,
    },
    {
      id: 'finish',
      name: 'Finish',
      quantity: 1,
      structural: false,
      notes: [
        'Choose it with an experienced builder, and follow its instructions for ventilation.',
      ],
      group: GROUP,
    },
  ];
  return {
    ok: true,
    output: {
      params,
      geometry: g,
      parts,
      placements: made.placements,
      operations,
      hardware,
      hardwareNotes: [
        g.door
          ? 'Every joint is glued but the case bottom, which is screwed to the base through slotted holes so it can move, and the door panels, which float in their frames.'
          : 'Every joint is glued but the case bottom, which is screwed to the base through slotted holes so it can move.',
        ...(g.door
          ? [
              'To put a door in, lift it up into the top track, swing its bottom in, and drop it into the bottom track: the left door in the front track and the right door in the back one.',
            ]
          : []),
      ],
    },
  };
}

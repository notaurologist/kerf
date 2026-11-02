import { z } from 'zod';
import { withLetters } from '../../model/letters.ts';
import { cutAndDrillOperations, Operation } from '../../model/operations.ts';
import { type GenerateResult, HardwareItem, Part, Placement } from '../../model/types.ts';
import { CabinetGeometry, cabinetGeometry, validate } from './geometry.ts';
import { RecordCabinetParams } from './params.ts';
import { cabinetParts } from './parts.ts';
import type { Slot } from './structural.ts';

// The record cabinet's design from its parameters (docs/templates/record-cabinet.md): geometry,
// parts in cut-list order, placements, operations, and hardware. Pure.

export const TEMPLATE_ID = 'record-cabinet';
export const TEMPLATE_VERSION = 8;

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
  /** How much longer each slot under the case bottom is than its round hole, and why. */
  slot: Slot,
): GenerateResult<CabinetDesign> {
  const g = cabinetGeometry(params);
  const issues = validate(params, g);
  if (issues.length > 0) return { ok: false, issues };
  const made = cabinetParts(params, g, slot);
  if (!made.ok) return made;
  const parts = withLetters(made.parts);
  const all = parts.map((part) => part.id);
  const has = (ids: readonly string[]) => all.filter((id) => ids.includes(id));
  const baseParts = has(['leg', 'apron-long', 'apron-short']);
  const caseParts = has(['bottom', 'side-left', 'side-right', 'partition', 'rail']);
  // The top sits in dadoes on the sides and partitions only.
  const topJoins = has(['top', 'side-left', 'side-right', 'partition']);
  const screws = parts.flatMap((part) => (part.screwHoles ?? []).map(() => part.quantity));
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
        'Long enough to pass through a cleat and about two-thirds of the way into the case bottom, but not out its top. Confirm the size with an experienced builder.',
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
        'Every joint is glued but the case bottom, which is screwed to the base through slotted holes so it can move.',
      ],
    },
  };
}

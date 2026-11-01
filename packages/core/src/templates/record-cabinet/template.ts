import { z } from 'zod';
import { withLetters } from '../../model/letters.ts';
import { cutAndDrillOperations, Operation } from '../../model/operations.ts';
import { type GenerateResult, HardwareItem, Part, Placement } from '../../model/types.ts';
import { CabinetGeometry, cabinetGeometry, validate } from './geometry.ts';
import { RecordCabinetParams } from './params.ts';
import { cabinetParts } from './parts.ts';

// The record cabinet's design from its parameters (docs/templates/record-cabinet.md): geometry,
// parts in cut-list order, placements, operations, and hardware. Pure.

export const TEMPLATE_ID = 'record-cabinet';
export const TEMPLATE_VERSION = 6;

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

export function generate(params: RecordCabinetParams): GenerateResult<CabinetDesign> {
  const g = cabinetGeometry(params);
  const issues = validate(params, g);
  if (issues.length > 0) return { ok: false, issues };
  const made = cabinetParts(params, g);
  if (!made.ok) return made;
  const parts = withLetters(made.parts);
  const all = parts.map((part) => part.id);
  const caseParts = all.filter((id) => id !== 'top');
  // The top sits in dadoes on the sides and partitions only.
  const topJoins = all.filter((id) => id === 'top' || id.startsWith('side') || id === 'partition');
  // Clamps reach across the case, side to side, and from the top down to the sides' bottom ends.
  const operations = [
    ...cutAndDrillOperations(parts, []),
    { id: 'case/dry-fit', type: 'dry-fit', count: 1, partIds: all, reach: g.caseWidth },
    { id: 'case/glue', type: 'glue-assembly', count: 1, partIds: caseParts, reach: g.caseWidth },
    { id: 'top/glue', type: 'glue-assembly', count: 1, partIds: topJoins, reach: params.height },
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
      hardwareNotes: ['No metal fasteners: every joint is glued.'],
    },
  };
}

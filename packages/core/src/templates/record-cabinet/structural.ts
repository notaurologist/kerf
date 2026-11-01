import { z } from 'zod';
import { WOOD_SPECIES } from '../../design-values/woodSpecies.ts';
import { ChecklistItem, Flag } from '../../model/types.ts';
import { MovementResult, RingOrientation, woodMovement } from '../../movement/movement.ts';
import { BeamChecks } from '../../structural/checks.ts';
import { clearWoodChecks } from '../../structural/clearWood.ts';
import type { MissingInput, Needed, Quantity } from '../../structural/types.ts';
import { formatLength } from '../../units/length.ts';
import type { CabinetGeometry } from './geometry.ts';
import type { RecordCabinetParams } from './params.ts';

// The structural model (spec, Structural model): each bottom shelf under records, and the top under
// everything on it as one load at midspan (#331), deflection only (#288); each part's wood movement (#284); and the
// flags and checklist. Every load, the species, and the deflection limit are the owner's to enter.

const SPECIES_IDS = WOOD_SPECIES.map((s) => s.id) as [string, ...string[]];

export const RecordCabinetStructuralInputs = z.object({
  species: z.enum(SPECIES_IDS).optional(),
  orientation: RingOrientation.optional(),
  moisture: z
    .object({
      low: z.number().min(0).max(30),
      high: z.number().min(0).max(30),
    })
    .optional(),
  /** Pounds per foot of shelf, from weighing a run of the owner's records. */
  recordLoad: z.number().positive().optional(),
  /** Everything that stands on the top, in pounds. */
  topLoad: z.number().positive().optional(),
  /** L/N: the span divided by this is the deflection allowed. */
  deflectionLimit: z.number().positive().optional(),
});
export type RecordCabinetStructuralInputs = z.infer<typeof RecordCabinetStructuralInputs>;

export const STRUCTURAL_INPUT_LABELS = {
  species: 'Species',
  orientation: 'Ring orientation',
  moisture: 'Moisture content range in service',
  recordLoad: 'Records, pounds per foot of shelf',
  topLoad: 'Weight on the top',
  deflectionLimit: 'Deflection limit (span divided by)',
} as const satisfies Record<keyof RecordCabinetStructuralInputs, string>;

type Inputs = RecordCabinetStructuralInputs;

function need<K extends keyof Inputs>(inputs: Inputs, key: K): Needed<NonNullable<Inputs[K]>> {
  const value = inputs[key];
  if (value === undefined) {
    const missing: MissingInput[] = [{ key, label: STRUCTURAL_INPUT_LABELS[key] }];
    return { missing };
  }
  return { value: value as NonNullable<Inputs[K]> };
}

export const RecordCabinetReview = z.object({
  shelf: BeamChecks,
  top: BeamChecks,
  movement: z.array(MovementResult),
  flags: z.array(Flag),
  checklist: z.array(ChecklistItem),
});
export type RecordCabinetReview = z.infer<typeof RecordCabinetReview>;

const concerns = (partIds: string[]) => ({ partIds, hardwareIds: [] });

export function structuralReview(
  p: RecordCabinetParams,
  g: CabinetGeometry,
  inputs: Inputs,
): RecordCabinetReview {
  const t = p.panelThickness;
  // Each span between the centerlines of the panels on either side (spec, Structural model).
  const span = g.bayWidth + t;
  const species = need(inputs, 'species');
  const limitRatio = need(inputs, 'deflectionLimit');
  const spanWorking: Quantity = {
    symbol: 'L',
    label: 'Span, between the centerlines of the panels on either side',
    value: span,
    unit: 'in',
    basis: 'b + t, from the template geometry',
  };
  const records = need(inputs, 'recordLoad');
  const shelf = clearWoodChecks({
    member: {
      subject: 'Bottom shelf',
      breadth: p.caseDepth,
      depth: t,
      sizeBasis: 'Panel size from the template',
      supportsX: [0, span],
    },
    species,
    creep: 'seasoned-dry',
    loadCase: {
      name: 'Records along the shelf, for years',
      longTerm:
        'value' in records
          ? {
              value: {
                points: [],
                uniform: { w: records.value / 12, label: 'Records, per inch of shelf' },
              },
            }
          : records,
      shortTerm: { points: [] },
      working: [spanWorking],
      assumptions: [
        'Records fill the shelf evenly, end to end.',
        'Taking the span to the panel centerlines, where the shelf really bears in a dado, overstates it slightly.',
      ],
      limitRatio,
    },
    assumptions: [
      'The shelf is a simply supported span; the dadoes hold its ends but are taken as pinned.',
    ],
  });
  const onTop = (subject: string, weight: Needed<number>, label: string) =>
    clearWoodChecks({
      member: {
        subject,
        breadth: g.topDepth,
        depth: t,
        sizeBasis: 'Panel size from the template',
        supportsX: [0, span],
      },
      species,
      creep: 'seasoned-dry',
      loadCase: {
        name: `${label} at the middle of a span, for years`,
        longTerm:
          'value' in weight
            ? { value: { points: [{ x: span / 2, P: weight.value, label }] } }
            : weight,
        shortTerm: { points: [] },
        working: [spanWorking],
        assumptions: [
          'All of it sits at the middle of one span, where the top deflects most; spread out, it deflects the top less.',
          'The top is continuous over the partitions; taking each span as simply supported overstates its deflection.',
        ],
        limitRatio,
      },
      assumptions: [],
    });
  const top = onTop('Top', need(inputs, 'topLoad'), 'Everything on the top');

  // Wood movement across each part's grain (#284): its width is what moves.
  const orientation = need(inputs, 'orientation');
  const moisture = need(inputs, 'moisture');
  const moves = (subject: string, width: number) =>
    woodMovement({ subject, width, species, orientation, moisture });
  const movement = [
    moves('Top', g.topDepth),
    moves('Left and right sides', p.caseDepth),
    ...(p.bays > 1 ? [moves('Partition', p.caseDepth)] : []),
    moves('Bottom shelf', p.caseDepth),
    moves('Back rail', p.railHeight),
  ];

  const panels = ['side-left', 'side-right', 'partition'];
  const flags: Flag[] = [
    {
      category: 'load-bearing',
      ask: `Ask an experienced builder whether ${formatLength(g.partitionLeft)} of wood between each partition's back-to-back dadoes holds the shelves.`,
      why: `Dadoes ${formatLength(p.dadoDepth)} deep on both faces of a ${formatLength(t)} partition leave ${formatLength(g.partitionLeft)} between them, and no source gives a limit.`,
      ...concerns(['partition']),
    },
    {
      category: 'wood-movement',
      ask: 'Ask an experienced builder whether the back rails, glued into dadoes with their grain across the sides’ grain, will let the sides move.',
      why: 'The sides move front to back with the seasons; a rail glued across them resists it at the back corners. The Wood Movement section estimates how much.',
      ...concerns(['rail', ...panels]),
    },
    {
      category: 'load-bearing',
      ask: 'Ask an experienced builder to look over the shelves under a full load of records, and the top under everything that stands on it.',
      why: 'Records are heavy and stay for years, and Kerf computes only the shelves’ and top’s sag.',
      ...concerns(['shelf', 'top']),
    },
  ];
  const checklist: ChecklistItem[] = [
    {
      category: 'racking',
      element: 'Open back, with back rails',
      confirm:
        'Confirm with an experienced builder that the dadoes and back rails keep the case square under a sideways push.',
      why: 'An open back has no panel to stop the case racking.',
      ...concerns(['rail', ...panels]),
    },
    {
      category: 'tipping-and-anchoring',
      element: 'The loaded cabinet',
      confirm:
        'Confirm whether the cabinet, loaded with records and with everything on the top, can tip forward.',
      why: 'It is low and deep, but a heavy top load and a pull on the front can still tip a cabinet.',
      ...concerns([]),
    },
    {
      category: 'check-assumptions',
      element: 'Glued dadoes',
      confirm:
        'Confirm with an experienced builder how strong the glued dado joints are for this load.',
      why: 'Kerf does not compute joint strength.',
      ...concerns(['shelf', ...panels]),
    },
    {
      category: 'check-assumptions',
      element: 'Bending and shear of the shelves and top',
      confirm: 'Confirm the shelves and top are strong enough, not only stiff enough.',
      why: 'There are no published design values for furniture lumber, so Kerf checks only deflection.',
      ...concerns(['shelf', 'top']),
    },
  ];
  return {
    shelf,
    top,
    movement,
    flags,
    checklist,
  };
}

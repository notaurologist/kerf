import { z } from 'zod';
import { WOOD_SPECIES, woodSpecies } from '../../design-values/woodSpecies.ts';
import type { FieldRef } from '../../model/form.ts';
import { ChecklistItem, Flag } from '../../model/types.ts';
import { MovementResult, RingOrientation, woodMovement } from '../../movement/movement.ts';
import { BeamChecks } from '../../structural/checks.ts';
import { clearWoodChecks } from '../../structural/clearWood.ts';
import { mapNeeded, type Needed, need, type Quantity } from '../../structural/types.ts';
import { formatLength } from '../../units/length.ts';
import type { CabinetGeometry } from './geometry.ts';
import type { RecordCabinetParams } from './params.ts';

// The structural model (spec, Structural model): the case bottom under records in each bay, the
// front and back aprons under records and the top's load, and the top under everything on it as one
// load at midspan (#331), deflection only (#288); each part's wood movement (#284); and the flags
// and checklist. Every load, the species, and the deflection limit are the owner's to enter.

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
  /** Pounds per foot of records, from weighing a run of the owner's records. */
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
  recordLoad: 'Records, pounds per foot',
  topLoad: 'Weight on the top',
  deflectionLimit: 'Deflection limit (span divided by)',
} as const satisfies Record<keyof RecordCabinetStructuralInputs, string>;

type Inputs = RecordCabinetStructuralInputs;

/** How much longer each slot under the case bottom is than its round hole, and why (#338). */
interface Slot {
  length: number;
  basis: string;
}

/** The movement allowances the parts are cut to: the case bottom's slots and the door panels' gap. */
export interface Allowances {
  slot: Slot;
  /** The gap at each edge of a door's panel, across its grain, and why (#339). */
  panelGap: Slot;
}

/**
 * A part's movement across `width`, ΔD = D · C · (M_high − M_low) (DOMAIN.md, Joints that let wood
 * move). Without the species, ring orientation, and moisture range, it is sized for the species in
 * Kerf that moves most across a flatsawn face, over the Handbook's 6% to 10% for individual pieces
 * indoors (Table 13-2), and `entered` is false.
 */
function movementAcross(width: number, inputs: Inputs): { deltaD: number; entered: boolean } {
  const species = inputs.species ? woodSpecies(inputs.species) : undefined;
  const m = inputs.moisture;
  if (species && inputs.orientation && m && m.low >= 6 && m.high <= 14 && m.low < m.high) {
    const C =
      inputs.orientation === 'quartersawn'
        ? species.dimensionalChange.radial
        : species.dimensionalChange.tangential;
    return { deltaD: width * C * (m.high - m.low), entered: true };
  }
  const C = Math.max(...WOOD_SPECIES.map((w) => w.dimensionalChange.tangential));
  return { deltaD: width * C * (10 - 6), entered: false };
}

const notEntered = (what: string) =>
  `sized for the species in Kerf that moves most, over 6% to 10% moisture, since the species and moisture range are not entered yet. Entering them sizes ${what} for your wood.`;

/** The case bottom's movement front to back, plus 1/16" (spec, The Shaker-modern base). */
function slotFor(p: RecordCabinetParams, inputs: Inputs): Slot {
  const D = p.caseDepth;
  const { deltaD, entered } = movementAcross(D, inputs);
  const length = deltaD + SLOT_MARGIN;
  return {
    length,
    basis: entered
      ? `Each slot is ${formatLength(length)} longer than its round hole: the case bottom's movement across its ${formatLength(D)} depth, from the species and moisture range, plus 1/16".`
      : `Each slot is ${formatLength(length)} longer than its round hole, ${notEntered('the slots')}`,
  };
}

/**
 * Each door panel's gap at its edges across the grain: half its movement across the space between
 * the groove bottoms, plus 1/32" (DOMAIN.md, Joints that let wood move; spec, Sliding doors).
 */
function panelGapFor(g: CabinetGeometry, inputs: Inputs): Slot {
  const span = g.door?.panelSpan ?? 0;
  const { deltaD, entered } = movementAcross(span, inputs);
  const length = deltaD / 2 + PANEL_MARGIN;
  return {
    length,
    basis: entered
      ? `It floats in its grooves, unglued, with ${formatLength(length)} at each edge across its grain: half its movement across ${formatLength(span)}, from the species and moisture range, plus 1/32".`
      : `It floats in its grooves, unglued, with ${formatLength(length)} at each edge across its grain, ${notEntered('the gap')}`,
  };
}

/** The case bottom's slots and the door panels' gaps, from the inputs. */
export function allowancesFor(
  p: RecordCabinetParams,
  g: CabinetGeometry,
  inputs: Inputs,
): Allowances {
  return { slot: slotFor(p, inputs), panelGap: panelGapFor(g, inputs) };
}

/** Slack beyond the computed movement, a rule of thumb (DOMAIN.md, Joints that let wood move). */
const SLOT_MARGIN = 1 / 16;
/** A panel's margin at each edge beyond half its movement (DOMAIN.md, Joints that let wood move). */
const PANEL_MARGIN = 1 / 32;

export const RecordCabinetReview = z.object({
  /** Missing from plans made before template version 18, which did not check it. */
  bottom: BeamChecks.optional(),
  apron: BeamChecks,
  top: BeamChecks,
  movement: z.array(MovementResult),
  flags: z.array(Flag),
  checklist: z.array(ChecklistItem),
});
export type RecordCabinetReview = z.infer<typeof RecordCabinetReview>;

const concerns = (partIds: string[]) => ({ partIds, hardwareIds: [] });

/** The members checked, by the subject their checks name. */
const BOTTOM = 'Case bottom, in each bay';
const APRON = 'Front and back aprons';
const TOP = 'Top';

const params = (...paths: string[]) => paths.map((path): FieldRef => ({ from: 'params', path }));
const inputs = (...paths: (keyof typeof STRUCTURAL_INPUT_LABELS)[]) =>
  paths.map((path): FieldRef => ({ from: 'structuralInputs', path }));

/**
 * The fields each check changes with (`TemplateDefinition.checkFields`): the member's size and
 * span, then the inputs its wood and loads come from. An apron spans between the legs and carries
 * the records along every bay and everything on the top; the top spans one bay.
 */
export function checkFields(check: { subject: string }): FieldRef[] {
  const span = params('width', 'endOverhang', 'bays', 'panelThickness');
  if (check.subject === BOTTOM) {
    return [...span, ...params('caseDepth'), ...inputs('species', 'recordLoad', 'deflectionLimit')];
  }
  if (check.subject === APRON) {
    return [
      ...params('apronHeight', 'board.source', 'board.thickness', 'board.surfaced'),
      ...span,
      ...params('legStock.size'),
      ...inputs('species', 'recordLoad', 'topLoad', 'deflectionLimit'),
    ];
  }
  if (check.subject === TOP) {
    return [
      ...span,
      ...params('caseDepth', 'frontOverhang'),
      ...inputs('species', 'topLoad', 'deflectionLimit'),
    ];
  }
  return [];
}

export function structuralReview(
  p: RecordCabinetParams,
  g: CabinetGeometry,
  inputs: Inputs,
): RecordCabinetReview {
  const t = p.panelThickness;
  // Each span between the centerlines of the panels on either side (spec, Structural model).
  const span = g.bayWidth + t;
  const species = mapNeeded(need(inputs, STRUCTURAL_INPUT_LABELS, 'species'), (v) => v.species);
  const limitRatio = mapNeeded(
    need(inputs, STRUCTURAL_INPUT_LABELS, 'deflectionLimit'),
    (v) => v.deflectionLimit,
  );
  const spanWorking: Quantity = {
    symbol: 'L',
    label: 'Span, between the centerlines of the panels on either side',
    value: span,
    unit: 'in',
    basis: 'b + t, from the template geometry',
  };
  const records = mapNeeded(
    need(inputs, STRUCTURAL_INPUT_LABELS, 'recordLoad'),
    (v) => v.recordLoad,
  );
  const topLoad = mapNeeded(need(inputs, STRUCTURAL_INPUT_LABELS, 'topLoad'), (v) => v.topLoad);
  // The case bottom in each bay, along its grain between the panels standing on it, as the bottom
  // shelves were (spec, Structural model).
  const bottom = clearWoodChecks({
    member: {
      subject: BOTTOM,
      breadth: p.caseDepth,
      depth: t,
      sizeBasis: 'Panel size from the template',
      supportsX: [0, span],
    },
    species,
    creep: 'seasoned-dry',
    loadCase: {
      name: 'Records along the bay, for years',
      longTerm:
        'value' in records
          ? {
              value: {
                points: [],
                uniform: { w: records.value / 12, label: 'Records, per inch of bay' },
              },
            }
          : records,
      shortTerm: { points: [] },
      working: [spanWorking],
      assumptions: [
        'Records fill the bay evenly, end to end.',
        'Taking the span to the panel centerlines, where the case bottom really bears under each panel, overstates it slightly.',
        'The front and back aprons under its edges also carry it; taking it as spanning only along its grain, between the panels, overstates its sag.',
      ],
      limitRatio,
      limitKey: 'deflectionLimit',
    },
    assumptions: [
      'Each bay of the case bottom is a simply supported span between the panels on either side, which stand on it over the aprons; the dadoes hold it but are taken as pinned.',
    ],
  });
  // Each front and back apron between the legs (spec, The Shaker-modern base), carrying half of
  // the records along every bay and everything on the top, spread along it.
  const L = g.caseWidth - 2 * p.legStock.size;
  const ta = p.board.source === 'store' ? p.board.thickness : p.board.surfaced;
  const recordLength = p.bays * g.bayWidth;
  const apronLoad: Needed<{ points: []; uniform: { w: number; label: string } }> =
    'value' in records && 'value' in topLoad
      ? {
          value: {
            points: [],
            uniform: {
              w: ((records.value / 12) * recordLength + topLoad.value) / L / 2,
              label: 'Half of the records and of everything on the top, per inch of apron',
            },
          },
        }
      : { missing: [records, topLoad].flatMap((n) => ('missing' in n ? n.missing : [])) };
  const apron = clearWoodChecks({
    member: {
      subject: APRON,
      breadth: ta,
      depth: p.apronHeight,
      sizeBasis: 'One board, as thick as the board stock, from the template',
      supportsX: [0, L],
    },
    species,
    creep: 'seasoned-dry',
    loadCase: {
      name: 'Records and everything on the top, for years',
      longTerm: apronLoad,
      shortTerm: { points: [] },
      working: [
        {
          symbol: 'L',
          label: 'Span, between the legs',
          value: L,
          unit: 'in',
          basis: 'W_c − 2s, from the template geometry',
        },
        {
          symbol: 'n·b',
          label: 'Length of records, along every bay',
          value: recordLength,
          unit: 'in',
          basis: 'From the template geometry',
        },
      ],
      assumptions: [
        'Records fill every bay, and the case bottom carries their weight and everything on the top to the front and back aprons equally.',
        'Taking the apron alone ignores the case bottom and sides above it, which stiffen it, so this overstates the sag.',
      ],
      limitRatio,
      limitKey: 'deflectionLimit',
    },
    assumptions: [
      'Each apron is a simply supported span between its legs; the mortises and tenons hold its ends but are taken as pinned.',
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
        limitKey: 'deflectionLimit',
      },
      assumptions: [],
    });
  const top = onTop(
    TOP,
    mapNeeded(need(inputs, STRUCTURAL_INPUT_LABELS, 'topLoad'), (v) => v.topLoad),
    'Everything on the top',
  );

  // Wood movement across each part's grain (#284): its width is what moves.
  const orientation = mapNeeded(
    need(inputs, STRUCTURAL_INPUT_LABELS, 'orientation'),
    (v) => v.orientation,
  );
  const moisture = mapNeeded(need(inputs, STRUCTURAL_INPUT_LABELS, 'moisture'), (v) => v.moisture);
  const moves = (subject: string, width: number) =>
    woodMovement({ subject, width, species, orientation, moisture, moistureKey: 'moisture' });
  const movement = [
    moves('Top', g.topDepth),
    moves('Left and right sides', p.caseDepth),
    ...(p.bays > 1 ? [moves('Partition', g.door?.partitionDepth ?? p.caseDepth)] : []),
    moves('Case bottom', p.caseDepth),
    moves('Back rail', p.railHeight),
    // Across the space it floats in, which its gaps are sized from.
    ...(g.door ? [moves('Door panel', g.door.panelSpan)] : []),
  ];

  const panels = ['side-left', 'side-right', 'partition'];
  const flags: Flag[] = [
    {
      category: 'load-bearing',
      ask: `Ask an experienced builder whether ${formatLength(g.partitionLeft)} of wood between each partition's back-to-back dadoes holds the back rails.`,
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
      ask: 'Ask an experienced builder to look over the base under a full load of records, and the top under everything that stands on it.',
      why: 'Records are heavy and stay for years, and Kerf computes only the case bottom’s, the long aprons’, and the top’s sag.',
      ...concerns(['bottom', 'apron-long', 'leg', 'top']),
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
      ...concerns(['leg']),
    },
    {
      category: 'racking',
      element: 'The base: legs and aprons',
      confirm:
        'Confirm with an experienced builder that the mortise-and-tenon joints keep the base square and steady under a sideways push.',
      why: 'Short legs and aprons are a common, proven base, but Kerf does not compute joint strength.',
      ...concerns(['leg', 'apron-long', 'apron-short']),
    },
    {
      category: 'check-assumptions',
      element: 'Glued dadoes',
      confirm:
        'Confirm with an experienced builder how strong the glued dado joints are for this load.',
      why: 'Kerf does not compute joint strength.',
      ...concerns(['bottom', ...panels]),
    },
    {
      category: 'check-assumptions',
      element: 'Bending and shear of the aprons and top',
      confirm: 'Confirm the case bottom, aprons, and top are strong enough, not only stiff enough.',
      why: 'There are no published design values for furniture lumber, so Kerf checks only deflection.',
      ...concerns(['bottom', 'apron-long', 'top']),
    },
  ];
  return {
    bottom,
    apron,
    top,
    movement,
    flags,
    checklist,
  };
}

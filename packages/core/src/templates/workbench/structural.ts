import { z } from 'zod';
import { WOOD_SPECIES, woodSpecies } from '../../design-values/woodSpecies.ts';
import type { FieldRef } from '../../model/form.ts';
import { ChecklistItem, Flag } from '../../model/types.ts';
import { MovementResult, RingOrientation, woodMovement } from '../../movement/movement.ts';
import { BeamChecks } from '../../structural/checks.ts';
import { clearWoodChecks } from '../../structural/clearWood.ts';
import { mapNeeded, need } from '../../structural/types.ts';
import { formatLength } from '../../units/length.ts';
import { base, type Gaps, ILLUSTRATIVE } from './design.ts';
import type { WorkbenchParams } from './params.ts';

// The workbench's structural review (docs/templates/workbench.md, Structural model): the top's
// deflection under one load at the middle of its span, the movement estimates, the room each
// movement joint leaves, sized from them, and the flags and checklist. Every load, the species,
// and the limit are the owner's (hard rule 3).

const SPECIES_IDS = WOOD_SPECIES.map((s) => s.id) as [string, ...string[]];

export const WorkbenchStructuralInputs = z.object({
  species: z.enum(SPECIES_IDS).optional(),
  orientation: RingOrientation.optional(),
  moisture: z
    .object({
      low: z.number().min(0).max(30),
      high: z.number().min(0).max(30),
    })
    .optional(),
  /** What the owner puts on the bench, in pounds, taken at the middle of the top's span. */
  topLoad: z.number().positive().optional(),
  /** L/N: the span divided by this is the deflection allowed. */
  deflectionLimit: z.number().positive().optional(),
});
export type WorkbenchStructuralInputs = z.infer<typeof WorkbenchStructuralInputs>;

export const STRUCTURAL_INPUT_LABELS = {
  species: 'Species',
  orientation: 'Ring orientation',
  moisture: 'Moisture content range in service',
  topLoad: 'Weight on the top',
  deflectionLimit: 'Deflection limit (span divided by)',
} as const satisfies Record<keyof WorkbenchStructuralInputs, string>;

type Inputs = WorkbenchStructuralInputs;

/** Slack beyond the computed movement, as for a slot (DOMAIN.md, Joints that let wood move). */
const ROOM_MARGIN = 1 / 16;
/** A floating panel's margin at each edge beyond its movement there (DOMAIN.md). */
const PANEL_MARGIN = 1 / 32;

/**
 * Movement across `width`, ΔD = D · C · (M_high − M_low). Without the species, ring orientation,
 * and moisture range, sized for the species in Kerf that moves most across a flatsawn face over
 * the Wood Handbook's 6% to 10% indoors (Table 13-2).
 */
function movementAcross(width: number, inputs: Inputs): number {
  const species = inputs.species ? woodSpecies(inputs.species) : undefined;
  const m = inputs.moisture;
  if (species && inputs.orientation && m && m.low >= 6 && m.high <= 14 && m.low < m.high) {
    const C =
      inputs.orientation === 'quartersawn'
        ? species.dimensionalChange.radial
        : species.dimensionalChange.tangential;
    return width * C * (m.high - m.low);
  }
  const C = Math.max(...WOOD_SPECIES.map((w) => w.dimensionalChange.tangential));
  return width * C * (10 - 6);
}

/**
 * Each movement joint's room, from the spans the design measured:
 * - the back legs' mortises in the top, left long by the top's movement between the tenons plus
 *   1/16, since the front tenons hold it;
 * - the case back and each door panel, floating both ways, half their movement plus 1/32 at each
 *   edge;
 * - each drawer bottom, held at the back by its screw, all its movement plus 1/32 at the front.
 */
function gapsFor(
  spans: { tenons: number; back: number; bottom: number; doorPanel: number },
  inputs: Inputs,
): Gaps {
  const move = (width: number) => movementAcross(width, inputs);
  return {
    topRoom: move(spans.tenons) + ROOM_MARGIN,
    backEdge: move(spans.back) / 2 + PANEL_MARGIN,
    bottomFront: move(spans.bottom) + PANEL_MARGIN,
    doorPanelEdge: move(spans.doorPanel) / 2 + PANEL_MARGIN,
  };
}

export const WorkbenchReview = z.object({
  /** The room each movement joint leaves, as the parts are cut. */
  gaps: z.object({
    topRoom: z.number(),
    backEdge: z.number(),
    bottomFront: z.number(),
    doorPanelEdge: z.number(),
  }),
  top: BeamChecks,
  movement: z.array(MovementResult),
  flags: z.array(Flag),
  checklist: z.array(ChecklistItem),
});
export type WorkbenchReview = z.infer<typeof WorkbenchReview>;

const TOP = 'Top';

const params = (...paths: string[]) => paths.map((path): FieldRef => ({ from: 'params', path }));
const inputs = (...paths: (keyof typeof STRUCTURAL_INPUT_LABELS)[]) =>
  paths.map((path): FieldRef => ({ from: 'structuralInputs', path }));

/** The fields the top's check changes with: its size and span, then its wood and load. */
export function checkFields(check: { subject: string }): FieldRef[] {
  if (check.subject !== TOP) return [];
  return [
    ...params('topLength', 'overhangEnds', 'legSize', 'topDepth', 'topThickness'),
    ...inputs('species', 'topLoad', 'deflectionLimit'),
  ];
}

const concerns = (partIds: string[], hardwareIds: string[] = []) => ({ partIds, hardwareIds });

/**
 * The bench sized for the owner's wood: built once to measure the spans the movement joints
 * cross, which the gaps do not change, then again with the gaps sized for them. Then the top's
 * deflection, each part's movement, and the flags and checklist.
 */
export function workbench(p: WorkbenchParams, structuralInputs: Inputs) {
  const first = base(p, ILLUSTRATIVE);
  if (!first.ok) return first;
  const gaps = gapsFor(first.base.geometry.spans, structuralInputs);
  const made = base(p, gaps);
  if (!made.ok) return made;
  const g = made.base.geometry;

  const species = mapNeeded(
    need(structuralInputs, STRUCTURAL_INPUT_LABELS, 'species'),
    (v) => v.species,
  );
  const limitRatio = mapNeeded(
    need(structuralInputs, STRUCTURAL_INPUT_LABELS, 'deflectionLimit'),
    (v) => v.deflectionLimit,
  );
  const weight = mapNeeded(
    need(structuralInputs, STRUCTURAL_INPUT_LABELS, 'topLoad'),
    (v) => v.topLoad,
  );
  // Between the end frames' leg centerlines.
  const span = g.baseLength - p.legSize;
  const top = clearWoodChecks({
    member: {
      subject: TOP,
      breadth: p.topDepth,
      depth: p.topThickness,
      sizeBasis: 'Strips glued on edge, from the template',
      supportsX: [0, span],
    },
    species,
    creep: 'seasoned-dry',
    loadCase: {
      name: 'Everything on the bench at the middle of its span, for years',
      longTerm:
        'value' in weight
          ? { value: { points: [{ x: span / 2, P: weight.value, label: 'Weight on the top' }] } }
          : weight,
      shortTerm: { points: [] },
      working: [
        {
          symbol: 'L',
          label: "Span between the end frames' leg centerlines",
          value: span,
          unit: 'in',
          basis: 'L − 2·o_e − s, from the template geometry',
        },
      ],
      assumptions: [
        'All of it sits at the middle of the span, where the top bends most.',
        'The top runs past the legs and is held by their tenons; taking it as simply supported overstates its deflection.',
        'The dog holes and the mortises take a little out of the section and are left out, which understates it slightly.',
      ],
      limitRatio,
      limitKey: 'deflectionLimit',
    },
    assumptions: [],
  });

  const orientation = mapNeeded(
    need(structuralInputs, STRUCTURAL_INPUT_LABELS, 'orientation'),
    (v) => v.orientation,
  );
  const moisture = mapNeeded(
    need(structuralInputs, STRUCTURAL_INPUT_LABELS, 'moisture'),
    (v) => v.moisture,
  );
  const moves = (subject: string, width: number) =>
    woodMovement({ subject, width, species, orientation, moisture, moistureKey: 'moisture' });

  const legs = ['leg-vise', 'leg-a', 'leg-b'];
  const drawers = ['upper', 'lower'].flatMap((row) =>
    ['side-left', 'side-right'].map((side) => `${row}-drawer-${side}`),
  );
  const flags: Flag[] = [
    {
      category: 'wood-movement',
      ask: `Ask an experienced builder whether the back legs' mortises, ${formatLength(gaps.topRoom ?? 0)} longer toward the back, leave the top room to move against tenons glued at the front.`,
      why: `The top moves across its ${formatLength(p.topDepth)} depth with the seasons, and the legs' tenons go through it ${formatLength(g.spans.tenons)} apart. The Wood Movement section estimates how much.`,
      ...concerns(['top', ...legs]),
    },
    {
      category: 'load-bearing',
      ask: `Ask an experienced builder whether the ${formatLength(p.overhangEnds)} of top past the legs at each end carries heavy work there, such as chopping or work held in the end vise.`,
      why: 'Kerf computes only the top’s sag between the legs, not what it carries past them.',
      ...concerns(['top', 'vise-block', 'end-chop']),
    },
    {
      category: 'load-bearing',
      ask: 'Ask an experienced builder whether screws for the upper drawers’ slides, driven into both faces of the divider at the same height, will meet inside it.',
      why: `Screws longer than half the divider’s ${formatLength(p.caseThickness)} meet in the middle when the holes line up. Staggering the two slides’ holes, or shorter screws, avoids it.`,
      ...concerns(['divider']),
    },
  ];
  const checklist: ChecklistItem[] = [
    {
      category: 'racking',
      element: 'The base: legs, feet, and rails',
      confirm:
        'Confirm with an experienced builder that the glued mortises and tenons keep the base square and steady when planing pushes the top along and across.',
      why: 'Hand planing pushes hard on a bench, and Kerf does not compute joint strength.',
      ...concerns([...legs, 'foot', 'end-rail', 'low-rail']),
    },
    {
      category: 'tipping-and-anchoring',
      element: 'The bench with a vise open',
      confirm:
        'Confirm whether the bench can tip when planing at an end past the legs, or with work in an open vise.',
      why: 'The top runs past the legs at each end, and a vise holds work farther out still.',
      ...concerns(['top', 'foot', 'face-chop', 'end-chop']),
    },
    {
      category: 'check-assumptions',
      element: 'The through tenons and the back mortises',
      confirm:
        'Confirm with an experienced builder how much glue the front tenons through the top need, and that the back tenons stay unglued in their long mortises.',
      why: 'The top holds the frame together at its tenons, and gluing the back ones would stop it moving.',
      ...concerns(['top', ...legs]),
    },
    {
      category: 'check-assumptions',
      element: 'Glue lines in the top and legs',
      confirm:
        'Confirm with an experienced builder that the strips of the top and legs are glued well enough for heavy work.',
      why: 'Kerf does not compute the strength of glue lines.',
      ...concerns(['top', ...legs]),
    },
    {
      category: 'check-assumptions',
      element: 'Bending and shear of the top',
      confirm: 'Confirm the top is strong enough, not only stiff enough.',
      why: 'There are no published design values for furniture lumber, so Kerf checks only deflection.',
      ...concerns(['top']),
    },
    {
      category: 'check-assumptions',
      element: 'The drawer boxes',
      confirm:
        'Confirm with an experienced builder that the dovetailed boxes suit what goes in them.',
      why: 'Tools are heavy, and Kerf computes nothing for the drawers.',
      ...concerns(drawers),
    },
  ];

  return {
    ok: true as const,
    base: made.base,
    review: {
      gaps: { ...gaps, topRoom: gaps.topRoom ?? 0 },
      top,
      movement: [
        moves('Top, between its front and back tenons', g.spans.tenons),
        moves('Case back', g.spans.back),
        // No bottoms until the slides' figures size the boxes.
        ...(g.spans.bottom > 0 ? [moves('Drawer bottoms', g.spans.bottom)] : []),
        moves('Door panels', g.spans.doorPanel),
      ],
      flags,
      checklist,
    } satisfies WorkbenchReview,
  };
}

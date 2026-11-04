import { designValues, movement, structural } from '@kerf/core';
import { base, type Gaps, ILLUSTRATIVE } from './design.ts';
import type { WorkbenchParams } from './params.ts';

// The workbench's structural review (docs/templates/workbench.md, Structural model): the top's
// deflection under one load at the middle of its span, the movement estimates, and the room each
// movement joint leaves, sized from them. Every load, the species, and the limit are the owner's
// (hard rule 3).

/** The owner's wood and loads; each one left out makes what it feeds input needed. */
export interface WorkbenchInputs {
  species?: string;
  orientation?: 'flatsawn' | 'quartersawn' | 'unknown';
  moisture?: { low: number; high: number };
  /** What the owner puts on the bench, in pounds, taken at the middle of the top's span. */
  topLoad?: number;
  /** L/N: the span divided by this is the deflection allowed. */
  deflectionLimit?: number;
}

const LABELS = {
  species: 'Species',
  orientation: 'Ring orientation',
  moisture: 'Moisture content range in service',
  topLoad: 'Weight on the top',
  deflectionLimit: 'Deflection limit (span divided by)',
} as const satisfies Record<keyof WorkbenchInputs, string>;

/** Slack beyond the computed movement, as for a slot (DOMAIN.md, Joints that let wood move). */
const ROOM_MARGIN = 1 / 16;
/** A floating panel's margin at each edge beyond its movement there (DOMAIN.md). */
const PANEL_MARGIN = 1 / 32;

/**
 * Movement across `width`, ΔD = D · C · (M_high − M_low). Without the species, ring orientation,
 * and moisture range, sized for the species in Kerf that moves most across a flatsawn face over
 * the Wood Handbook's 6% to 10% indoors (Table 13-2), as Kerf's other furniture template does.
 */
function movementAcross(width: number, inputs: WorkbenchInputs): number {
  const species = inputs.species ? designValues.woodSpecies(inputs.species) : undefined;
  const m = inputs.moisture;
  if (species && inputs.orientation && m && m.low >= 6 && m.high <= 14 && m.low < m.high) {
    const C =
      inputs.orientation === 'quartersawn'
        ? species.dimensionalChange.radial
        : species.dimensionalChange.tangential;
    return width * C * (m.high - m.low);
  }
  const C = Math.max(...designValues.WOOD_SPECIES.map((w) => w.dimensionalChange.tangential));
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
  inputs: WorkbenchInputs,
): Gaps {
  const move = (width: number) => movementAcross(width, inputs);
  return {
    topRoom: move(spans.tenons) + ROOM_MARGIN,
    backEdge: move(spans.back) / 2 + PANEL_MARGIN,
    bottomFront: move(spans.bottom) + PANEL_MARGIN,
    doorPanelEdge: move(spans.doorPanel) / 2 + PANEL_MARGIN,
  };
}

/**
 * The bench sized for the owner's wood: built once to measure the spans the movement joints
 * cross, which the gaps do not change, then again with the gaps sized for them. Then the top's
 * deflection and each part's movement.
 */
export function workbench(p: WorkbenchParams, inputs: WorkbenchInputs) {
  const first = base(p, ILLUSTRATIVE);
  if (!first.ok) return first;
  const gaps = gapsFor(first.base.geometry.spans, inputs);
  const made = base(p, gaps);
  if (!made.ok) return made;
  const g = made.base.geometry;

  const species = structural.mapNeeded(
    structural.need(inputs, LABELS, 'species'),
    (v) => v.species,
  );
  const limitRatio = structural.mapNeeded(
    structural.need(inputs, LABELS, 'deflectionLimit'),
    (v) => v.deflectionLimit,
  );
  const weight = structural.mapNeeded(structural.need(inputs, LABELS, 'topLoad'), (v) => v.topLoad);
  // Between the end frames' leg centerlines.
  const span = g.baseLength - p.legSize;
  const top = structural.clearWoodChecks({
    member: {
      subject: 'Top',
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
          basis: 'From the template geometry',
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

  const orientation = structural.mapNeeded(
    structural.need(inputs, LABELS, 'orientation'),
    (v) => v.orientation,
  );
  const moisture = structural.mapNeeded(
    structural.need(inputs, LABELS, 'moisture'),
    (v) => v.moisture,
  );
  const moves = (subject: string, width: number) =>
    movement.woodMovement({
      subject,
      width,
      species,
      orientation,
      moisture,
      moistureKey: 'moisture',
    });
  return {
    ok: true as const,
    base: made.base,
    review: {
      gaps,
      deflection: top.deflection,
      movement: [
        moves('Top, between its front and back tenons', g.spans.tenons),
        moves('Case back', g.spans.back),
        moves('Drawer bottoms', g.spans.bottom),
        moves('Door panels', g.spans.doorPanel),
      ],
    },
  };
}

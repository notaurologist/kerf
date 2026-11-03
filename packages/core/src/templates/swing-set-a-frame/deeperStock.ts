import { NOMINAL_SIZES, type NominalSize, stock } from '../../lumber/stock.ts';
import type { CheckResult, OtherStock } from '../../structural/types.ts';
import type { SwingSetParams } from './params.ts';
import {
  type SwingSetStructuralInputs,
  type SwingSetStructuralReview,
  structuralReview,
} from './structural.ts';
import { generate } from './template.ts';

// The beam's bending check in the next deeper stock (spec, Structural model, Deeper stock): the
// owner chooses the stock against each one's break-even dynamic factor. Kerf does not choose it.

const PLIES = [1, 2, 3] as const;

interface BeamSize {
  beamStock: NominalSize;
  beamPlies: number;
}

/**
 * The beams the template can build at the smallest depth greater than this one's, no narrower
 * than it, narrowest first: a solid beam of any size, or two or three plies of a 2x size.
 */
export function deeperBeams(p: Pick<SwingSetParams, 'beamStock' | 'beamPlies'>): BeamSize[] {
  const now = stock(p.beamStock);
  const breadth = p.beamPlies * now.thickness;
  const sizes = NOMINAL_SIZES.flatMap((beamStock) => {
    const s = stock(beamStock);
    return PLIES.filter((n) => n === 1 || s.thickness === 1.5).map((beamPlies) => ({
      beamStock,
      beamPlies,
      depth: s.width,
      breadth: beamPlies * s.thickness,
    }));
  }).filter((s) => s.depth > now.width && s.breadth >= breadth);
  const next = Math.min(...sizes.map((s) => s.depth));
  return sizes
    .filter((s) => s.depth === next)
    .sort((a, b) => a.breadth - b.breadth || a.beamPlies - b.beamPlies)
    .map(({ beamStock, beamPlies }) => ({ beamStock, beamPlies }));
}

/** A check's result in another stock, when it has a break-even factor to compare. */
function otherStock(check: CheckResult): OtherStock[] {
  if (check.status === 'not-computed' || !check.breakEven) return [];
  return [
    {
      subject: check.subject,
      ...(check.status === 'computed' ? { margin: check.margin } : {}),
      breakEven: check.breakEven,
    },
  ];
}

/**
 * Adds the next deeper beams to the bending check, while it has a break-even factor. A size that
 * does not generate (its flush cut through the legs, say) or has no factor is left out.
 */
export function withDeeperStock(
  review: SwingSetStructuralReview,
  params: SwingSetParams,
  structuralInputs: SwingSetStructuralInputs,
): SwingSetStructuralReview {
  const bending = review.beam.bending;
  if (bending.status === 'not-computed' || !bending.breakEven) return review;
  const deeperStock = deeperBeams(params).flatMap((size) => {
    const design = generate({ ...params, ...size }, false);
    if (!design.ok) return [];
    const other = structuralReview(design.output, structuralInputs);
    return other.ok ? otherStock(other.review.beam.bending) : [];
  });
  return { ...review, beam: { ...review.beam, bending: { ...bending, deeperStock } } };
}

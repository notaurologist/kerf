import type { Citation } from '../design-values/sources.ts';
import type { SuggestionBasis } from '../model/questions.ts';
import type { Dovetails } from '../model/types.ts';

// Through dovetails (DOMAIN.md, Dovetails): where each tail's sides run across the boards' shared
// width, from one layout both boards record, and a suggested layout and slope with their bases.
// Generic: any template's corner can use them.

/** The layout fields a corner's two boards share. */
export type DovetailLayout = Pick<Dovetails, 'tails' | 'slope' | 'halfPin' | 'pin'>;

/**
 * The slope commonly used: 1:6 in softwood, 1:8 in hardwood. The reason given for the difference
 * is disputed: Fine Woodworking says softwood fibers compress more easily, and Wikipedia says the
 * slope does not change the joint's strength in either. A template suggests one with this basis.
 */
export const DOVETAIL_SLOPES = { softwood: 6, hardwood: 8 } as const;

export const DOVETAIL_SLOPE_SOURCES = [
  { source: 'wikipedia-dovetail-joint', locator: 'Methods' },
  { source: 'fww-laying-out-dovetails', locator: 'Anatomy of a strong joint' },
] as const satisfies readonly Citation[];

export const DOVETAIL_SLOPE_BASIS: SuggestionBasis = {
  kind: 'convention',
  name: 'dovetails slope 1:6 in softwood and 1:8 in hardwood (Wikipedia, Dovetail joint; Fine Woodworking, Laying Out Dovetails, 2007). Why the two differ is disputed: one says softwood compresses more, the other that the slope does not change the strength',
};

/**
 * Fine Woodworking's ranges, measured at a pin's narrow end: half pins 1/4" to 3/8", interior pins
 * 1/8" to 1/4", spaced 3/4" to 2" on center, with tails wider than pins.
 */
const RANGES = {
  halfPin: 3 / 8,
  pin: 1 / 4,
  widestSpacing: 2,
  closestSpacing: 3 / 4,
} as const;

export const DOVETAIL_LAYOUT_BASIS: SuggestionBasis = {
  kind: 'rule-of-thumb',
  rule: 'the fewest tails that keeps them no more than 2" apart on center, with 3/8" half pins and 1/4" pins at their narrow ends: the widest of the ranges Fine Woodworking gives (Laying Out Dovetails, 2007), so the tails are as wide as the ranges allow',
};

/**
 * One side of a tail, across the width (v, from the reference edge) at the tails' wide end, where
 * the tail board's end and the pin board's outside face are, and at their narrow end: the tail
 * board's baseline, or the pin board's inside face.
 */
export interface DovetailSide {
  outside: number;
  inside: number;
}

export interface DovetailGeometry {
  /** A tail's width at the end, where it is widest. */
  tailWide: number;
  /** A tail's width at the baseline, where it is narrowest. */
  tailNarrow: number;
  /** How far each side moves across the width over `run`: run / slope. */
  offset: number;
  /** Each tail's two sides, tail by tail from the reference edge. */
  sides: DovetailSide[];
}

/**
 * Where the tails' sides run, across a width `width`, over a run `run` from the wide end to the
 * narrow: the tail board's baseline, which is the pin board's thickness, either way. Along the wide
 * end: a half pin, then tail, pin, tail, ..., tail, and a half pin, so each tail is
 * (width − 2·halfPin − (tails − 1)·pin) / tails wide there. Each side moves run / slope toward the
 * tail's middle by the narrow end. Undefined when a tail would be no wider than nothing at either
 * end.
 */
export function dovetailGeometry(
  layout: DovetailLayout,
  width: number,
  run: number,
): DovetailGeometry | undefined {
  const { tails, slope, halfPin, pin } = layout;
  const tailWide = (width - 2 * halfPin - (tails - 1) * pin) / tails;
  const offset = run / slope;
  const tailNarrow = tailWide - 2 * offset;
  if (!(tailWide > 0 && tailNarrow > 0)) return undefined;
  const sides = Array.from({ length: tails }).flatMap((_, i) => {
    const left = halfPin + i * (tailWide + pin);
    return [
      { outside: left, inside: left + offset },
      { outside: left + tailWide, inside: left + tailWide - offset },
    ];
  });
  return { tailWide, tailNarrow, offset, sides };
}

/** Where a corner lies across a board `width` wide: its span, or the whole width. */
export function dovetailSpan(d: Pick<Dovetails, 'span'>, width: number) {
  return d.span ?? { v0: 0, v1: width };
}

/**
 * A corner's tails laid across its span on a board `width` wide, over a run `run`, with each side
 * measured from the board's reference edge. Undefined as `dovetailGeometry` is.
 */
export function cornerGeometry(
  d: Dovetails,
  width: number,
  run: number,
): DovetailGeometry | undefined {
  const { v0, v1 } = dovetailSpan(d, width);
  const g = dovetailGeometry(d, v1 - v0, run);
  if (!g) return undefined;
  const sides = g.sides.map((s) => ({ outside: v0 + s.outside, inside: v0 + s.inside }));
  return { ...g, sides };
}

/**
 * A layout for a corner `width` wide at slope 1:`slope` (DOVETAIL_LAYOUT_BASIS): 3/8" half pins,
 * 1/4" pins, and the fewest tails that keeps them 2" or less apart on center. Tails c apart on
 * center span (width − 2·halfPin + pin) / c. Undefined when even one tail would be closer than
 * 3/4", or would come to nothing at the baseline `run` in.
 */
export function suggestDovetailLayout(
  width: number,
  slope: number,
  run: number,
): DovetailLayout | undefined {
  const { halfPin, pin } = RANGES;
  const span = width - 2 * halfPin + pin;
  const tails = Math.max(1, Math.ceil(span / RANGES.widestSpacing - 1e-9));
  if (span / tails < RANGES.closestSpacing) return undefined;
  const layout = { tails, slope, halfPin, pin };
  return dovetailGeometry(layout, width, run) ? layout : undefined;
}

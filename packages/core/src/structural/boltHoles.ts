import { type Citation, SOURCE_LINKS } from '../design-values/sources.ts';

// The size of a bolt hole (#110): NDS 2024 12.1.3.2, "Holes shall be a minimum of 1/32" to a
// maximum of 1/16" larger than the bolt diameter." Verified against the AWC view-only copy of
// chapter 12 (dated 2026-09-11). Kerf drills 1/16" over, the end of the range that spade and auger
// bits, which come in sixteenths, can drill for any bolt sized in sixteenths.

export const BOLT_HOLE_OVERSIZE = {
  /** The range NDS allows, in inches over the bolt diameter. */
  min: 1 / 32,
  max: 1 / 16,
  /** What Kerf uses, within the range. */
  used: 1 / 16,
  citation: {
    source: 'nds-2024',
    locator: 'Section 12.1.3.2',
    url: SOURCE_LINKS.ndsChapter12,
  } satisfies Citation,
} as const;

/** The hole to drill for a bolt: its diameter plus the oversize Kerf uses. */
export function boltHoleDiameter(boltDiameter: number): number {
  return boltDiameter + BOLT_HOLE_OVERSIZE.used;
}

/** Whether a hole is within the range NDS allows for its bolt, to within rounding. */
export function holeWithinRange(holeDiameter: number, boltDiameter: number): boolean {
  const over = holeDiameter - boltDiameter;
  const eps = 1e-9;
  return over >= BOLT_HOLE_OVERSIZE.min - eps && over <= BOLT_HOLE_OVERSIZE.max + eps;
}

import { type Citation, SOURCE_LINKS } from './sources.ts';

// Density of wood from its specific gravity and moisture content, for member self-weight.
//
// Simpson (FPL-GTR-76, 1993), with G_b the basic specific gravity (oven-dry weight, green volume):
//   M ≥ 30%: D = 62.4 · G_b · (1 + M/100)                                  (Eq. 4)
//   M < 30%: D = 62.4 · G_b · (1 + M/100) / (1 − 0.265 · a · G_b),
//            a = (30 − M) / 30                                            (Eq. 6 to 9)
// Volumetric shrinkage from 30% to 0% is S_t = 0.265 · G_b (Eq. 8), so specific gravity on an
// oven-dry volume basis, G_0, is G_b / (1 − 0.265 · G_b), and G_b = G_0 / (1 + 0.265 · G_0).
// At M = 0 this gives D = 62.4 · G_0, as it must.
//
// The NDS Supplement 2024 (3.1.3) gives D = 62.4 · G / (1 + G · 0.009 · M) · (1 + M/100). It agrees
// with Simpson within 0.3% up to 30%, but above 30% it keeps reducing density as if the wood went
// on swelling, which wood does not do above the fiber saturation point (about 30%). Pressure-
// treated lumber is often sold above 30%, so Simpson's equations are used throughout.

/** Water, lb/ft³. */
const WATER = 62.4;
/** Fiber saturation point, percent moisture content. */
const FIBER_SATURATION = 30;

export const DENSITY_SOURCES: Citation[] = [
  { source: 'fpl-gtr-76', locator: 'Equations 4 and 6 to 9, pp. 1-3' },
  {
    source: 'nds-supplement-2024',
    locator: '3.1.3 density formula, p. 12 (corroborating up to 30% moisture content)',
    url: SOURCE_LINKS.supplementChapter3,
  },
];

/** Basic specific gravity (green volume) from specific gravity on an oven-dry volume basis. */
export function basicSpecificGravity(ovenDryG: number): number {
  return ovenDryG / (1 + 0.265 * ovenDryG);
}

/**
 * Density in lb/ft³ at moisture content M (percent, oven-dry weight basis), from specific gravity
 * on an oven-dry weight and volume basis (the basis of G in the NDS Supplement tables).
 */
export function woodDensity(ovenDryG: number, moistureContent: number): number {
  const Gb = basicSpecificGravity(ovenDryG);
  const M = moistureContent;
  const wet = WATER * Gb * (1 + M / 100);
  if (M >= FIBER_SATURATION) return wet;
  const a = (FIBER_SATURATION - M) / FIBER_SATURATION;
  return wet / (1 - 0.265 * a * Gb);
}

/** The NDS Supplement 3.1.3 formula, kept for comparison in tests. */
export function ndsSupplementDensity(G: number, moistureContent: number): number {
  return ((WATER * G) / (1 + G * 0.009 * moistureContent)) * (1 + moistureContent / 100);
}

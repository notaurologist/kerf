// What a wood member's torsion needs: its shear modulus G and its section's torsion constant.
//
// Source: Forest Products Laboratory, Wood Handbook: Wood as an Engineering Material, General
// Technical Report FPL-GTR-282 (2021), cited by table, figure, equation, and printed page.

/**
 * φ in K = J ≈ h·b³/φ (Eq. 9–11, p. 9–5), read from Figure 9–9 (p. 9–6) at b/h = 0, 0.1, … 1.0.
 * The figure is a curve with no table behind it in the Handbook. These values were read from the
 * page image at 1855 by 2400 pixels, measured against the figure's own tick marks; the curve is
 * about 0.03 of φ thick there, so each reading is good to about ±0.05. The curve starts at 3 at
 * b/h = 0 (a thin strip, J = h·b³/3).
 */
export const FIGURE_9_9_PHI = [3.0, 3.14, 3.38, 3.66, 3.97, 4.32, 4.73, 5.2, 5.73, 6.32, 6.97];

/**
 * The torsion constant of a solid rectangle, in⁴: K = J ≈ h·b³/φ (Wood Handbook Eq. 9–11, p. 9–5),
 * with h the larger side, b the smaller, and φ read from Figure 9–9 (p. 9–6) at b/h, interpolated
 * in a straight line between the readings above.
 */
export function torsionConstant(side1: number, side2: number): number {
  const h = Math.max(side1, side2);
  const b = Math.min(side1, side2);
  if (!(b > 0)) throw new Error('A rectangle needs two positive sides.');
  const r = (b / h) * 10;
  const i = Math.min(Math.floor(r), 9);
  const lo = FIGURE_9_9_PHI[i] as number;
  const hi = FIGURE_9_9_PHI[i + 1] as number;
  const phi = lo + (hi - lo) * (r - i);
  return (h * b ** 3) / phi;
}

/**
 * Elastic ratios for the species sold as Southern Pine that Table 5–1 lists (p. 5–2, at about 12%
 * moisture content): G_LR/E_L and G_LT/E_L. The Handbook names four major Southern Pine species,
 * longleaf, shortleaf, loblolly, and slash (Chapter 2, Pine, Southern Group, p. 2–15); Table 5–1
 * has no row for shortleaf. Eq. 9–9 (p. 9–5) takes G = √(G_LR·G_LT) for torsion.
 */
export const SOUTHERN_PINE_SHEAR_RATIOS = [
  { species: 'loblolly', glr: 0.082, glt: 0.081 },
  { species: 'longleaf', glr: 0.071, glt: 0.06 },
  { species: 'slash', glr: 0.055, glt: 0.053 },
] as const;

/** √(G_LR·G_LT)/E_L for one row of Table 5–1. */
export const shearRatio = (row: { glr: number; glt: number }) => Math.sqrt(row.glr * row.glt);

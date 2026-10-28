// Dimensional lumber: nominal names and actual dressed sizes in inches (DOMAIN.md, Lumber
// basics). Actual sizes are the standard dry dressed sizes for US softwood dimension lumber
// (American Softwood Lumber Standard, PS 20). Pressure-treated lumber is often sold wet and can
// measure slightly larger until it dries; cut lists use these values and say so.

export const STOCK_SIZES = {
  '2x4': { thickness: 1.5, width: 3.5 },
  '2x6': { thickness: 1.5, width: 5.5 },
  '2x8': { thickness: 1.5, width: 7.25 },
  '4x4': { thickness: 3.5, width: 3.5 },
  '4x6': { thickness: 3.5, width: 5.5 },
  '4x8': { thickness: 3.5, width: 7.25 },
  '6x6': { thickness: 5.5, width: 5.5 },
} as const satisfies Record<string, { thickness: number; width: number }>;

export type NominalSize = keyof typeof STOCK_SIZES;

export const NOMINAL_SIZES = Object.keys(STOCK_SIZES) as NominalSize[];

export interface Stock {
  nominal: NominalSize;
  /** Smaller actual dimension, inches. */
  thickness: number;
  /** Larger actual dimension, inches. */
  width: number;
}

export function stock(nominal: NominalSize): Stock {
  return { nominal, ...STOCK_SIZES[nominal] };
}

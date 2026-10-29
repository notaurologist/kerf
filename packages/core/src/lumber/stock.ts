import { z } from 'zod';
import { type Citation, SOURCE_LINKS } from '../design-values/sources.ts';

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

/** Where the dressed sizes come from. The Supplement's sizes conform to PS 20-20 (its 3.1). */
export const STOCK_SIZE_SOURCES = [
  {
    source: 'nds-supplement-2024',
    locator: 'Table 1B, Section Properties of Standard Dressed (S4S) Sawn Lumber, pp. 14-15',
    url: SOURCE_LINKS.supplementChapter3,
  },
] satisfies Citation[];

export type NominalSize = keyof typeof STOCK_SIZES;

export const NOMINAL_SIZES = Object.keys(STOCK_SIZES) as NominalSize[];

export const Stock = z.object({
  nominal: z.enum(NOMINAL_SIZES as [NominalSize, ...NominalSize[]]),
  /** Smaller actual dimension, inches. */
  thickness: z.number(),
  /** Larger actual dimension, inches. */
  width: z.number(),
});
export type Stock = z.infer<typeof Stock>;

export function stock(nominal: NominalSize): Stock {
  return { nominal, ...STOCK_SIZES[nominal] };
}

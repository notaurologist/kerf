import { z } from 'zod';
import { Citation } from './sources.ts';

// Properties of furniture species that are not graded under the NDS (DOMAIN.md, Wood movement).
// Dimensional change coefficients are transcribed from the Wood Handbook (2021), Table 13-5, and
// checked row by row against the printed table. Only the species the owner may build with are
// entered (October 2026).

const CHAPTER_13 = 'https://research.fs.usda.gov/treesearch/62261';

const DimensionalChange = z.object({
  /** C_R, per 1% moisture content, based on the dimension at 10%. Quartersawn width. */
  radial: z.number().positive(),
  /** C_T, per 1% moisture content, based on the dimension at 10%. Flatsawn width. */
  tangential: z.number().positive(),
  sources: z.array(Citation).min(1),
});

export const WoodSpecies = z.object({
  id: z.string().min(1),
  /** As printed in the source table, such as 'Cherry, black'. */
  name: z.string().min(1),
  dimensionalChange: DimensionalChange,
});
export type WoodSpecies = z.infer<typeof WoodSpecies>;

const TABLE_13_5: Citation[] = [
  { source: 'fpl-gtr-282', locator: 'Chapter 13, Table 13-5, p. 13-17', url: CHAPTER_13 },
];

function species(id: string, name: string, radial: number, tangential: number) {
  return { id, name, dimensionalChange: { radial, tangential, sources: TABLE_13_5 } };
}

export const WOOD_SPECIES = z
  .array(WoodSpecies)
  .parse([
    species('black-cherry', 'Cherry, black', 0.00126, 0.00248),
    species('black-walnut', 'Walnut, black', 0.0019, 0.00274),
    species('white-oak', 'White oak, white', 0.00194, 0.00376),
    species('northern-red-oak', 'Red oak, northern red', 0.00137, 0.00304),
    species('sugar-maple', 'Maple, sugar', 0.00165, 0.00353),
    species('yellow-poplar', 'Poplar, yellow', 0.00158, 0.00289),
  ]);

export function woodSpecies(id: string): WoodSpecies | undefined {
  return WOOD_SPECIES.find((s) => s.id === id);
}

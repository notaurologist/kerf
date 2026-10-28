import { z } from 'zod';
import { Citation, SOURCE_LINKS } from './sources.ts';

// Reference design values for visually graded sawn lumber, ASD, normal load duration, dry service
// (NDS 2024, 4.2 and 4.3). Transcribed from the NDS Supplement 2024, Table 4B (Southern Pine),
// and checked row by row against SPIB's published Table 1, which matches it exactly. Only the
// grades the owner expects to buy are entered (October 2026): Southern Pine No.1 and No.2.

/** Nominal size range a row applies to, in nominal inches, inclusive. */
const NominalRange = z.object({ min: z.number().positive(), max: z.number().positive() });

export const ReferenceValues = z.object({
  /** Bending, Fb; tension and compression parallel to grain, Ft and Fc; shear, Fv. psi. */
  Fb: z.number().positive(),
  Ft: z.number().positive(),
  Fv: z.number().positive(),
  /** Compression perpendicular to grain, psi. */
  FcPerp: z.number().positive(),
  Fc: z.number().positive(),
  /** Modulus of elasticity, and the value for beam and column stability, psi. */
  E: z.number().positive(),
  Emin: z.number().positive(),
  /** Specific gravity, oven-dry. */
  G: z.number().positive(),
});
export type ReferenceValues = z.infer<typeof ReferenceValues>;

export const SizeClassRow = z.object({
  /** As printed in the table, such as '5" - 6" wide'. */
  label: z.string().min(1),
  thickness: NominalRange,
  width: NominalRange,
  values: ReferenceValues,
});

export const SpeciesGrade = z.object({
  id: z.string().min(1),
  species: z.string().min(1),
  grade: z.string().min(1),
  /** Wet service factors and size factor rules for this table (see TABLE_4B_ADJUSTMENTS). */
  adjustments: z.literal('table-4b'),
  rows: z.array(SizeClassRow).min(1),
  sources: z.array(Citation).min(1),
});
export type SpeciesGrade = z.infer<typeof SpeciesGrade>;

const TABLE_4B_SOURCES = [
  {
    source: 'nds-supplement-2024',
    locator: 'Table 4B, Southern Pine, pp. 40-41',
    url: SOURCE_LINKS.supplementChapter4,
  },
  { source: 'spib-southern-pine-2013', locator: 'Table 1 (corroborating)' },
] satisfies Citation[];

const dimension = { min: 2, max: 4 };

/** One row of Table 4B. */
function row(
  label: string,
  width: { min: number; max: number },
  [Fb, Ft, Fv, FcPerp, Fc, E, Emin]: [number, number, number, number, number, number, number],
) {
  return {
    label,
    thickness: dimension,
    width,
    values: { Fb, Ft, Fv, FcPerp, Fc, E, Emin, G: 0.55 },
  };
}

export const SPECIES_GRADES = [
  {
    id: 'southern-pine-no1',
    species: 'Southern Pine',
    grade: 'No.1',
    adjustments: 'table-4b',
    rows: [
      row('2" - 4" wide', { min: 2, max: 4 }, [1500, 1000, 175, 565, 1650, 1_600_000, 580_000]),
      row('5" - 6" wide', { min: 5, max: 6 }, [1350, 875, 175, 565, 1550, 1_600_000, 580_000]),
      row('8" wide', { min: 8, max: 8 }, [1250, 800, 175, 565, 1500, 1_600_000, 580_000]),
      row('10" wide', { min: 10, max: 10 }, [1050, 700, 175, 565, 1450, 1_600_000, 580_000]),
      row('12" wide', { min: 12, max: 12 }, [1000, 650, 175, 565, 1400, 1_600_000, 580_000]),
    ],
    sources: TABLE_4B_SOURCES,
  },
  {
    id: 'southern-pine-no2',
    species: 'Southern Pine',
    grade: 'No.2',
    adjustments: 'table-4b',
    rows: [
      row('2" - 4" wide', { min: 2, max: 4 }, [1100, 675, 175, 565, 1450, 1_400_000, 510_000]),
      row('5" - 6" wide', { min: 5, max: 6 }, [1000, 600, 175, 565, 1400, 1_400_000, 510_000]),
      row('8" wide', { min: 8, max: 8 }, [925, 550, 175, 565, 1350, 1_400_000, 510_000]),
      row('10" wide', { min: 10, max: 10 }, [800, 475, 175, 565, 1300, 1_400_000, 510_000]),
      row('12" wide', { min: 12, max: 12 }, [750, 450, 175, 565, 1250, 1_400_000, 510_000]),
    ],
    sources: TABLE_4B_SOURCES,
  },
] as const satisfies SpeciesGrade[];

export type SpeciesGradeId = (typeof SPECIES_GRADES)[number]['id'];

export const SPECIES_GRADE_IDS = SPECIES_GRADES.map((s) => s.id) as [
  SpeciesGradeId,
  ...SpeciesGradeId[],
];

/**
 * Table 4B adjustment factors that depend on the table rather than on the use. Wet service
 * factors apply where the moisture content in service exceeds 19% for an extended time
 * (NDS 4.1.4, 4.3.3).
 */
export const TABLE_4B_ADJUSTMENTS = {
  wetService: {
    /** C_M for Fb is 1.0 instead when Fb · C_F is at or below this, psi. */
    Fb: { factor: 0.85, oneWhenFbCfAtMost: 1150 },
    Ft: 1.0,
    Fv: 0.97,
    FcPerp: 0.67,
    /** C_M for Fc is 1.0 instead when Fc is at or below this, psi. */
    Fc: { factor: 0.8, oneWhenFcAtMost: 750 },
    E: 0.9,
    Emin: 0.9,
    sources: [
      {
        source: 'nds-supplement-2024',
        locator: 'Table 4B Adjustment Factors, Wet Service Factor C_M, p. 39',
        url: SOURCE_LINKS.supplementChapter4,
      },
      { source: 'spib-southern-pine-2013', locator: 'Table A-2 (corroborating)' },
    ],
  },
  sizeFactor: {
    /**
     * Size factors are already in the tabulated values for most sizes, so C_F = 1.0, except: 4"
     * thick and 8" or wider, Fb may be multiplied by 1.1 (permitted, not required, and not
     * taken here); wider than 12", the 12" values times 0.9 (no stock that wide is entered).
     */
    Fb: 1.0,
    sources: [
      {
        source: 'nds-supplement-2024',
        locator: 'Table 4B Adjustment Factors, Size Factor C_F, p. 39',
        url: SOURCE_LINKS.supplementChapter4,
      },
    ],
  },
} as const;

/** '4x6' → { thickness: 4, width: 6 }, nominal inches. */
export function nominalDimensions(nominal: string): { thickness: number; width: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(nominal);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return { thickness: Math.min(a, b), width: Math.max(a, b) };
}

export function speciesGrade(id: SpeciesGradeId): SpeciesGrade {
  const found = SPECIES_GRADES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown species and grade: ${id}`);
  return found;
}

/**
 * The table row for a species and grade in a nominal size, or null when no row covers it (for
 * example 6x6, which is a timber size, Table 4D, not entered).
 */
export function referenceRow(
  id: SpeciesGradeId,
  nominal: string,
): z.infer<typeof SizeClassRow> | null {
  const size = nominalDimensions(nominal);
  if (!size) return null;
  const within = (r: { min: number; max: number }, v: number) => v >= r.min && v <= r.max;
  return (
    speciesGrade(id).rows.find(
      (r) => within(r.thickness, size.thickness) && within(r.width, size.width),
    ) ?? null
  );
}

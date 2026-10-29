import { z } from 'zod';
import { Citation, SOURCE_LINKS } from '../design-values/sources.ts';

// Bolt end distance, edge distance, and spacing, stated against NDS 2024 section 12.5.1 (#93,
// decision 0016). These are geometry, not a capacity check: connections stay on the confirmation
// checklist (PRODUCT.md, non-goals). Each distance lists the table rows that could apply, with
// what reaching each one gives, so an experienced builder can judge it. No verdicts (rule 2).
//
// Verified against NDS 2024, chapter 12 (AWC view-only copy dated 2026-09-11): 12.5.1.2,
// Tables 12.5.1A and 12.5.1B (p. 98), 12.5.1.3, Tables 12.5.1C and 12.5.1D (p. 99). They apply
// to dowel-type fasteners with D ≥ 1/4"; below that C∆ = 1.0 (12.5.1.1).

/** One table row: a distance in bolt diameters, when it applies, and what reaching it gives. */
export const DistanceRequirement = z.object({
  /** When the row applies, such as "bolt bearing toward the end, softwood". */
  condition: z.string(),
  /** As the table writes it: "7D". */
  multiple: z.string(),
  /** In inches, for this bolt. */
  value: z.number(),
  /** "full design value (C∆ = 1.0)", "reduced design value (C∆ = 0.5)", "minimum", or "maximum". */
  gives: z.string(),
  citation: Citation,
});
export type DistanceRequirement = z.infer<typeof DistanceRequirement>;

/** A distance in one member at a bolted joint, with the rows it is measured against. */
export const BoltDistance = z.object({
  member: z.string(),
  /** Such as "End distance", with how it is measured where that is not obvious. */
  label: z.string(),
  /** Inches. */
  value: z.number(),
  requirements: z.array(DistanceRequirement),
});
export type BoltDistance = z.infer<typeof BoltDistance>;

/** One bolted joint as laid out: its bolts and every distance that NDS 12.5.1 sets. */
export const BoltJoint = z.object({
  /** Such as "Crossbar to leg". */
  title: z.string(),
  bolts: z.number().int().positive(),
  diameter: z.number(),
  distances: z.array(BoltDistance),
  /** How the layout was chosen, and the assumptions behind which rows apply. */
  notes: z.array(z.string()),
});
export type BoltJoint = z.infer<typeof BoltJoint>;

const FULL = 'full design value (C∆ = 1.0)';
const HALF = 'reduced design value (C∆ = 0.5)';

const cite = (locator: string): Citation => ({
  source: 'nds-2024',
  locator,
  url: SOURCE_LINKS.ndsChapter12,
});
const TABLE_A = cite('Table 12.5.1A, End Distance Requirements, p. 98');
const TABLE_B = cite('Table 12.5.1B, Spacing Requirements for Fasteners in a Row, p. 98');
const TABLE_C = cite('Table 12.5.1C, Edge Distance Requirements, p. 99');
const TABLE_D = cite('Table 12.5.1D, Spacing Requirements Between Rows, p. 99');
const SECTION_3 = cite('12.5.1.3, p. 99');

/** The direction of the load relative to the grain of the member being measured. */
export type Loading = 'parallel' | 'perpendicular';
export type Wood = 'softwood' | 'hardwood';

function row(
  condition: string,
  multiple: number,
  diameter: number,
  gives: string,
  citation: Citation,
): DistanceRequirement {
  return { condition, multiple: `${multiple}D`, value: multiple * diameter, gives, citation };
}

/**
 * Table 12.5.1A. The load can reverse at a swing set's joints, so both directions are listed
 * when the load is parallel to grain.
 */
export function endDistance(
  member: string,
  value: number,
  diameter: number,
  loading: Loading,
  wood: Wood,
  label = 'End distance',
): BoltDistance {
  const [tensionHalf, tensionFull] = wood === 'softwood' ? [3.5, 7] : [2.5, 5];
  const requirements =
    loading === 'perpendicular'
      ? [
          row('load perpendicular to grain', 2, diameter, HALF, TABLE_A),
          row('load perpendicular to grain', 4, diameter, FULL, TABLE_A),
        ]
      : [
          row('bolt bearing away from the end', 2, diameter, HALF, TABLE_A),
          row('bolt bearing away from the end', 4, diameter, FULL, TABLE_A),
          row(`bolt bearing toward the end, ${wood}`, tensionHalf, diameter, HALF, TABLE_A),
          row(`bolt bearing toward the end, ${wood}`, tensionFull, diameter, FULL, TABLE_A),
        ];
  return { member, label, value, requirements };
}

/**
 * The end distance that gives full design value whichever way the bolt bears (Table 12.5.1A):
 * 7D in softwood, 5D in hardwood. A layout that keeps it needs no assumption about load direction.
 */
export function fullValueEndDistance(diameter: number, wood: Wood): number {
  return (wood === 'softwood' ? 7 : 5) * diameter;
}

/**
 * Table 12.5.1C. `lOverD` is the lesser of the bolt's length in the main member and in the side
 * members, each over D (footnote 1). Perpendicular to grain, both edges are listed: which one is
 * loaded depends on the load's direction.
 */
export function edgeDistance(
  member: string,
  value: number,
  diameter: number,
  loading: Loading,
  lOverD: number,
  rowSpacing = 0,
): BoltDistance {
  const requirements =
    loading === 'perpendicular'
      ? [
          row('the edge the load pushes toward', 4, diameter, 'minimum', TABLE_C),
          row('an edge the load pushes away from', 1.5, diameter, 'minimum', TABLE_C),
        ]
      : lOverD <= 6
        ? [row(`load parallel to grain, ℓ/D ≤ 6`, 1.5, diameter, 'minimum', TABLE_C)]
        : [
            {
              condition: 'load parallel to grain, ℓ/D > 6: 1.5D or half the spacing between rows',
              multiple: '1.5D or s/2',
              value: Math.max(1.5 * diameter, rowSpacing / 2),
              gives: 'minimum',
              citation: TABLE_C,
            },
          ];
  return { member, label: 'Edge distance', value, requirements };
}

/** Table 12.5.1B: bolts in a row, the row running along the grain. */
export function spacingInRow(
  member: string,
  value: number,
  diameter: number,
  loading: Loading,
): BoltDistance {
  const requirements =
    loading === 'parallel'
      ? [
          row('load parallel to grain', 3, diameter, 'minimum', TABLE_B),
          row('load parallel to grain', 4, diameter, FULL, TABLE_B),
        ]
      : [row('load perpendicular to grain', 3, diameter, 'minimum', TABLE_B)];
  return { member, label: 'Spacing between bolts in a row', value, requirements };
}

/** Table 12.5.1D, with ℓ/D as in Table 12.5.1C. */
export function spacingBetweenRows(
  member: string,
  value: number,
  diameter: number,
  loading: Loading,
  lOverD: number,
): BoltDistance {
  if (loading === 'parallel') {
    return {
      member,
      label: 'Spacing between rows',
      value,
      requirements: [row('load parallel to grain', 1.5, diameter, 'minimum', TABLE_D)],
    };
  }
  const l = lOverD * diameter;
  const requirement: DistanceRequirement =
    lOverD <= 2
      ? row('load perpendicular to grain, ℓ/D ≤ 2', 2.5, diameter, 'minimum', TABLE_D)
      : lOverD >= 6
        ? row('load perpendicular to grain, ℓ/D ≥ 6', 5, diameter, 'minimum', TABLE_D)
        : {
            condition: 'load perpendicular to grain, 2 < ℓ/D < 6',
            multiple: '(5ℓ + 10D) / 8',
            value: (5 * l + 10 * diameter) / 8,
            gives: 'minimum',
            citation: TABLE_D,
          };
  return { member, label: 'Spacing between rows', value, requirements: [requirement] };
}

/** 12.5.1.3: outermost bolts across the grain, unless detailing allows for shrinkage. */
export function spreadAcrossGrain(member: string, value: number): BoltDistance {
  return {
    member,
    label: 'Between the outermost bolts, across the grain',
    value,
    requirements: [
      {
        condition: 'without special detailing for cross-grain shrinkage',
        multiple: '5"',
        value: 5,
        gives: 'maximum',
        citation: SECTION_3,
      },
    ],
  };
}

/**
 * The rows a distance falls short of, worst first: a minimum or full-value row above it, or a
 * maximum below it. Facts for an expert check, not a verdict.
 */
export function shortfalls(distance: BoltDistance): DistanceRequirement[] {
  // A distance laid out to exactly a row's value meets it, whatever the last bit of rounding.
  const EPSILON = 1e-9;
  return distance.requirements
    .filter((r) =>
      r.gives === 'maximum'
        ? distance.value > r.value + EPSILON
        : distance.value < r.value - EPSILON,
    )
    .sort((a, b) => Math.abs(b.value - distance.value) - Math.abs(a.value - distance.value));
}

/** A distance in bolt diameters, to one decimal place, as the tables write them: "3.7D". */
export function formatDiameters(value: number, diameter: number): string {
  return `${(Math.round((value / diameter) * 10) / 10).toFixed(1)}D`;
}

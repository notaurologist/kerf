import { z } from 'zod';
import { Citation } from '../design-values/sources.ts';
import { woodSpecies } from '../design-values/woodSpecies.ts';
import { isMissing, MissingInput, type Needed, Quantity } from '../structural/types.ts';

// How much a solid-wood part moves across its grain as indoor humidity changes (DOMAIN.md, Wood
// movement). Wood Handbook (2021), Eq. 13-3: ΔD = D · C · (M_F − M_I), valid from 6% to 14%
// moisture content, with C from Table 13-5. Like a structural check, the result carries its
// working, and a missing input is "input needed", never a stand-in value.

const CHAPTER_4 = 'https://research.fs.usda.gov/treesearch/62243';
const CHAPTER_13 = 'https://research.fs.usda.gov/treesearch/62261';

const SOURCES = {
  equation: {
    source: 'fpl-gtr-282',
    locator: 'Chapter 13, Eq. 13-3, p. 13-16',
    url: CHAPTER_13,
  },
  orientation: {
    source: 'fpl-gtr-282',
    locator: 'Chapter 4, Relationship between Moisture Content and Shrinkage, p. 4-11',
    url: CHAPTER_4,
  },
  recommended: {
    source: 'fpl-gtr-282',
    locator: 'Chapter 13, Table 13-2 and Fig. 13-1, p. 13-5',
    url: CHAPTER_13,
  },
} satisfies Record<string, Citation>;

/** Eq. 13-3 holds from 6% to 14% moisture content (Wood Handbook, p. 13-16). */
export const MOISTURE_RANGE = { min: 6, max: 14 } as const;

export const RingOrientation = z.enum(['flatsawn', 'quartersawn', 'unknown']);
export type RingOrientation = z.infer<typeof RingOrientation>;

export interface MoistureRange {
  /** Lowest moisture content in service, percent. */
  low: number;
  /** Highest moisture content in service, percent. */
  high: number;
}

export interface MovementInput {
  /** The part, named by the template. */
  subject: string;
  /** Dimension across the grain that moves, in inches, such as a panel's width. */
  width: number;
  species: Needed<string>;
  orientation: Needed<RingOrientation>;
  moisture: Needed<MoistureRange>;
}

const Header = { subject: z.string() };

export const ComputedMovement = z.object({
  ...Header,
  status: z.literal('computed'),
  inputs: z.array(Quantity),
  formulas: z.array(z.string()),
  assumptions: z.array(z.string()),
  sources: z.array(Citation),
  /** The change in width from the low to the high moisture content. */
  change: Quantity,
});
export type ComputedMovement = z.infer<typeof ComputedMovement>;

export const MovementResult = z.discriminatedUnion('status', [
  ComputedMovement,
  z.object({ ...Header, status: z.literal('input-needed'), missing: z.array(MissingInput) }),
  z.object({
    ...Header,
    status: z.literal('not-computed'),
    reason: z.string(),
    sources: z.array(Citation),
  }),
]);
export type MovementResult = z.infer<typeof MovementResult>;

const ORIENTATION_LABEL: Record<RingOrientation, string> = {
  flatsawn: 'flatsawn',
  quartersawn: 'quartersawn',
  unknown: 'ring orientation unknown, so the tangential coefficient is used',
};

/** Expected change across the grain between the low and high moisture content in service. */
export function woodMovement(input: MovementInput): MovementResult {
  const { subject, width, species: s, orientation: o, moisture: m } = input;
  if (isMissing(s) || isMissing(o) || isMissing(m)) {
    const needs: Needed<unknown>[] = [s, o, m];
    const missing = needs.flatMap((n) => (isMissing(n) ? n.missing : []));
    return { subject, status: 'input-needed', missing };
  }
  const species = woodSpecies(s.value);
  if (!species) throw new Error(`Unknown species: ${s.value}`);
  if (!(width > 0)) throw new RangeError(`Width must be positive, got ${width}`);
  const orientation = o.value;
  const { low, high } = m.value;
  if (!(low >= MOISTURE_RANGE.min && high <= MOISTURE_RANGE.max && low < high)) {
    return {
      subject,
      status: 'not-computed',
      reason: `Moisture content from ${low}% to ${high}% is outside 6% to 14%, where the Wood Handbook's dimensional change coefficients apply. Enter a range within it, with the low value below the high one.`,
      sources: [SOURCES.equation],
    };
  }
  const radial = orientation === 'quartersawn';
  const C = radial ? species.dimensionalChange.radial : species.dimensionalChange.tangential;
  const symbol = radial ? 'C_R' : 'C_T';
  const change = width * C * (high - low);
  return {
    subject,
    status: 'computed',
    inputs: [
      { symbol: 'D', label: 'Width across the grain', value: width, unit: 'in' },
      {
        symbol,
        label: `${radial ? 'Radial' : 'Tangential'} dimensional change coefficient, ${species.name}, ${ORIENTATION_LABEL[orientation]}`,
        value: C,
        unit: 'per %',
        basis: 'Table 13-5',
        sources: species.dimensionalChange.sources,
      },
      {
        symbol: 'M_I',
        label: 'Lowest moisture content in service',
        value: low,
        unit: '%',
        basis: 'Entered by the owner',
        sources: [SOURCES.recommended],
      },
      {
        symbol: 'M_F',
        label: 'Highest moisture content in service',
        value: high,
        unit: '%',
        basis: 'Entered by the owner',
        sources: [SOURCES.recommended],
      },
    ],
    formulas: [`ΔD = D · ${symbol} · (M_F − M_I)`],
    assumptions: [
      'Moisture content stays within 6% to 14%, where Eq. 13-3 applies.',
      'Coefficients are species averages; individual boards vary, with a coefficient of variation of about 15%.',
      'Commercial lumber is seldom perfectly flatsawn or quartersawn, so this probably overestimates width change.',
    ],
    sources: [SOURCES.equation, SOURCES.orientation],
    change: { symbol: 'ΔD', label: 'Change in width', value: change, unit: 'in' },
  };
}

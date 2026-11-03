import { referenceRow, speciesGrade } from '../design-values/sawnLumber.ts';
import { type Citation, SOURCE_LINKS } from '../design-values/sources.ts';
import { factorQuantity, type LoadFactor, type MaterialInput, missingFrom } from './checks.ts';
import { adjustedCompression, type ServiceConditions } from './factors.ts';
import { formatNumber } from './format.ts';
import { type CheckResult, isMissing, type Needed, type Quantity } from './types.ts';

// Generic check of a solid sawn-lumber column in compression parallel to grain (NDS 2024 3.6.3
// and 3.7.1). The template supplies the member, its effective length in each direction with the
// end conditions behind it, and the axial load; nothing here knows what is being built.

/** Buckling in one direction: ℓe = Ke · ℓ over d, the dimension in that direction (3.7.1.3). */
export interface ColumnAxis {
  /** Where the member bends when it buckles, such as 'Along the beam'. */
  label: string;
  /** Cross-section dimension in that direction, inches. */
  d: number;
  /** Unbraced length ℓ, inches. */
  length: number;
  /** Buckling length coefficient, from NDS Appendix G or engineering mechanics. */
  Ke: number;
  /** The end conditions behind ℓ and Ke, and where they come from. */
  basis: string;
}

export interface ColumnMember {
  /** Named by the template, such as 'Front legs, 4x4'. */
  subject: string;
  nominal: string;
  /** Actual cross-section, inches. */
  breadth: number;
  depth: number;
  sizeSources: Citation[];
  /**
   * Buckling in each direction. A reason instead when the template knows of no end conditions
   * that hold the member in some direction, so no effective length can be given.
   */
  axes: readonly ColumnAxis[] | { reason: string };
  /** The smallest cross-section where bolt holes cross the member, with how it was found. */
  netArea?: { value: number; basis: string };
}

/** The axial load on the column: the part a load factor multiplies and the part it does not. */
export interface AxialLoad {
  factored: number;
  unfactored: number;
  working: Quantity[];
  assumptions: string[];
}

export interface ColumnCheckInput {
  member: ColumnMember;
  material: Needed<MaterialInput>;
  conditions: ServiceConditions;
  loadCase: string;
  load: Needed<AxialLoad>;
  /** Multiplies `load.factored` only. */
  factor?: LoadFactor;
  /** The template's assumptions about the member and its ends. */
  assumptions: string[];
}

const nds = (locator: string, url: string): Citation => ({ source: 'nds-2024', locator, url });

const SOURCES = {
  compression: nds('3.6.3, p. 23', SOURCE_LINKS.ndsChapter3),
  stability: nds('3.7.1, Eq. 3.7-1, p. 23', SOURCE_LINKS.ndsChapter3),
  slendernessLimit: nds('3.7.1.4, p. 23', SOURCE_LINKS.ndsChapter3),
  effectiveLength: nds('Appendix G and Table G1, p. 183', SOURCE_LINKS.ndsAppendix),
  pressureTreated: [
    nds('4.3.13, p. 32', SOURCE_LINKS.ndsChapter4),
    nds('Table 2.3.2, footnote 2, p. 13', SOURCE_LINKS.ndsChapter2),
  ],
} satisfies Record<string, Citation | Citation[]>;

/** NDS 3.7.1.4: ℓe/d of a solid column may not exceed 50 once built. */
const SLENDERNESS_LIMIT = 50;
/** c in Eq. 3.7-1 for sawn lumber (3.7.1.5). */
const C_SAWN = 0.8;

/**
 * Column stability factor (NDS 3.7.1.5, Eq. 3.7-1):
 *   F_cE = 0.822·Emin' / (ℓe/d)², C_P = (1 + F_cE/Fc*)/2c − √([(1 + F_cE/Fc*)/2c]² − (F_cE/Fc*)/c).
 */
export function columnStabilityFactor(
  FcStar: number,
  EminPrime: number,
  slenderness: number,
): { FcE: number; CP: number } {
  const FcE = (0.822 * EminPrime) / (slenderness * slenderness);
  const r = FcE / FcStar;
  const h = (1 + r) / (2 * C_SAWN);
  return { FcE, CP: h - Math.sqrt(h * h - r / C_SAWN) };
}

/** Compression parallel to grain in a solid sawn-lumber column (DOMAIN.md, Structural checks). */
export function columnCheck(input: ColumnCheckInput): CheckResult {
  const { member, factor } = input;
  const head = {
    kind: 'column' as const,
    title: 'Compression',
    subject: member.subject,
    loadCase: input.loadCase,
  };
  if ('reason' in member.axes) {
    return {
      ...head,
      status: 'not-computed',
      reason: member.axes.reason,
      sources: [SOURCES.effectiveLength],
    };
  }
  const axes = member.axes.map((axis) => ({
    ...axis,
    ratio: (axis.Ke * axis.length) / axis.d,
  }));
  const governing = axes.reduce((most, a) => (a.ratio > most.ratio ? a : most));
  if (governing.ratio > SLENDERNESS_LIMIT) {
    return {
      ...head,
      status: 'not-computed',
      reason: `ℓe/d is ${formatNumber(governing.ratio)} ${governing.label.toLowerCase()}, over ${SLENDERNESS_LIMIT}, the NDS limit for a solid column. ${governing.basis}`,
      sources: [SOURCES.slendernessLimit, SOURCES.effectiveLength],
    };
  }

  const needs = [input.material, input.load, ...(factor ? [factor.value] : [])];
  if (isMissing(input.material) || isMissing(input.load)) {
    return { ...head, status: 'input-needed', missing: missingFrom(...needs) };
  }
  const material = input.material.value;
  const sg = speciesGrade(material.speciesGrade);
  const row = referenceRow(material.speciesGrade, member.nominal);
  if (!row) {
    return {
      ...head,
      status: 'not-computed',
      reason: `No design values are entered for ${sg.species} ${sg.grade} in ${member.nominal}.`,
      sources: sg.sources,
    };
  }
  const adjusted = adjustedCompression(
    {
      reference: row.values,
      name: `${sg.species} ${sg.grade}`,
      sources: sg.sources,
      incised: material.incised,
    },
    input.conditions,
  );
  const CD = adjusted.factors.find((f) => f.symbol === 'C_D')?.value ?? 1;
  if (CD > 1.6 && input.conditions.waterborneTreatment) {
    return {
      ...head,
      status: 'not-computed',
      reason:
        'Load duration factors above 1.6 do not apply to lumber treated with water-borne preservatives.',
      sources: SOURCES.pressureTreated,
    };
  }

  const { FcE, CP } = columnStabilityFactor(adjusted.FcStar, adjusted.Emin, governing.ratio);
  const FcPrime = adjusted.FcStar * CP;
  const area = member.netArea?.value ?? member.breadth * member.depth;
  const load = input.load.value;

  // Fc'·A = C·factored + unfactored at margin 1.0.
  const atMarginOne =
    factor && load.factored > 0
      ? {
          key: factor.key,
          symbol: factor.symbol,
          label: factor.label,
          value: Math.max(0, (FcPrime * area - load.unfactored) / load.factored),
        }
      : undefined;
  if (factor && isMissing(factor.value)) {
    return {
      ...head,
      status: 'input-needed',
      missing: factor.value.missing,
      ...(atMarginOne ? { breakEven: atMarginOne } : {}),
    };
  }
  const C = factor && !isMissing(factor.value) ? factor.value.value : undefined;
  const P = (C ?? 1) * load.factored + load.unfactored;
  const fc = P / area;

  const ch3 = [SOURCES.stability];
  const inputs: Quantity[] = [
    {
      symbol: 'b',
      label: 'Breadth',
      value: member.breadth,
      unit: 'in',
      basis: `Dressed size of ${member.nominal}`,
      sources: member.sizeSources,
    },
    {
      symbol: 'd',
      label: 'Depth',
      value: member.depth,
      unit: 'in',
      basis: `Dressed size of ${member.nominal}`,
      sources: member.sizeSources,
    },
    ...axes.flatMap((a, i): Quantity[] => [
      {
        symbol: `ℓ${i + 1}`,
        label: `Unbraced length, ${a.label.toLowerCase()}`,
        value: a.length,
        unit: 'in',
        basis: a.basis,
      },
      {
        symbol: `Ke${i + 1}`,
        label: `Buckling length coefficient, ${a.label.toLowerCase()}`,
        value: a.Ke,
        unit: '',
        basis: a.basis,
        sources: [SOURCES.effectiveLength],
      },
    ]),
    ...load.working,
    ...(factor && C !== undefined ? [factorQuantity(factor, C)] : []),
    {
      symbol: 'Fc',
      label: 'Reference compression parallel to grain',
      value: row.values.Fc,
      unit: 'psi',
      basis: `${sg.species} ${sg.grade}, ${row.label}`,
      sources: sg.sources,
    },
    {
      symbol: 'Emin',
      label: 'Reference Emin',
      value: row.values.Emin,
      unit: 'psi',
      basis: `${sg.species} ${sg.grade}, ${row.label}`,
      sources: sg.sources,
    },
  ];
  const steps: Quantity[] = [
    ...axes.map(
      (a, i): Quantity => ({
        symbol: `ℓe${i + 1}/d${i + 1}`,
        label: `Slenderness ratio, ${a.label.toLowerCase()}, Ke·ℓ / d`,
        value: a.ratio,
        unit: '',
        sources: ch3,
      }),
    ),
    {
      symbol: 'ℓe/d',
      label: `Larger slenderness ratio, ${governing.label.toLowerCase()}`,
      value: governing.ratio,
      unit: '',
      sources: [SOURCES.slendernessLimit],
    },
    { symbol: 'Fc*', label: 'Fc with all factors except C_P', value: adjusted.FcStar, unit: 'psi' },
    { symbol: "Emin'", label: 'Adjusted Emin', value: adjusted.Emin, unit: 'psi' },
    { symbol: 'F_cE', label: "0.822·Emin' / (ℓe/d)²", value: FcE, unit: 'psi', sources: ch3 },
    { symbol: 'C_P', label: 'Column stability factor', value: CP, unit: '', sources: ch3 },
    { symbol: 'P', label: 'Axial load', value: P, unit: 'lb' },
    member.netArea
      ? {
          symbol: 'A_n',
          label: 'Net area at a bolt hole',
          value: area,
          unit: 'in²',
          basis: member.netArea.basis,
        }
      : { symbol: 'A', label: 'Area, b·d', value: area, unit: 'in²' },
  ];

  return {
    ...head,
    status: 'computed',
    inputs,
    formulas: [
      ...(factor && C !== undefined
        ? [`P = ${factor.symbol} · the load it multiplies + the load it does not`]
        : []),
      'ℓe = Ke·ℓ in each direction; ℓe/d is the larger of ℓe1/d1 and ℓe2/d2, at most 50',
      "Fc* = Fc · C_D · C_M · C_t · C_F · C_i; Emin' = Emin · C_M · C_t · C_i",
      "F_cE = 0.822·Emin' / (ℓe/d)²",
      'C_P = (1 + F_cE/Fc*)/(2c) − √([(1 + F_cE/Fc*)/(2c)]² − (F_cE/Fc*)/c), c = 0.8 for sawn lumber',
      "Fc' = Fc* · C_P",
      member.netArea ? 'f_c = P / A_n' : 'f_c = P / A',
      "margin = Fc' / f_c",
    ],
    steps,
    factors: adjusted.factors,
    assumptions: [
      ...input.assumptions,
      ...load.assumptions,
      ...(member.netArea
        ? [
            "f_c is taken on the net area at a bolt hole and compared with Fc', which includes C_P. NDS 3.6.3 asks for the net area only where a hole is in the part of the length most likely to buckle, and then compares it with Fc*, which does not, so this is the more cautious of the two.",
          ]
        : []),
      "The load acts along the member's axis; bending from loads across it is not part of this check (NDS 3.9).",
    ],
    sources: [SOURCES.compression, SOURCES.stability, SOURCES.effectiveLength],
    computed: { symbol: 'f_c', label: 'Compression stress', value: fc, unit: 'psi' },
    allowable: {
      symbol: "Fc'",
      label: 'Adjusted compression design value',
      value: FcPrime,
      unit: 'psi',
    },
    margin: FcPrime / fc,
    ...(atMarginOne ? { breakEven: atMarginOne } : {}),
  };
}

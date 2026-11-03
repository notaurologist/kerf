import { z } from 'zod';
import { referenceRow, type SpeciesGradeId, speciesGrade } from '../design-values/sawnLumber.ts';
import { type Citation, SOURCE_LINKS } from '../design-values/sources.ts';
import {
  maxDeflectionTimesEI,
  maxMoment,
  maxShear,
  momentAt,
  reactions,
  type SpanLoads,
  shearBeside,
} from './beam.ts';
import { type AdjustedValues, adjustedValues, type ServiceConditions } from './factors.ts';
import { netSection, type SectionHole, shearSection } from './netSection.ts';
import {
  type BreakEven,
  type CheckKind,
  CheckResult,
  type ComputedCheck,
  isMissing,
  type MissingInput,
  type Needed,
  type Quantity,
} from './types.ts';

// Generic beam and hardware checks (DOMAIN.md, Structural checks). Templates supply the member,
// its supports, the loads for each load case, and the conditions of use; nothing here knows what
// is being built.
//
// A built-up member of n identical plies is checked one ply at a time, each ply carrying 1/n of
// every load (decision 0013). The NDS 2024 has no provisions for built-up beams, so the plies are
// not credited with acting as one deeper-than-wide section for beam stability.

/** A load on the member at a position along it, in the template's coordinates. */
export interface PointLoad {
  x: number;
  /** Pounds, downward. */
  P: number;
  label: string;
}

/** A load spread evenly over the whole span between the supports, such as the member's weight. */
export interface UniformLoad {
  /** Pounds per inch, downward. */
  w: number;
  label: string;
}

/** The loads in one load case: point loads, and optionally a uniform load over the span. */
export interface BeamLoads {
  points: PointLoad[];
  uniform?: UniformLoad;
}

export interface BeamMember {
  /** Named by the template, such as 'Top beam'. */
  subject: string;
  /** Nominal size of one ply, such as '2x6'. */
  nominal: string;
  /** 1 for a solid member. */
  plies: number;
  /** Actual size of one ply: breadth (horizontal) and depth (vertical), inches. */
  plyBreadth: number;
  depth: number;
  /** Where the actual sizes come from, such as a table of dressed sizes. */
  sizeSources: Citation[];
  /** Support positions in the same coordinates as the loads. */
  supportsX: [number, number];
  /** Distance between points of lateral support that prevent rotation (NDS 3.3.3.4). */
  unbracedLength: number;
}

export interface MaterialInput {
  speciesGrade: SpeciesGradeId;
  incised: boolean;
}

/**
 * A factor on a load case's point loads but not its uniform load, such as a dynamic factor for
 * snap loads that does not apply to the member's own weight. Checks that use it also report the
 * factor at which their margin reaches 1.0.
 */
export interface LoadFactor {
  /** The input it comes from, as in a missing input's key. */
  key: string;
  symbol: string;
  label: string;
  /** How it was obtained, as in a quantity's basis. */
  basis: string;
  value: Needed<number>;
}

export interface LoadCase {
  /** Named by the template, such as 'Strength: peak load'. */
  name: string;
  /** Before any factor. */
  loads: Needed<BeamLoads>;
  factor?: LoadFactor;
  /** Template inputs and intermediate values behind the loads, shown with every result. */
  working: Quantity[];
  assumptions: string[];
}

/** A section along the member where a bored hole reduces it. */
interface HoleSection {
  /** In the same coordinates as the loads. */
  x: number;
  /** Named by the template, such as what the hole is for. */
  label: string;
  hole: SectionHole;
  /**
   * Set when the load at this section hangs from bolts in this hole, a connection NDS 2024 3.4.4.1
   * covers: the hole's distance from the member's nearer end.
   */
  hung?: { fromEnd: number };
}

/**
 * The member's bored holes between its supports, which bending and shear check at their net
 * section (NDS 2024 3.1.2.1); or why their net section cannot be worked out, which leaves bending
 * and shear not computed.
 */
export type MemberHoles = Needed<HoleSection[]> | { reason: string };

export interface BeamCheckInput {
  member: BeamMember;
  material: Needed<MaterialInput>;
  conditions: ServiceConditions;
  /** Bending and shear use this case. */
  strength: LoadCase;
  /** Deflection uses this case, against span / limitRatio, entered in the input `limitKey`. */
  deflection: LoadCase & { limitRatio: Needed<number>; limitKey: string };
  /** The template's assumptions about the member and its supports. */
  assumptions: string[];
  /** Holes bored through the member. With none, bending and shear use the gross section. */
  holes?: MemberHoles;
}

export const BeamChecks = z.object({
  bending: CheckResult,
  shear: CheckResult,
  deflection: CheckResult,
});
export type BeamChecks = z.infer<typeof BeamChecks>;

const nds = (locator: string, url: string): Citation => ({ source: 'nds-2024', locator, url });

const SOURCES = {
  superposition: [
    { source: 'awc-da6', locator: 'Figure 8, Simple Beam, Concentrated Load at Any Point, p. 7' },
    { source: 'awc-da6', locator: 'Figure 1, Simple Beam, Uniformly Distributed Load, p. 4' },
    {
      source: 'awc-da6',
      locator: 'Figure 9, Two Equal Concentrated Loads Symmetrically Placed, p. 8 (hand check)',
    },
  ],
  bending: nds('3.3.2, Eq. 3.3-2 and 3.3-4, p. 17', SOURCE_LINKS.ndsChapter3),
  shear: nds('3.4.1 and 3.4.2, Eq. 3.4-2, p. 19', SOURCE_LINKS.ndsChapter3),
  connectionShear: nds('3.4.4.1, Eq. 3.4-8 and 3.4-9, Figure 3E, p. 21', SOURCE_LINKS.ndsChapter3),
  deflection: nds('3.5.1, p. 22', SOURCE_LINKS.ndsChapter3),
  apparentE: nds('Appendix F.3.1, p. 181', SOURCE_LINKS.ndsAppendix),
  span: nds('3.2.1, p. 17', SOURCE_LINKS.ndsChapter3),
  netSection: nds('3.1.2.1, p. 16', SOURCE_LINKS.ndsChapter3),
  pressureTreated: [
    nds('4.3.13, p. 32', SOURCE_LINKS.ndsChapter4),
    nds('Table 2.3.2, footnote 2, p. 13', SOURCE_LINKS.ndsChapter2),
  ],
} satisfies Record<string, Citation | Citation[]>;

const BUILT_UP = 'Each ply carries an equal share of every load (decision 0013).';

function header(kind: CheckKind, title: string, subject: string, loadCase: string) {
  return { kind, title, subject, loadCase };
}

/** Missing inputs across several needs, each listed once. */
export function missingFrom(...needs: Needed<unknown>[]): MissingInput[] {
  const all = needs.flatMap((n) => (isMissing(n) ? n.missing : []));
  return all.filter((m, i) => all.findIndex((other) => other.key === m.key) === i);
}

interface Prepared {
  L: number;
  /** Loads on one ply, positioned from the left support. */
  plyLoads: SpanLoads;
  inputs: Quantity[];
  steps: Quantity[];
}

function prepare(member: BeamMember, { points: loads, uniform }: BeamLoads): Prepared | string {
  const [x0, x1] = member.supportsX;
  const L = x1 - x0;
  const outside = loads.find((l) => l.x <= x0 || l.x >= x1);
  if (outside) {
    return `${outside.label} at x = ${outside.x} is not between the supports; only loads between supports are checked.`;
  }
  const n = member.plies;
  const inputs: Quantity[] = [
    {
      symbol: 'L',
      label: 'Span between support centerlines',
      value: L,
      unit: 'in',
      basis: 'From the template geometry',
      sources: [SOURCES.span],
    },
    {
      symbol: 'b',
      label: n > 1 ? 'Breadth of one ply' : 'Breadth',
      value: member.plyBreadth,
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
    ...(n > 1 ? [{ symbol: 'n', label: 'Plies', value: n, unit: '' }] : []),
    ...(uniform
      ? [{ symbol: 'w', label: `${uniform.label}, over the span`, value: uniform.w, unit: 'lb/in' }]
      : []),
    ...loads.flatMap((l, i) => [
      { symbol: `x${i + 1}`, label: `${l.label}, position`, value: l.x, unit: 'in' },
      { symbol: `P${i + 1}`, label: `${l.label}, load`, value: l.P, unit: 'lb' },
    ]),
  ];
  return {
    L,
    plyLoads: {
      points: loads.map((l) => ({ a: l.x - x0, P: l.P / n })),
      w: (uniform?.w ?? 0) / n,
    },
    inputs,
    steps:
      n > 1 ? [{ symbol: '1/n', label: 'Share of each load per ply', value: 1 / n, unit: '' }] : [],
  };
}

function materialQuantities(m: MaterialInput, member: BeamMember): Quantity[] | null {
  const row = referenceRow(m.speciesGrade, member.nominal);
  if (!row) return null;
  const sg = speciesGrade(m.speciesGrade);
  const basis = `${sg.species} ${sg.grade}, ${row.label}`;
  const v = row.values;
  return [
    {
      symbol: 'Fb',
      label: 'Reference bending',
      value: v.Fb,
      unit: 'psi',
      basis,
      sources: sg.sources,
    },
    {
      symbol: 'Fv',
      label: 'Reference shear',
      value: v.Fv,
      unit: 'psi',
      basis,
      sources: sg.sources,
    },
    {
      symbol: 'E',
      label: 'Reference modulus of elasticity',
      value: v.E,
      unit: 'psi',
      basis,
      sources: sg.sources,
    },
    {
      symbol: 'Emin',
      label: 'Reference Emin',
      value: v.Emin,
      unit: 'psi',
      basis,
      sources: sg.sources,
    },
  ];
}

export function beamChecks(input: BeamCheckInput): BeamChecks {
  const result = checksOf(input);
  const holes = input.holes;
  if (!holes || !('reason' in holes)) return result;
  const reasoned = (check: CheckResult): CheckResult => {
    if (check.status === 'not-computed') return check;
    const { kind, title, subject, loadCase } = check;
    return {
      kind,
      title,
      subject,
      loadCase,
      status: 'not-computed',
      reason: holes.reason,
      sources: [SOURCES.netSection],
    };
  };
  return { ...result, bending: reasoned(result.bending), shear: reasoned(result.shear) };
}

/** What bending and shear need from the holes: their sections, when they are still to be entered. */
function holeNeeds(input: BeamCheckInput): Needed<unknown>[] {
  return input.holes && 'missing' in input.holes ? [input.holes] : [];
}

function checksOf(input: BeamCheckInput): BeamChecks {
  const { member } = input;
  const s = input.strength;
  const d = input.deflection;
  const h = {
    bending: header('beam-bending', 'Bending', member.subject, s.name),
    shear: header('beam-shear', 'Shear', member.subject, s.name),
    deflection: header('beam-deflection', 'Deflection', member.subject, d.name),
  };

  const notComputed = (reason: string, sources: Citation[] = []): BeamChecks => ({
    bending: { ...h.bending, status: 'not-computed', reason, sources },
    shear: { ...h.shear, status: 'not-computed', reason, sources },
    deflection: { ...h.deflection, status: 'not-computed', reason, sources },
  });

  if (isMissing(input.material)) {
    const m = input.material;
    return {
      bending: {
        ...h.bending,
        status: 'input-needed',
        missing: missingFrom(m, ...strengthNeeds(s), ...holeNeeds(input)),
      },
      shear: {
        ...h.shear,
        status: 'input-needed',
        missing: missingFrom(m, ...strengthNeeds(s), ...holeNeeds(input)),
      },
      deflection: {
        ...h.deflection,
        status: 'input-needed',
        missing: missingFrom(m, d.loads, d.limitRatio),
      },
    };
  }
  const material = input.material.value;
  const sg = speciesGrade(material.speciesGrade);
  const row = referenceRow(material.speciesGrade, member.nominal);
  const reference = materialQuantities(material, member);
  if (!row || !reference) {
    return notComputed(
      `No design values are entered for ${sg.species} ${sg.grade} in ${member.nominal}.`,
      sg.sources,
    );
  }

  const adjusted = adjustedValues(
    {
      reference: row.values,
      name: `${sg.species} ${sg.grade}`,
      sources: sg.sources,
      incised: material.incised,
    },
    input.conditions,
    { breadth: member.plyBreadth, depth: member.depth, unbracedLength: member.unbracedLength },
  );
  if (adjusted.slendernessExceeded) {
    return notComputed(
      'The beam slenderness ratio R_B exceeds 50, the NDS limit; the member needs lateral support along its length.',
      [nds('3.3.3.7, p. 18', SOURCE_LINKS.ndsChapter3)],
    );
  }
  const CD = adjusted.factors.find((f) => f.symbol === 'C_D')?.value ?? 1;
  if (CD > 1.6 && input.conditions.waterborneTreatment) {
    return notComputed(
      'Load duration factors above 1.6 do not apply to lumber treated with water-borne preservatives.',
      SOURCES.pressureTreated,
    );
  }

  const assumptions = [
    ...(member.plies > 1 ? [BUILT_UP] : []),
    ...input.assumptions,
    'Simply supported between the two supports; loads outside the supports, including the weight of any overhang, are not part of this check.',
  ];

  return {
    bending: strengthCheck('bending', h.bending, input, adjusted, reference, assumptions),
    shear: strengthCheck('shear', h.shear, input, adjusted, reference, assumptions),
    deflection: deflectionCheck(h.deflection, input, adjusted, reference, assumptions),
  };
}

/** What a strength check needs: its loads, and its factor if it has one. */
function strengthNeeds(lc: LoadCase): Needed<unknown>[] {
  return lc.factor ? [lc.loads, lc.factor.value] : [lc.loads];
}

/** The loads with every point load multiplied by `C`; the uniform load is left as it is. */
function scaled<T extends BeamLoads | SpanLoads>(loads: T, C: number): T {
  return { ...loads, points: loads.points.map((p) => ({ ...p, P: p.P * C })) };
}

/** The factor's value as an input in the working. */
export function factorQuantity(factor: LoadFactor, value: number): Quantity {
  return {
    symbol: factor.symbol,
    label: factor.label,
    value,
    unit: '',
    basis: factor.basis,
    input: factor.key,
  };
}

/**
 * The factor C at which `demand(C)` reaches `allowable`, found by bisection. Demand never falls as
 * C grows, since every load acts downward, so the first C that reaches it is unique. Undefined
 * when the factor does not change the demand.
 */
function factorAtMarginOne(demand: (C: number) => number, allowable: number): number | undefined {
  if (demand(0) >= allowable) return 0;
  if (demand(1) <= demand(0)) return undefined;
  let low = 0;
  let high = 1;
  while (demand(high) < allowable) {
    low = high;
    high *= 2;
  }
  // 100 halvings take the bracket below the precision of a double.
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (demand(mid) < allowable) low = mid;
    else high = mid;
  }
  return high;
}

function breakEven(factor: LoadFactor, value: number | undefined): BreakEven | undefined {
  return value === undefined
    ? undefined
    : { key: factor.key, symbol: factor.symbol, label: factor.label, value };
}

function factorsFor(adjusted: AdjustedValues, value: 'Fb' | 'Fv' | 'E') {
  return adjusted.factors.filter((f) => f.appliesTo.includes(value));
}

/**
 * The section `of` gives at each hole between the supports, positioned from the left support, or
 * why one cannot be worked out.
 */
function holeSections<T extends object>(
  input: BeamCheckInput,
  of: (b: number, d: number, plies: number, h: HoleSection) => T | string,
): ({ a: number; label: string } & T)[] | string {
  const holes = input.holes;
  if (!holes || !('value' in holes)) return [];
  const { plyBreadth: b, depth: d, plies, supportsX } = input.member;
  const [x0, x1] = supportsX;
  const found: ({ a: number; label: string } & T)[] = [];
  for (const h of holes.value) {
    if (h.x <= x0 || h.x >= x1) continue;
    const section = of(b, d, plies, h);
    if (typeof section === 'string') return `${h.label}: ${section}`;
    found.push({ a: h.x - x0, label: h.label, ...section });
  }
  return found;
}

/** The larger shear on either side of x. */
function shearNextTo(L: number, loads: SpanLoads, x: number): number {
  const V = shearBeside(L, loads, x);
  return Math.max(Math.abs(V.left), Math.abs(V.right));
}

const lowerFirst = (label: string) => `${label.charAt(0).toLowerCase()}${label.slice(1)}`;

function strengthCheck(
  which: 'bending' | 'shear',
  head: ReturnType<typeof header>,
  input: BeamCheckInput,
  adjusted: AdjustedValues,
  reference: Quantity[],
  assumptions: string[],
): CheckResult {
  const lc = input.strength;
  const needs = [...strengthNeeds(lc), ...holeNeeds(input)];
  if (isMissing(lc.loads) || holeNeeds(input).length > 0) {
    return { ...head, status: 'input-needed', missing: missingFrom(...needs) };
  }
  const unfactored = prepare(input.member, lc.loads.value);
  if (typeof unfactored === 'string')
    return { ...head, status: 'not-computed', reason: unfactored, sources: [] };
  const { plyBreadth: b, depth: dd } = input.member;
  const sections =
    which === 'bending'
      ? holeSections(input, (b, d, plies, h) => netSection(b, d, plies, h.hole))
      : [];
  if (typeof sections === 'string')
    return { ...head, status: 'not-computed', reason: sections, sources: [SOURCES.netSection] };
  const shearAreas =
    which === 'shear'
      ? holeSections(input, (b, d, plies, h) => shearSection(b, d, plies, h.hole, h.hung))
      : [];
  if (typeof shearAreas === 'string')
    return { ...head, status: 'not-computed', reason: shearAreas, sources: [SOURCES.netSection] };
  const allowed = which === 'bending' ? adjusted.Fb : adjusted.Fv;
  const factor = lc.factor;
  const atMarginOne =
    factor &&
    breakEven(
      factor,
      factorAtMarginOne((C) => {
        const loads = scaled(unfactored.plyLoads, C);
        return which === 'bending'
          ? Math.max(
              maxMoment(unfactored.L, loads).M / ((b * dd * dd) / 6),
              ...sections.map((sec) => momentAt(unfactored.L, loads, sec.a) / sec.S),
            )
          : Math.max(
              (3 * maxShear(unfactored.L, loads)) / (2 * b * dd),
              ...shearAreas.map(
                (sec) => (3 * shearNextTo(unfactored.L, loads, sec.a)) / (2 * sec.A),
              ),
            );
      }, allowed),
    );
  if (factor && isMissing(factor.value)) {
    return {
      ...head,
      status: 'input-needed',
      missing: factor.value.missing,
      ...(atMarginOne ? { breakEven: atMarginOne } : {}),
    };
  }
  const C = factor && !isMissing(factor.value) ? factor.value.value : undefined;
  const prepared =
    C === undefined
      ? unfactored
      : // Scaling moves no load, so the positions `unfactored` accepted still hold.
        (prepare(input.member, scaled(lc.loads.value, C)) as Prepared);
  const { L, plyLoads } = prepared;
  const R = reactions(L, plyLoads);
  const per = input.member.plies > 1 ? ' per ply' : '';
  const reactionSteps: Quantity[] = [
    { symbol: 'R1', label: `Left reaction${per}`, value: R.left, unit: 'lb' },
    { symbol: 'R2', label: `Right reaction${per}`, value: R.right, unit: 'lb' },
  ];
  const common = {
    ...head,
    status: 'computed' as const,
    inputs: [
      ...prepared.inputs,
      ...lc.working,
      ...(factor && C !== undefined ? [factorQuantity(factor, C)] : []),
      ...reference,
    ],
    assumptions: [...assumptions, ...lc.assumptions],
    ...(atMarginOne ? { breakEven: atMarginOne } : {}),
  };
  const factored =
    factor && C !== undefined
      ? [
          `Each point load P = ${factor.symbol} · its load before the factor; the uniform load w is not multiplied`,
        ]
      : [];

  if (which === 'bending') {
    const { M, x } = maxMoment(L, plyLoads);
    const S = (b * dd * dd) / 6;
    const x0 = input.member.supportsX[0];
    // Bending at each hole, on its net section (NDS 2024 3.1.2.1).
    const atHoles = sections.map((sec, i) => {
      const n = i + 1;
      const Mh = momentAt(L, plyLoads, sec.a);
      const fb = Mh / sec.S;
      return {
        ...sec,
        fb,
        steps: [
          { symbol: `x_h${n}`, label: `${sec.label}, position`, value: sec.a + x0, unit: 'in' },
          { symbol: `M_h${n}`, label: `${sec.label}, moment${per}`, value: Mh, unit: 'lb·in' },
          ...sec.steps.map((q) => ({
            ...q,
            symbol: `${q.symbol},${n}`,
            label: `${sec.label}, ${lowerFirst(q.label)}`,
          })),
          { symbol: `f_b,${n}`, label: `${sec.label}, bending stress`, value: fb, unit: 'psi' },
        ],
      };
    });
    const gross = { fb: M / S, label: 'Bending stress', x: x + x0 };
    const governing = atHoles.reduce(
      (worst, h) =>
        h.fb > worst.fb
          ? {
              fb: h.fb,
              label: `Bending stress at ${lowerFirst(h.label)}, net section`,
              x: h.a + x0,
            }
          : worst,
      gross,
    );
    const holed = atHoles.length > 0;
    const result: ComputedCheck = {
      ...common,
      formulas: [
        ...factored,
        ...(input.member.plies > 1 ? ['Load per ply = P / n and w / n'] : []),
        'R1 = Σ P·(L − a) / L + w·L / 2, R2 = Σ P·a / L + w·L / 2 (a = distance of each load from the left support)',
        'M(x) = R1·x − w·x² / 2 − Σ P·(x − a) over loads left of x; the largest M is where the shear changes sign',
        'S = b·d² / 6',
        'f_b = M / S',
        ...(holed
          ? [
              'At each hole, S_net is the section modulus of the gross section less the hole, and f_b = M(x) / S_net there',
              'f_b = the largest of these',
            ]
          : []),
        "Fb' = Fb · C_D · C_M · C_t · C_L · C_F · C_fu · C_i · C_r",
        "margin = Fb' / f_b",
      ],
      steps: [
        ...prepared.steps,
        ...reactionSteps,
        { symbol: 'M', label: `Largest moment${per}`, value: M, unit: 'lb·in' },
        { symbol: 'S', label: 'Section modulus', value: S, unit: 'in³' },
        ...adjusted.stabilitySteps,
        {
          symbol: 'x_M',
          label: `Position of largest moment${per}`,
          value: x + x0,
          unit: 'in',
        },
        ...(holed
          ? [
              {
                symbol: 'f_b,M',
                label: 'Bending stress at the largest moment, M / S',
                value: gross.fb,
                unit: 'psi',
              },
              ...atHoles.flatMap((h) => h.steps),
              {
                symbol: 'x_f',
                label: 'Position of the largest bending stress',
                value: governing.x,
                unit: 'in',
              },
            ]
          : []),
      ],
      factors: factorsFor(adjusted, 'Fb'),
      sources: [...SOURCES.superposition, SOURCES.bending, ...(holed ? [SOURCES.netSection] : [])],
      computed: { symbol: 'f_b', label: governing.label, value: governing.fb, unit: 'psi' },
      allowable: {
        symbol: "Fb'",
        label: 'Adjusted bending design value',
        value: adjusted.Fb,
        unit: 'psi',
      },
      margin: adjusted.Fb / governing.fb,
    };
    return result;
  }

  const V = Math.max(R.left, R.right);
  const x0 = input.member.supportsX[0];
  // Shear beside each hole, on its net section (NDS 2024 3.1.2.1) or, where the load hangs from
  // bolts in it, on its effective depth (3.4.4.1).
  const atHoles = shearAreas.map((sec, i) => {
    const n = i + 1;
    const Vh = shearNextTo(L, plyLoads, sec.a);
    const fv = (3 * Vh) / (2 * sec.A);
    return {
      ...sec,
      fv,
      steps: [
        { symbol: `x_h${n}`, label: `${sec.label}, position`, value: sec.a + x0, unit: 'in' },
        {
          symbol: `V_h${n}`,
          label: `${sec.label}, larger shear on either side${per}`,
          value: Vh,
          unit: 'lb',
        },
        ...sec.steps.map((q) => ({
          ...q,
          symbol: `${q.symbol},${n}`,
          label: `${sec.label}, ${lowerFirst(q.label)}`,
        })),
        { symbol: `f_v,${n}`, label: `${sec.label}, shear stress`, value: fv, unit: 'psi' },
      ],
    };
  });
  const gross = { fv: (3 * V) / (2 * b * dd), label: 'Shear stress' };
  const governing = atHoles.reduce(
    (worst, h) =>
      h.fv > worst.fv
        ? {
            fv: h.fv,
            label: `Shear stress at ${lowerFirst(h.label)}, ${h.connection ? 'effective depth' : 'net section'}`,
          }
        : worst,
    gross,
  );
  const holed = atHoles.length > 0;
  const areaFormulas = [...new Set(atHoles.map((h) => h.formula))];
  return {
    ...common,
    assumptions: [
      ...common.assumptions,
      'Loads near the supports are not reduced (NDS 3.4.2.2 permits it for some support conditions; not used).',
    ],
    formulas: [
      ...factored,
      ...(input.member.plies > 1 ? ['Load per ply = P / n and w / n'] : []),
      'R1 = Σ P·(L − a) / L + w·L / 2, R2 = Σ P·a / L + w·L / 2',
      'V = larger of R1 and R2',
      'f_v = 3·V / (2·b·d)',
      ...(holed
        ? [
            'At each hole, V_h = the larger shear just either side of it: R1 − w·x − Σ P over loads left of x, and less the load at the hole',
            ...areaFormulas,
            'f_v = 3·V_h / (2·A_v) there, and f_v = the largest of these',
          ]
        : []),
      "Fv' = Fv · C_D · C_M · C_t · C_i",
      holed
        ? "margin = Fv' / f_v (equal to Vr' / V, with Vr' = 2/3 · Fv' · b · d, or 2/3 · Fv' · A_v at a hole)"
        : "margin = Fv' / f_v (equal to Vr' / V, with Vr' = 2/3 · Fv' · b · d)",
    ],
    steps: [
      ...prepared.steps,
      ...reactionSteps,
      { symbol: 'V', label: `Largest shear${per}`, value: V, unit: 'lb' },
      ...(holed
        ? [
            {
              symbol: 'f_v,V',
              label: 'Shear stress at the largest shear, 3·V / (2·b·d)',
              value: gross.fv,
              unit: 'psi',
            },
            ...atHoles.flatMap((h) => h.steps),
          ]
        : []),
    ],
    factors: factorsFor(adjusted, 'Fv'),
    sources: [
      ...SOURCES.superposition,
      SOURCES.shear,
      ...(atHoles.some((h) => !h.connection) ? [SOURCES.netSection] : []),
      ...(atHoles.some((h) => h.connection) ? [SOURCES.connectionShear] : []),
    ],
    computed: { symbol: 'f_v', label: governing.label, value: governing.fv, unit: 'psi' },
    allowable: {
      symbol: "Fv'",
      label: 'Adjusted shear design value',
      value: adjusted.Fv,
      unit: 'psi',
    },
    margin: adjusted.Fv / governing.fv,
  };
}

function deflectionCheck(
  head: ReturnType<typeof header>,
  input: BeamCheckInput,
  adjusted: AdjustedValues,
  reference: Quantity[],
  assumptions: string[],
): CheckResult {
  const lc = input.deflection;
  const missing = missingFrom(lc.loads, lc.limitRatio);
  if (isMissing(lc.loads) || isMissing(lc.limitRatio))
    return { ...head, status: 'input-needed', missing };
  const prepared = prepare(input.member, lc.loads.value);
  if (typeof prepared === 'string')
    return { ...head, status: 'not-computed', reason: prepared, sources: [] };
  const { L, plyLoads } = prepared;
  const { plyBreadth: b, depth: dd } = input.member;
  const I = (b * dd * dd * dd) / 12;
  const { deltaEI, x } = maxDeflectionTimesEI(L, plyLoads);
  const delta = deltaEI / (adjusted.E * I);
  const N = lc.limitRatio.value;
  const limit = L / N;
  const per = input.member.plies > 1 ? ' per ply' : '';
  return {
    ...head,
    status: 'computed',
    inputs: [
      ...prepared.inputs,
      ...lc.working,
      ...reference,
      {
        symbol: 'N',
        label: 'Deflection limit, span divided by',
        value: N,
        unit: '',
        basis: 'Entered',
        input: lc.limitKey,
      },
    ],
    assumptions: [
      ...assumptions,
      ...lc.assumptions,
      'Tabulated E includes shear deflection (NDS Appendix F.3.1), so bending deflection alone is computed.',
      'Immediate deflection only; long-term creep (NDS 3.5.2) is not included.',
    ],
    formulas: [
      ...(input.member.plies > 1 ? ['Load per ply = P / n and w / n'] : []),
      "For each load P at a (b = L − a): δ(x) = P·b·x·(L² − b² − x²) / (6·E'·I·L) for x ≤ a, mirrored for x ≥ a",
      "For the uniform load w: δ(x) = w·x·(L³ − 2·L·x² + x³) / (24·E'·I)",
      'δ = largest of the summed curves over the span',
      'I = b·d³ / 12',
      "E' = E · C_M · C_t · C_i",
      'Allowed deflection = L / N',
      'margin = (L / N) / δ',
    ],
    steps: [
      ...prepared.steps,
      { symbol: 'I', label: 'Moment of inertia', value: I, unit: 'in⁴' },
      { symbol: "E'", label: 'Adjusted modulus of elasticity', value: adjusted.E, unit: 'psi' },
      {
        symbol: 'x_max',
        label: `Position of largest deflection${per}`,
        value: x + input.member.supportsX[0],
        unit: 'in',
      },
    ],
    factors: factorsFor(adjusted, 'E'),
    sources: [...SOURCES.superposition, SOURCES.deflection, SOURCES.apparentE],
    computed: { symbol: 'δ', label: 'Largest deflection', value: delta, unit: 'in' },
    allowable: { symbol: 'L/N', label: 'Allowed deflection', value: limit, unit: 'in' },
    margin: limit / delta,
  };
}

export interface HardwareCheckInput {
  /** Named by the template, such as 'Rated connector'. */
  subject: string;
  loadCase: string;
  /**
   * The load on one piece of hardware before any factor, with its working. `unfactored` is a part
   * the factor does not multiply, added after it: negative for weight that holds the piece down,
   * such as a frame's own weight on a ground anchor.
   */
  load: Needed<{ value: number; unfactored?: number; working: Quantity[]; assumptions: string[] }>;
  factor?: LoadFactor;
  /** Manufacturer's rated working load for one piece, pounds. */
  rating: Needed<number>;
}

/** Hardware load against the manufacturer's rated working load (DOMAIN.md, Structural checks). */
export function hardwareCheck(input: HardwareCheckInput): CheckResult {
  const head = header('hardware', 'Rated load', input.subject, input.loadCase);
  const { factor } = input;
  const needs = [input.load, ...(factor ? [factor.value] : []), input.rating];
  if (isMissing(input.load) || isMissing(input.rating)) {
    return { ...head, status: 'input-needed', missing: missingFrom(...needs) };
  }
  const load = input.load.value;
  const rating = input.rating.value;
  const unfactored = load.unfactored ?? 0;
  // Rating / (C · load + unfactored) = 1 at C = (rating − unfactored) / load.
  const atMarginOne =
    factor && load.value > 0 && breakEven(factor, Math.max(0, (rating - unfactored) / load.value));
  if (factor && isMissing(factor.value)) {
    return {
      ...head,
      status: 'input-needed',
      missing: factor.value.missing,
      ...(atMarginOne ? { breakEven: atMarginOne } : {}),
    };
  }
  const C = factor && !isMissing(factor.value) ? factor.value.value : undefined;
  const P = load.value * (C ?? 1) + unfactored;
  if (P <= 0) {
    return {
      ...head,
      status: 'not-computed',
      reason:
        'The load on one piece is zero or less under these loads, so there is no margin to report.',
      sources: [],
    };
  }
  return {
    ...head,
    status: 'computed',
    inputs: [
      ...load.working,
      ...(factor && C !== undefined ? [factorQuantity(factor, C)] : []),
      {
        symbol: 'R_rated',
        label: 'Rated working load, one piece',
        value: rating,
        unit: 'lb',
        basis: "Entered from the manufacturer's specification",
      },
    ],
    formulas: [
      ...(factor && C !== undefined
        ? [
            load.unfactored === undefined
              ? `P = ${factor.symbol} · load before the factor`
              : `P = ${factor.symbol} · load before the factor + the part it does not multiply`,
          ]
        : []),
      'margin = rated working load / computed load',
    ],
    steps: [],
    factors: [],
    assumptions: [
      ...load.assumptions,
      "The rating is the manufacturer's working load for this use, installed as the manufacturer specifies.",
    ],
    sources: [],
    computed: { symbol: 'P', label: 'Load on one piece', value: P, unit: 'lb' },
    allowable: { symbol: 'R_rated', label: 'Rated working load', value: rating, unit: 'lb' },
    margin: rating / P,
    ...(atMarginOne ? { breakEven: atMarginOne } : {}),
  };
}

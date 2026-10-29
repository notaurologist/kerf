import { z } from 'zod';
import { referenceRow, type SpeciesGradeId, speciesGrade } from '../design-values/sawnLumber.ts';
import { type Citation, SOURCE_LINKS } from '../design-values/sources.ts';
import { maxDeflectionTimesEI, maxMoment, reactions, type SpanLoads } from './beam.ts';
import { type AdjustedValues, adjustedValues, type ServiceConditions } from './factors.ts';
import {
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

export interface LoadCase {
  /** Named by the template, such as 'Strength: peak load'. */
  name: string;
  loads: Needed<BeamLoads>;
  /** Template inputs and intermediate values behind the loads, shown with every result. */
  working: Quantity[];
  assumptions: string[];
}

export interface BeamCheckInput {
  member: BeamMember;
  material: Needed<MaterialInput>;
  conditions: ServiceConditions;
  /** Bending and shear use this case. */
  strength: LoadCase;
  /** Deflection uses this case, against span / limitRatio. */
  deflection: LoadCase & { limitRatio: Needed<number> };
  /** The template's assumptions about the member and its supports. */
  assumptions: string[];
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
  deflection: nds('3.5.1, p. 22', SOURCE_LINKS.ndsChapter3),
  apparentE: nds('Appendix F.3.1, p. 181', SOURCE_LINKS.ndsAppendix),
  span: nds('3.2.1, p. 17', SOURCE_LINKS.ndsChapter3),
  pressureTreated: nds('4.3.13, p. 32', SOURCE_LINKS.ndsChapter4),
} satisfies Record<string, Citation | Citation[]>;

const BUILT_UP = 'Each ply carries an equal share of every load (decision 0013).';

function header(kind: CheckKind, title: string, subject: string, loadCase: string) {
  return { kind, title, subject, loadCase };
}

/** Missing inputs across several needs, each listed once. */
function missingFrom(...needs: Needed<unknown>[]): MissingInput[] {
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
      bending: { ...h.bending, status: 'input-needed', missing: missingFrom(m, s.loads) },
      shear: { ...h.shear, status: 'input-needed', missing: missingFrom(m, s.loads) },
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
      [SOURCES.pressureTreated],
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

function factorsFor(adjusted: AdjustedValues, value: 'Fb' | 'Fv' | 'E') {
  return adjusted.factors.filter((f) => f.appliesTo.includes(value));
}

function strengthCheck(
  which: 'bending' | 'shear',
  head: ReturnType<typeof header>,
  input: BeamCheckInput,
  adjusted: AdjustedValues,
  reference: Quantity[],
  assumptions: string[],
): CheckResult {
  const lc = input.strength;
  if (isMissing(lc.loads)) return { ...head, status: 'input-needed', missing: lc.loads.missing };
  const prepared = prepare(input.member, lc.loads.value);
  if (typeof prepared === 'string')
    return { ...head, status: 'not-computed', reason: prepared, sources: [] };
  const { L, plyLoads } = prepared;
  const { plyBreadth: b, depth: dd } = input.member;
  const R = reactions(L, plyLoads);
  const per = input.member.plies > 1 ? ' per ply' : '';
  const reactionSteps: Quantity[] = [
    { symbol: 'R1', label: `Left reaction${per}`, value: R.left, unit: 'lb' },
    { symbol: 'R2', label: `Right reaction${per}`, value: R.right, unit: 'lb' },
  ];
  const common = {
    ...head,
    status: 'computed' as const,
    inputs: [...prepared.inputs, ...lc.working, ...reference],
    assumptions: [...assumptions, ...lc.assumptions],
  };

  if (which === 'bending') {
    const { M, x } = maxMoment(L, plyLoads);
    const S = (b * dd * dd) / 6;
    const fb = M / S;
    const result: ComputedCheck = {
      ...common,
      formulas: [
        ...(input.member.plies > 1 ? ['Load per ply = P / n and w / n'] : []),
        'R1 = Σ P·(L − a) / L + w·L / 2, R2 = Σ P·a / L + w·L / 2 (a = distance of each load from the left support)',
        'M(x) = R1·x − w·x² / 2 − Σ P·(x − a) over loads left of x; the largest M is where the shear changes sign',
        'S = b·d² / 6',
        'f_b = M / S',
        "Fb' = Fb · C_D · C_M · C_t · C_L · C_F · C_fu · C_i · C_r",
        "margin = Fb' / f_b",
      ],
      steps: [
        ...prepared.steps,
        ...reactionSteps,
        {
          symbol: 'M',
          label: `Largest moment${per}, at ${(x + input.member.supportsX[0]).toFixed(3)} in`,
          value: M,
          unit: 'lb·in',
        },
        { symbol: 'S', label: 'Section modulus', value: S, unit: 'in³' },
        ...adjusted.stabilitySteps,
      ],
      factors: factorsFor(adjusted, 'Fb'),
      sources: [...SOURCES.superposition, SOURCES.bending],
      computed: { symbol: 'f_b', label: 'Bending stress', value: fb, unit: 'psi' },
      allowable: {
        symbol: "Fb'",
        label: 'Adjusted bending design value',
        value: adjusted.Fb,
        unit: 'psi',
      },
      margin: adjusted.Fb / fb,
    };
    return result;
  }

  const V = Math.max(R.left, R.right);
  const fv = (3 * V) / (2 * b * dd);
  return {
    ...common,
    assumptions: [
      ...common.assumptions,
      'Loads near the supports are not reduced (NDS 3.4.2.2 permits it for some support conditions; not used).',
    ],
    formulas: [
      ...(input.member.plies > 1 ? ['Load per ply = P / n and w / n'] : []),
      'R1 = Σ P·(L − a) / L + w·L / 2, R2 = Σ P·a / L + w·L / 2',
      'V = larger of R1 and R2',
      'f_v = 3·V / (2·b·d)',
      "Fv' = Fv · C_D · C_M · C_t · C_i",
      "margin = Fv' / f_v (equal to Vr' / V, with Vr' = 2/3 · Fv' · b · d)",
    ],
    steps: [
      ...prepared.steps,
      ...reactionSteps,
      { symbol: 'V', label: `Largest shear${per}`, value: V, unit: 'lb' },
    ],
    factors: factorsFor(adjusted, 'Fv'),
    sources: [...SOURCES.superposition, SOURCES.shear],
    computed: { symbol: 'f_v', label: 'Shear stress', value: fv, unit: 'psi' },
    allowable: {
      symbol: "Fv'",
      label: 'Adjusted shear design value',
      value: adjusted.Fv,
      unit: 'psi',
    },
    margin: adjusted.Fv / fv,
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
  /** Named by the template, such as 'Joist hanger'. */
  subject: string;
  loadCase: string;
  /** The load on one piece of hardware, with its working. */
  load: Needed<{ value: number; working: Quantity[]; assumptions: string[] }>;
  /** Manufacturer's rated working load for one piece, pounds. */
  rating: Needed<number>;
}

/** Hardware load against the manufacturer's rated working load (DOMAIN.md, Structural checks). */
export function hardwareCheck(input: HardwareCheckInput): CheckResult {
  const head = header('hardware', 'Rated load', input.subject, input.loadCase);
  if (isMissing(input.load) || isMissing(input.rating)) {
    return { ...head, status: 'input-needed', missing: missingFrom(input.load, input.rating) };
  }
  const load = input.load.value;
  const rating = input.rating.value;
  return {
    ...head,
    status: 'computed',
    inputs: [
      ...load.working,
      {
        symbol: 'R_rated',
        label: 'Rated working load, one piece',
        value: rating,
        unit: 'lb',
        basis: "Entered from the manufacturer's specification",
      },
    ],
    formulas: ['margin = rated working load / computed load'],
    steps: [],
    factors: [],
    assumptions: [
      ...load.assumptions,
      "The rating is the manufacturer's working load for this use, installed as the manufacturer specifies.",
    ],
    sources: [],
    computed: { symbol: 'P', label: 'Load on one piece', value: load.value, unit: 'lb' },
    allowable: { symbol: 'R_rated', label: 'Rated working load', value: rating, unit: 'lb' },
    margin: rating / load.value,
  };
}

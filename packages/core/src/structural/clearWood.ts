import { CREEP, type CreepCondition } from '../design-values/adjustmentFactors.ts';
import { type Citation, SOURCE_LINKS } from '../design-values/sources.ts';
import { woodSpecies } from '../design-values/woodSpecies.ts';
import { maxDeflectionTimesEI, type SpanLoads } from './beam.ts';
import type { BeamChecks, BeamLoads } from './checks.ts';
import { type CheckResult, isMissing, type Needed, type Quantity } from './types.ts';

// Deflection of a member with no design values, such as a cherry shelf (DOMAIN.md, Structural
// checks, Members without design values). E is the clear-wood average from the Wood Handbook,
// with no NDS adjustment factors. Bending and shear are not computed: clear-wood strength is not
// an allowable stress, so they are on the checklist. Long-term loads deflect K_cr times their
// immediate deflection (NDS 3.5.2); the curves are superposed, so the largest total is exact.

const CHAPTER_5 = 'https://research.fs.usda.gov/treesearch/62244';

const SOURCES = {
  superposition: {
    source: 'awc-da6',
    locator: 'Figure 8, Simple Beam, Concentrated Load at Any Point, p. 7; Figure 1, p. 4',
  },
  deflection: {
    source: 'nds-2024',
    locator: '3.5.1, p. 22',
    url: SOURCE_LINKS.ndsChapter3,
  },
  clearWood: {
    source: 'fpl-gtr-282',
    locator: 'Chapter 5, Mechanical Properties of Clear Straight-Grained Wood, p. 5-21',
    url: CHAPTER_5,
  },
  moisture: {
    source: 'fpl-gtr-282',
    locator: 'Chapter 5, Moisture Content, p. 5-34',
    url: CHAPTER_5,
  },
  creep: {
    source: 'fpl-gtr-282',
    locator: 'Chapter 5, Creep and Relaxation, p. 5-39',
    url: CHAPTER_5,
  },
} satisfies Record<string, Citation>;

/** A member described by its actual size, such as a panel laid flat. */
export interface ClearWoodMember {
  /** Named by the template, such as 'Bottom shelf'. */
  subject: string;
  /** Horizontal and vertical size, inches: for a shelf, its depth front to back and its thickness. */
  breadth: number;
  depth: number;
  /** Where the sizes come from, such as 'Panel size from the template'. */
  sizeBasis: string;
  /** Support positions in the same coordinates as the loads. */
  supportsX: [number, number];
}

export interface ClearWoodDeflectionInput {
  member: ClearWoodMember;
  /** A species from the furniture species data. */
  species: Needed<string>;
  creep: CreepCondition;
  loadCase: {
    name: string;
    /** Loads that stay for years, such as records on a shelf. */
    longTerm: Needed<BeamLoads>;
    /** Loads that come and go. */
    shortTerm: BeamLoads;
    working: Quantity[];
    assumptions: string[];
    limitRatio: Needed<number>;
    /** The input the limit is entered in. */
    limitKey: string;
  };
  assumptions: string[];
}

function header(kind: CheckResult['kind'], title: string, subject: string, loadCase: string) {
  return { kind, title, subject, loadCase };
}

function toSpan(loads: BeamLoads, x0: number, scale: number): SpanLoads {
  return {
    points: loads.points.map((l) => ({ a: l.x - x0, P: l.P * scale })),
    w: (loads.uniform?.w ?? 0) * scale,
  };
}

function sum(a: SpanLoads, b: SpanLoads): SpanLoads {
  return { points: [...a.points, ...b.points], w: a.w + b.w };
}

function loadQuantities(loads: BeamLoads, term: string): Quantity[] {
  return [
    ...(loads.uniform
      ? [
          {
            symbol: `w_${term}`,
            label: `${loads.uniform.label}, over the span`,
            value: loads.uniform.w,
            unit: 'lb/in',
          },
        ]
      : []),
    ...loads.points.flatMap((l, i) => [
      { symbol: `x_${term}${i + 1}`, label: `${l.label}, position`, value: l.x, unit: 'in' },
      { symbol: `P_${term}${i + 1}`, label: `${l.label}, load`, value: l.P, unit: 'lb' },
    ]),
  ];
}

/** Deflection of a member with no design values; bending and shear go on the checklist. */
export function clearWoodChecks(input: ClearWoodDeflectionInput): BeamChecks {
  const { member, loadCase: lc } = input;
  const h = {
    bending: header('beam-bending', 'Bending', member.subject, lc.name),
    shear: header('beam-shear', 'Shear', member.subject, lc.name),
    deflection: header('beam-deflection', 'Deflection', member.subject, lc.name),
  };
  const onChecklist = (head: typeof h.bending, what: string): CheckResult => ({
    ...head,
    status: 'not-computed',
    reason: `No design values exist for this member's lumber, and clear-wood strength is not an allowable stress, so ${what} is on the checklist instead.`,
    sources: [SOURCES.clearWood],
  });
  const bending = onChecklist(h.bending, 'bending');
  const shear = onChecklist(h.shear, 'shear');

  const s = input.species;
  const n = lc.limitRatio;
  const lt = lc.longTerm;
  if (isMissing(s) || isMissing(lt) || isMissing(n)) {
    const needs: Needed<unknown>[] = [s, lt, n];
    const all = needs.flatMap((x) => (isMissing(x) ? x.missing : []));
    const missing = all.filter((m, i) => all.findIndex((o) => o.key === m.key) === i);
    return { bending, shear, deflection: { ...h.deflection, status: 'input-needed', missing } };
  }
  const species = woodSpecies(s.value);
  if (!species) throw new Error(`Unknown species: ${s.value}`);

  const [x0, x1] = member.supportsX;
  const L = x1 - x0;
  const outside = [...lt.value.points, ...lc.shortTerm.points].find((l) => l.x <= x0 || l.x >= x1);
  if (outside) {
    return {
      bending,
      shear,
      deflection: {
        ...h.deflection,
        status: 'not-computed',
        reason: `${outside.label} at x = ${outside.x} is not between the supports; only loads between supports are checked.`,
        sources: [],
      },
    };
  }

  const { K_cr, description } = CREEP[input.creep];
  const E = species.clearWood.E;
  const { breadth: b, depth: d } = member;
  const I = (b * d * d * d) / 12;
  const longTerm = toSpan(lt.value, x0, 1);
  const immediateLT = maxDeflectionTimesEI(L, longTerm).deltaEI / (E * I);
  const total = maxDeflectionTimesEI(
    L,
    sum(toSpan(lt.value, x0, K_cr), toSpan(lc.shortTerm, x0, 1)),
  );
  const delta = total.deltaEI / (E * I);
  const N = n.value;
  const limit = L / N;

  return {
    bending,
    shear,
    deflection: {
      ...h.deflection,
      status: 'computed',
      inputs: [
        {
          symbol: 'L',
          label: 'Span between support centerlines',
          value: L,
          unit: 'in',
          basis: 'From the template geometry',
        },
        { symbol: 'b', label: 'Breadth', value: b, unit: 'in', basis: member.sizeBasis },
        { symbol: 'd', label: 'Depth', value: d, unit: 'in', basis: member.sizeBasis },
        ...loadQuantities(lt.value, 'LT'),
        ...loadQuantities(lc.shortTerm, 'ST'),
        ...lc.working,
        {
          symbol: 'E',
          label: `Modulus of elasticity, ${species.name}, clear wood at 12% moisture content`,
          value: E,
          unit: 'psi',
          basis: 'Table 5-3b',
          sources: species.clearWood.sources,
        },
        {
          symbol: 'K_cr',
          label: `Creep factor, ${description.toLowerCase()}`,
          value: K_cr,
          unit: '',
          basis: 'NDS 3.5.2',
          sources: [...CREEP.sources],
        },
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
        ...input.assumptions,
        ...lc.assumptions,
        'Simply supported between the two supports.',
        'E is the average for small, clear, straight-grained specimens; boards with knots or cross grain may be less stiff.',
        'E includes shear deflection, so bending deflection alone is computed.',
        'E is at 12% moisture content; most properties increase as wood dries below that, so drier indoor wood is stiffer.',
        'No NDS adjustment factors apply to a clear-wood value.',
      ],
      formulas: [
        'For each load P at a (b = L − a): δ(x) = P·b·x·(L² − b² − x²) / (6·E·I·L) for x ≤ a, mirrored for x ≥ a',
        'For the uniform load w: δ(x) = w·x·(L³ − 2·L·x² + x³) / (24·E·I)',
        'Δ_T(x) = K_cr · Δ_LT(x) + Δ_ST(x); δ = largest Δ_T over the span',
        'I = b·d³ / 12',
        'Allowed deflection = L / N',
        'margin = (L / N) / δ',
      ],
      steps: [
        { symbol: 'I', label: 'Moment of inertia', value: I, unit: 'in⁴' },
        {
          symbol: 'Δ_LT',
          label: 'Largest immediate deflection from the long-term loads',
          value: immediateLT,
          unit: 'in',
        },
        {
          symbol: 'x_max',
          label: 'Position of largest deflection',
          value: total.x + x0,
          unit: 'in',
        },
      ],
      factors: [],
      sources: [
        SOURCES.superposition,
        SOURCES.deflection,
        ...CREEP.sources,
        ...species.clearWood.sources,
        SOURCES.clearWood,
        SOURCES.moisture,
        SOURCES.creep,
      ],
      computed: {
        symbol: 'δ',
        label: 'Largest deflection, long-term',
        value: delta,
        unit: 'in',
      },
      allowable: { symbol: 'L/N', label: 'Allowed deflection', value: limit, unit: 'in' },
      margin: limit / delta,
    },
  };
}

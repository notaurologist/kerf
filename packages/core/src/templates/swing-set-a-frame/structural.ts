import { z } from 'zod';
import { DENSITY_SOURCES, woodDensity } from '../../design-values/density.ts';
import { referenceRow, SPECIES_GRADE_IDS, speciesGrade } from '../../design-values/sawnLumber.ts';
import type { Citation } from '../../design-values/sources.ts';
import { STOCK_SIZE_SOURCES, stock } from '../../lumber/stock.ts';
import type { FieldRef } from '../../model/form.ts';
import { ChecklistItem, type Issue } from '../../model/types.ts';
import { reactions } from '../../structural/beam.ts';
import { boltHoleDiameter } from '../../structural/boltHoles.ts';
import {
  BeamChecks,
  beamChecks,
  hardwareCheck,
  type LoadCase,
  type LoadFactor,
  type MemberHoles,
  type PointLoad,
} from '../../structural/checks.ts';
import { type AxialLoad, type ColumnAxis, columnCheck } from '../../structural/column.ts';
import type { ServiceConditions } from '../../structural/factors.ts';
import type { SectionHole } from '../../structural/netSection.ts';
import {
  type CheckKind,
  CheckResult,
  mapNeeded,
  type Needed,
  need,
  type Quantity,
} from '../../structural/types.ts';
import { formatLength } from '../../units/length.ts';
import { dimensions } from './geometry.ts';
import { ANCHOR_RATING, ANCHORS_PER_FOOT, HANGER_BOLTS } from './hardware.ts';
import type { SwingSetOutput } from './template.ts';
import { LEG_IDS } from './validate.ts';

// The swing set's structural model (DOMAIN.md, Swing set specifics, Loads; spec, Structural
// model). It turns the template output and the owner's structural inputs into loads, load cases,
// and conditions of use for the generic checks, plus the confirmation checklist.

/**
 * Structural inputs. Every one changes the answer, so none has a default (decision 0001); a
 * missing input makes the checks that need it report "input needed".
 */
export const SwingSetStructuralInputs = z
  .object({
    beamSpeciesGrade: z.enum(SPECIES_GRADE_IDS),
    /** Whether the beam lumber is incised (small cuts along the faces from pressure treatment). */
    beamIncised: z.boolean(),
    /**
     * Beam moisture content in service, percent of oven-dry weight, for the beam's own weight.
     * Pressure-treated lumber is often sold above 30%.
     */
    beamMoistureContent: z.number().min(0).max(100),
    /**
     * Heaviest rider expected on each swing, including the seat and chain, left swing first,
     * pounds. 0 for a swing left empty.
     */
    riderWeights: z
      .tuple([z.number().min(0).max(500), z.number().min(0).max(500)])
      .refine(([a, b]) => a + b > 0, 'At least one swing needs a rider.'),
    /** Largest angle the chains swing to, from vertical, degrees. */
    maxSwingAngle: z.number().min(0).max(90),
    /**
     * Multiplier on the pendulum load for snap loads, chosen with an experienced builder against
     * the factor at which each strength check reaches margin 1.0.
     */
    dynamicFactor: z.number().min(1).max(5),
    /** Deflection limit as span divided by this number. */
    deflectionLimit: z.number().min(60).max(1000),
    /** Manufacturer's rated working load for one swing hanger, pounds. */
    hangerRating: z.number().positive(),
    legSpeciesGrade: z.enum(SPECIES_GRADE_IDS),
    /** Whether the leg lumber is incised. */
    legIncised: z.boolean(),
  })
  .partial();

export type SwingSetStructuralInputs = z.infer<typeof SwingSetStructuralInputs>;

/** What each structural input is called, in forms and in "input needed" lists. */
export const STRUCTURAL_INPUT_LABELS = {
  beamSpeciesGrade: 'Beam species and grade',
  beamIncised: 'Whether the beam lumber is incised',
  beamMoistureContent: 'Beam moisture content',
  riderWeights: 'Heaviest rider on each swing, with seat and chain',
  maxSwingAngle: 'Maximum swing angle',
  dynamicFactor: 'Dynamic factor',
  deflectionLimit: 'Deflection limit (span divided by)',
  hangerRating: 'Swing hanger rated working load',
  legSpeciesGrade: 'Leg species and grade',
  legIncised: 'Whether the leg lumber is incised',
} as const satisfies Record<keyof SwingSetStructuralInputs, string>;

function combine<A, B, U>(a: Needed<A>, b: Needed<B>, f: (a: A, b: B) => U): Needed<U> {
  if ('value' in a && 'value' in b) return { value: f(a.value, b.value) };
  return { missing: [...('missing' in a ? a.missing : []), ...('missing' in b ? b.missing : [])] };
}

const LOAD_CASES = {
  strength: 'Strength: swing load times the dynamic factor',
  deflection: 'Deflection: swing load without the dynamic factor',
} as const;

const SWING_ASSUMPTIONS = [
  'Smooth pendulum: chain tension at the bottom of the arc is W·(3 − 2·cos θ) for a rider of weight W swinging to θ from vertical.',
  'Both swings are at the bottom of their arcs at the same time (riders in sync), so their loads add.',
  "Each swing's load is split equally between its two hangers (a centered rider).",
];

/**
 * The pendulum load: released from rest at θ, a rider reaches the bottom with v² = 2gL(1 − cos θ)
 * (Example 8.7), and the chain then carries the weight plus the centripetal force mv²/L (6.3):
 * T = W + 2W(1 − cos θ) = W(3 − 2·cos θ).
 */
const PENDULUM_SOURCES = [
  {
    source: 'openstax-university-physics-1',
    locator: '8.3, Example 8.7, Simple Pendulum',
    url: 'https://openstax.org/books/university-physics-volume-1/pages/8-3-conservation-of-energy',
  },
  {
    source: 'openstax-university-physics-1',
    locator: '6.3, Centripetal Force',
    url: 'https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force',
  },
] satisfies Citation[];

/** Chain tension factor at the bottom of the arc: 3 − 2·cos θ. */
export function pendulumFactor(maxSwingAngle: number): number {
  return 3 - 2 * Math.cos((maxSwingAngle * Math.PI) / 180);
}

interface SwingLoads {
  /** Pendulum load per hanger, left to right, without the dynamic factor. */
  perHanger: number[];
  working: Quantity[];
}

function swingLoads(riderWeights: [number, number], maxSwingAngle: number): SwingLoads {
  const k = pendulumFactor(maxSwingAngle);
  const [T1, T2] = riderWeights.map((W) => W * k) as [number, number];
  return {
    perHanger: [T1 / 2, T1 / 2, T2 / 2, T2 / 2],
    working: [
      {
        symbol: 'W1',
        label: 'Rider on left swing, with seat and chain',
        value: riderWeights[0],
        unit: 'lb',
        basis: 'Entered',
        input: 'riderWeights.0',
      },
      {
        symbol: 'W2',
        label: 'Rider on right swing, with seat and chain',
        value: riderWeights[1],
        unit: 'lb',
        basis: 'Entered',
        input: 'riderWeights.1',
      },
      {
        symbol: 'θ',
        label: 'Maximum swing angle',
        value: maxSwingAngle,
        unit: '°',
        basis: 'Entered',
        input: 'maxSwingAngle',
      },
      {
        symbol: '3 − 2·cos θ',
        label: 'Chain tension per pound of rider',
        value: k,
        unit: '',
        basis: 'Smooth pendulum, from conservation of energy and the centripetal force',
        sources: PENDULUM_SOURCES,
      },
      { symbol: 'T1', label: 'Left swing chain tension, W1·(3 − 2·cos θ)', value: T1, unit: 'lb' },
      { symbol: 'T2', label: 'Right swing chain tension, W2·(3 − 2·cos θ)', value: T2, unit: 'lb' },
    ],
  };
}

const HANGER_LABELS = [
  'Left swing, left hanger',
  'Left swing, right hanger',
  'Right swing, left hanger',
  'Right swing, right hanger',
];

function pointLoads(hangersX: readonly number[], perHanger: number[]): PointLoad[] {
  return hangersX.map((x, i) => ({
    x,
    P: perHanger[i] ?? 0,
    label: HANGER_LABELS[i] ?? `Hanger ${i + 1}`,
  }));
}

/** Conditions of use for the top beam (DOMAIN.md, Swing set specifics, Service conditions). */
const BEAM_CONDITIONS: ServiceConditions = {
  wet: {
    value: true,
    reason: 'The beam is outdoors and uncovered, so its moisture content can stay above 19%.',
  },
  temperature: {
    value: 'up-to-100F',
    reason: 'Outdoor air temperature; no sustained exposure above 100°F.',
  },
  loadDuration: {
    value: 'ten-years',
    reason:
      'C_D = 1.0: the impact increase is not used, and factors above 1.6 do not apply to lumber treated with water-borne preservatives (NDS 4.3.13 and Table 2.3.2, footnote 2).',
  },
  repetitive: {
    value: false,
    reason: 'A single beam; the repetitive member factor needs three or more members sharing load.',
  },
  waterborneTreatment: true,
};

/** Conditions of use for the legs, which stand outdoors in or on the ground. */
const LEG_CONDITIONS: ServiceConditions = {
  ...BEAM_CONDITIONS,
  wet: {
    value: true,
    reason:
      'The legs are outdoors and stand in or on the ground, so their moisture content can stay above 19%.',
  },
};

export const SwingSetStructuralReview = z.object({
  inputs: SwingSetStructuralInputs,
  beam: BeamChecks,
  /** The most heavily loaded hanger against its rating. */
  hanger: CheckResult,
  /**
   * On pads, one ground anchor at the foot that lifts most against its rated pull-out (version
   * 29). Absent for buried legs, and in plans stored before it.
   */
  anchors: CheckResult.optional(),
  /** The longer leg as a column. Plans stored before this check have none. */
  legs: CheckResult.optional(),
  checklist: z.array(ChecklistItem),
});
export type SwingSetStructuralReview = z.infer<typeof SwingSetStructuralReview>;

export type ReviewResult =
  | { ok: true; review: SwingSetStructuralReview }
  | { ok: false; issues: Issue[] };

/**
 * Where the beam bears on each frame (spec, Structural model): the middle of the part of the
 * gusset's top edge under the beam, which is the whole thickness gt unless the frame inset e is
 * less. With no gusset under the beam (e = 0), the beam hangs on the leg-to-beam bolts.
 */
export function beamSupports(output: SwingSetOutput): {
  x: [number, number];
  on: 'gusset' | 'bolt';
} {
  const p = output.params;
  const e = p.frameInset;
  const bearing = Math.min(stock(p.gussetStock).thickness, e);
  if (bearing <= 0) return { x: output.geometry.supportsX, on: 'bolt' };
  return { x: [e - bearing / 2, p.beamLength - e + bearing / 2], on: 'gusset' };
}

function supportAssumptions(supports: ReturnType<typeof beamSupports>): string[] {
  const [x0, x1] = supports.x;
  const at = `${formatLength(x0)} and ${formatLength(x1)} from the left end`;
  if (supports.on === 'bolt') {
    return [
      `Supported at the leg-to-beam bolts, ${at}. The frames sit at the beam's ends, so no gusset is under the beam.`,
    ];
  }
  return [
    `Supported at the middle of each gusset's top edge under the beam, ${at}. The beam rests on the gussets, and the leg-to-beam bolts sit in holes 1/16" larger than the bolt, so the gussets take the beam's weight and the swing loads first.`,
    "NDS 2024 3.2.1 takes the span from face to face of the supports plus half the bearing length needed at each end. That bearing can be no longer than the gusset's, so the span to the middle of each gusset is the longest it allows and gives the largest bending moment.",
  ];
}

/** The hanger mounting's field label, which bending and shear name while it is needed. */
export const HANGER_MOUNTING_LABEL = 'Swing hanger mounting';
const HANGER_MOUNTING = { key: 'hardware.hangerMounting', label: HANGER_MOUNTING_LABEL };

/**
 * The holes the hangers' bolts bore through the beam, one at each hanger (spec, Structural model,
 * Beam). Missing until the mounting is entered; a mounting other than bolts has no net section
 * Kerf can work out.
 */
function hangerHoles(output: SwingSetOutput): MemberHoles {
  const p = output.params;
  const m = p.hardware.hangerMounting;
  if (m === undefined) return { missing: [HANGER_MOUNTING] };
  if (m.kind === 'other') {
    return {
      reason:
        'The swing hangers are fastened some other way than with bolts, so Kerf cannot work out how much of the beam their holes remove at each hanger, where the moment is largest and, at the outer hangers, the shear nearly so. NDS 2024 3.1.2.1 takes bending and shear on that net section. Ask an experienced builder to check the beam at the hangers.',
    };
  }
  const D = boltHoleDiameter(m.diameter);
  const bw = p.beamPlies * stock(p.beamStock).thickness;
  const hole: SectionHole =
    m.kind === 'vertical-bolt'
      ? { kind: 'through-depth', diameter: D, center: bw / 2 }
      : { kind: 'through-breadth', diameter: D, height: m.holeHeight };
  return {
    value: output.swings.hangersX.map((x, i) => ({
      x,
      label: `${HANGER_LABELS[i] ?? `Hanger ${i + 1}`} hole`,
      hole,
      // The seat hangs from bolts across the beam; a bolt down through it bears on the top instead.
      ...(m.kind === 'horizontal-bolts'
        ? { hung: { fromEnd: Math.min(x, p.beamLength - x) } }
        : {}),
    })),
  };
}

function hangerHoleAssumptions(output: SwingSetOutput): string[] {
  const p = output.params;
  const m = p.hardware.hangerMounting;
  if (m === undefined || m.kind === 'other') return [];
  const hole = formatLength(boltHoleDiameter(m.diameter));
  const where =
    m.kind === 'vertical-bolt'
      ? `Each hanger's bolt goes down through the beam on its centerline, in a ${hole} hole (the bolt plus 1/16", NDS 2024 12.1.3.2). Its washer bears on the beam's top, so bending and shear are taken on the net section there.`
      : `Each hanger's bolts cross the beam in one row, ${formatLength(m.holeHeight)} above its bottom, in ${hole} holes (the bolt plus 1/16", NDS 2024 12.1.3.2). Bending is taken at the hanger's position with one hole in the section; bolts one above another are not covered. The seat hangs from the bolts, so shear there is taken on the beam's depth below them (NDS 2024 3.4.4.1).`;
  return [
    where,
    ...(p.beamPlies > 1 && m.kind === 'vertical-bolt'
      ? [
          'The hole is taken from the ply it cuts most, which still carries an equal share of the load.',
        ]
      : []),
    "Deflection uses the beam's gross section; the holes are not deducted from its stiffness.",
  ];
}

/** Structural review for a generated swing set and the owner's structural inputs. */
export function structuralReview(output: SwingSetOutput, input: unknown): ReviewResult {
  const parsed = SwingSetStructuralInputs.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: `invalid-${issue.code}`,
        message: issue.message,
        params: issue.path.length > 0 ? [String(issue.path[0])] : [],
      })),
    };
  }
  const inputs = parsed.data;
  const p = output.params;
  const beam = stock(p.beamStock);
  const supports = beamSupports(output);
  const [x0, x1] = supports.x;
  const hangersX = output.swings.hangersX;

  const swing = mapNeeded(
    need(inputs, STRUCTURAL_INPUT_LABELS, 'riderWeights', 'maxSwingAngle'),
    (v) => swingLoads(v.riderWeights, v.maxSwingAngle),
  );
  // Applied by the strength checks to the swing loads only, which also report the factor at which
  // their margin reaches 1.0 (#401).
  const dynamicFactor: LoadFactor = {
    key: 'dynamicFactor',
    symbol: 'C_dyn',
    label: STRUCTURAL_INPUT_LABELS.dynamicFactor,
    basis: 'Entered',
    value: mapNeeded(
      need(inputs, STRUCTURAL_INPUT_LABELS, 'dynamicFactor'),
      (v) => v.dynamicFactor,
    ),
  };

  // The beam's own weight, from its density at the entered moisture content. With no design values
  // for the size there is no G either; the beam checks then report that.
  const beamWeight = mapNeeded(
    need(inputs, STRUCTURAL_INPUT_LABELS, 'beamSpeciesGrade', 'beamMoistureContent'),
    (v) => {
      const row = referenceRow(v.beamSpeciesGrade, p.beamStock);
      if (!row) return null;
      const density = woodDensity(row.values.G, v.beamMoistureContent);
      const area = p.beamPlies * beam.thickness * beam.width;
      const w = (density * area) / 1728;
      const working: Quantity[] = [
        {
          symbol: 'MC',
          label: 'Beam moisture content',
          value: v.beamMoistureContent,
          unit: '%',
          basis: 'Entered',
          input: 'beamMoistureContent',
        },
        {
          symbol: 'G',
          label: 'Specific gravity, oven-dry',
          value: row.values.G,
          unit: '',
          basis: `Table 4B, ${row.label}`,
          sources: speciesGrade(v.beamSpeciesGrade).sources,
        },
        {
          symbol: 'ρ',
          label: 'Beam density at that moisture content',
          value: density,
          unit: 'lb/ft³',
          sources: DENSITY_SOURCES,
        },
        { symbol: 'A', label: 'Beam cross-section, all plies', value: area, unit: 'in²' },
        { symbol: 'w', label: 'Beam weight, ρ·A / 1728', value: w, unit: 'lb/in' },
      ];
      return { w, working };
    },
  );
  const withWeight = <T extends { perHanger: number[]; working: Quantity[] }>(l: Needed<T>) =>
    combine(l, beamWeight, (loads, weight) => ({
      points: pointLoads(hangersX, loads.perHanger),
      ...(weight ? { uniform: { w: weight.w, label: "Beam's own weight" } } : {}),
      working: [...loads.working, ...(weight?.working ?? [])],
    }));
  const swingBeam = withWeight(swing);

  const strength: LoadCase = {
    name: LOAD_CASES.strength,
    loads: mapNeeded(swingBeam, ({ points, uniform }) => ({ points, uniform })),
    factor: dynamicFactor,
    working: 'value' in swingBeam ? swingBeam.value.working : [],
    assumptions: [
      ...SWING_ASSUMPTIONS,
      "The dynamic factor covers snap loads from slack chains, which exceed the smooth pendulum load. It is not applied to the beam's own weight.",
    ],
  };
  const deflection: LoadCase & { limitRatio: Needed<number>; limitKey: string } = {
    name: LOAD_CASES.deflection,
    loads: mapNeeded(swingBeam, ({ points, uniform }) => ({ points, uniform })),
    working: 'value' in swingBeam ? swingBeam.value.working : [],
    assumptions: [
      ...SWING_ASSUMPTIONS,
      'Deflection describes normal use, so the dynamic factor is not applied.',
    ],
    limitRatio: mapNeeded(
      need(inputs, STRUCTURAL_INPUT_LABELS, 'deflectionLimit'),
      (v) => v.deflectionLimit,
    ),
    limitKey: 'deflectionLimit',
  };

  const beamResult = beamChecks({
    member: {
      subject:
        p.beamPlies > 1
          ? `Top beam, ${p.beamPlies} plies of ${p.beamStock}`
          : `Top beam, ${p.beamStock}`,
      nominal: p.beamStock,
      plies: p.beamPlies,
      plyBreadth: beam.thickness,
      depth: beam.width,
      sizeSources: STOCK_SIZE_SOURCES,
      supportsX: [x0, x1],
      unbracedLength: x1 - x0,
    },
    material: mapNeeded(
      need(inputs, STRUCTURAL_INPUT_LABELS, 'beamSpeciesGrade', 'beamIncised'),
      (v) => ({
        speciesGrade: v.beamSpeciesGrade,
        incised: v.beamIncised,
      }),
    ),
    conditions: BEAM_CONDITIONS,
    strength,
    deflection,
    holes: hangerHoles(output),
    assumptions: [
      ...supportAssumptions(supports),
      ...hangerHoleAssumptions(output),
      'Each A-frame holds the beam against rotation at its support (legs bolted against both faces, gusset underneath), so the unbraced length is the span.',
      "The beam's own weight acts as a uniform load over the span, from its density at the entered moisture content; seats and chains are in the rider weights.",
    ],
  });

  const hanger = hardwareCheck({
    subject: 'Swing hanger',
    loadCase: LOAD_CASES.strength,
    load: mapNeeded(swing, (l) => {
      const P = Math.max(...l.perHanger);
      return {
        value: P,
        working: [
          ...l.working,
          {
            symbol: 'T / 2',
            label: 'Smooth swing load on the most loaded hanger',
            value: P,
            unit: 'lb',
          },
        ],
        assumptions: [...SWING_ASSUMPTIONS],
      };
    }),
    factor: dynamicFactor,
    rating: mapNeeded(need(inputs, STRUCTURAL_INPUT_LABELS, 'hangerRating'), (v) => v.hangerRating),
  });

  const anchors =
    p.burialDepth === 0
      ? anchorCheck(output, inputs, supports.x, beamWeight, dynamicFactor)
      : undefined;
  const legs = legColumn(output, inputs, swing, beamWeight, dynamicFactor);

  return {
    ok: true,
    review: {
      inputs,
      beam: beamResult,
      hanger,
      ...(anchors ? { anchors } : {}),
      legs,
      checklist: checklist(output),
    },
  };
}

/** The anchor check's subject, which `checkFields` tells it apart from the hanger by. */
const ANCHOR_SUBJECT = 'Ground anchor';

const RAD = Math.PI / 180;

/**
 * The smallest value of `f` on [lo, hi]: the least of 90 evenly spaced samples, then golden-section
 * search between its neighbors. `f` has one minimum on the interval for every foot and angle.
 */
function minimize(f: (x: number) => number, lo: number, hi: number): { x: number; value: number } {
  const steps = 90;
  const at = (i: number) => lo + ((hi - lo) * i) / steps;
  let best = 0;
  for (let i = 1; i <= steps; i++) if (f(at(i)) < f(at(best))) best = i;
  let a = at(Math.max(0, best - 1));
  let b = at(Math.min(steps, best + 1));
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 100; i++) {
    const c = b - ratio * (b - a);
    const d = a + ratio * (b - a);
    if (f(c) < f(d)) b = d;
    else a = c;
  }
  const x = (a + b) / 2;
  return { x, value: f(x) };
}

interface FootLift {
  label: string;
  /** The weight-sharing and overturning coefficients: R = (V + D)·c_v − F·c_h. */
  cv: number;
  ch: number;
  /** Swing part of the uplift per unit dynamic factor, S, and the angle it is largest at. */
  S: number;
  phi: number;
  /** The beam's weight holding the foot down, D·c_v. */
  held: number;
}

/**
 * Uplift at a foot on pads, by statics (spec, Structural model, Uplift at the feet). The chain
 * tension at φ on the way down from θ is W·(3·cos φ − 2·cos θ), from the same energy and
 * centripetal results as the swing load. Its fore-and-aft part pushes each A-frame over the foot
 * it pivots on; moments about that foot give the pull at the other one, which bears nothing and
 * so has no friction.
 */
function anchorCheck(
  output: SwingSetOutput,
  inputs: SwingSetStructuralInputs,
  supportsX: [number, number],
  beamWeight: Needed<{ w: number; working: Quantity[] } | null>,
  dynamicFactor: LoadFactor,
): CheckResult {
  const p = output.params;
  const g = output.geometry;
  const dims = dimensions(p);
  const a = g.splay * RAD;
  const qy = dims.bw / 2 + dims.w / (2 * Math.cos(a));
  const H = dims.H;
  const zb = g.back.footZ;
  const zf = g.front.footZ;
  const yb = qy + (H - zb) * Math.tan(a);
  const yf = -(qy + (H - zf) * Math.tan(a));
  const base = yb - yf;
  const [x0, x1] = supportsX;
  const hangersX = output.swings.hangersX;

  const swing = need(inputs, STRUCTURAL_INPUT_LABELS, 'riderWeights', 'maxSwingAngle');
  const perFoot: Needed<number> =
    p.hardware.anchorsPerFoot === undefined
      ? { missing: [{ key: 'hardware.anchorsPerFoot', label: ANCHORS_PER_FOOT }] }
      : { value: p.hardware.anchorsPerFoot };
  const rating: Needed<number> =
    p.hardware.anchorRating === undefined
      ? { missing: [{ key: 'hardware.anchorRating', label: ANCHOR_RATING }] }
      : { value: p.hardware.anchorRating };
  const C = 'value' in dynamicFactor.value ? dynamicFactor.value.value : undefined;
  const R = 'value' in rating ? rating.value : undefined;

  const load = combine(
    combine(swing, beamWeight, (s, weight) => ({ s, weight })),
    perFoot,
    (v, n) => {
      const { riderWeights, maxSwingAngle } = v.s;
      const theta = maxSwingAngle * RAD;
      const cosT = Math.cos(theta);
      // Each frame's share of the riders, by the beam's simple span between its supports.
      const left = hangersX.reduce(
        (sum, x, i) => sum + ((riderWeights[i < 2 ? 0 : 1] / 2) * (x1 - x)) / (x1 - x0),
        0,
      );
      const frames = [
        { name: 'left', W: left },
        { name: 'right', W: riderWeights[0] + riderWeights[1] - left },
      ];
      const w = v.weight?.w ?? 0;
      const D = (w * p.beamLength) / 2;
      const lifting = [
        { foot: 'back', cv: -yf / base, ch: (H - zf) / base },
        { foot: 'front', cv: yb / base, ch: (H - zb) / base },
      ];
      const feet: FootLift[] = frames.flatMap((frame) =>
        lifting.map(({ foot, cv, ch }) => {
          const m = minimize(
            (phi) => (3 * Math.cos(phi) - 2 * cosT) * (cv * Math.cos(phi) - ch * Math.sin(phi)),
            0,
            theta,
          );
          return {
            label: `${frame.name === 'left' ? 'Left' : 'Right'} frame, ${foot} foot`,
            cv,
            ch,
            S: -frame.W * m.value,
            phi: m.x / RAD,
            held: D * cv,
          };
        }),
      );
      // The foot that sets the margin at the entered factor, or that reaches margin 1.0 first.
      const governing = feet.reduce((worst, f) => {
        const score = (x: FootLift) =>
          C !== undefined
            ? C * x.S - x.held
            : R !== undefined && x.S > 0
              ? -(n * R + x.held) / x.S
              : x.S;
        return score(f) > score(worst) ? f : worst;
      });
      // The largest fore-and-aft force over the swing, at cos φ = (cos θ + √(cos² θ + 18)) / 6.
      const cosPeak = Math.min(1, (cosT + Math.sqrt(cosT * cosT + 18)) / 6);
      const sinPeak = Math.sqrt(1 - cosPeak * cosPeak);
      const peak = maxSwingAngle === 0 ? 0 : sinPeak * (3 * cosPeak - 2 * cosT);
      const working: Quantity[] = [
        {
          symbol: 'W1',
          label: 'Rider on left swing, with seat and chain',
          value: riderWeights[0],
          unit: 'lb',
          basis: 'Entered',
          input: 'riderWeights.0',
        },
        {
          symbol: 'W2',
          label: 'Rider on right swing, with seat and chain',
          value: riderWeights[1],
          unit: 'lb',
          basis: 'Entered',
          input: 'riderWeights.1',
        },
        {
          symbol: 'θ',
          label: 'Maximum swing angle',
          value: maxSwingAngle,
          unit: '°',
          basis: 'Entered',
          input: 'maxSwingAngle',
        },
        ...(v.weight?.working ?? []),
        { symbol: 'D', label: "Beam's weight on each frame, w·L / 2", value: D, unit: 'lb' },
        ...frames.map((f) => ({
          symbol: f.name === 'left' ? 'W_left' : 'W_right',
          label: `Riders carried by the ${f.name} frame, by the beam's span`,
          value: f.W,
          unit: 'lb',
        })),
        ...frames.map((f) => ({
          symbol: f.name === 'left' ? 'F_left' : 'F_right',
          label: `Largest fore-and-aft force on the ${f.name} frame, smooth swing`,
          value: f.W * peak,
          unit: 'lb',
          sources: PENDULUM_SOURCES,
        })),
        { symbol: 'y_b', label: 'Back foot, from under the beam', value: yb, unit: 'in' },
        { symbol: 'z_b', label: 'Back foot height', value: zb, unit: 'in' },
        { symbol: 'y_f', label: 'Front foot, from under the beam', value: yf, unit: 'in' },
        { symbol: 'z_f', label: 'Front foot height', value: zf, unit: 'in' },
        ...feet.map((f) => ({
          symbol: 'U',
          label: `Uplift, ${f.label.toLowerCase()}, smooth swing`,
          value: Math.max(0, f.S - f.held),
          unit: 'lb',
        })),
        {
          symbol: 'c_v',
          label: `${governing.label}: share of the downward load`,
          value: governing.cv,
          unit: '',
        },
        {
          symbol: 'c_h',
          label: `${governing.label}: overturning per pound of fore-and-aft force`,
          value: governing.ch,
          unit: '',
        },
        {
          symbol: 'φ',
          label: `${governing.label}: chain angle where the foot lifts most`,
          value: governing.phi,
          unit: '°',
        },
        {
          symbol: 'S',
          label: `${governing.label}: swing's pull at factor 1`,
          value: governing.S,
          unit: 'lb',
        },
        {
          symbol: 'D·c_v',
          label: `${governing.label}: beam's weight holding it down`,
          value: governing.held,
          unit: 'lb',
        },
        {
          symbol: 'n',
          label: ANCHORS_PER_FOOT,
          value: n,
          unit: '',
          basis: "Entered from the anchor maker's instructions",
        },
      ];
      return {
        value: governing.S / n,
        unfactored: -governing.held / n,
        working,
        assumptions: [
          'Chain tension at angle φ on the way down from θ is W·(3·cos φ − 2·cos θ); its fore-and-aft part pushes the frame over the foot it pivots on.',
          'Both swings are at the same angle at the same time (riders in sync), so their loads add.',
          "Each swing's load is split equally between its two hangers (a centered rider), and between the frames by the beam's span.",
          'The lifting foot bears nothing, so the whole fore-and-aft reaction is at the other foot. Moments about that foot give the pull.',
          v.weight
            ? "The beam's weight holds the feet down. The legs, crossbars, and gussets would too, but no moisture content is entered for them, so their weight is left out, which makes the uplift larger."
            : "No weight holds the feet down in this check: the beam's size has no design values, so it has no specific gravity, and the legs' weight is left out. That makes the uplift larger.",
          "The frame's own inertia is left out. Sliding along the ground is not computed.",
          'The dynamic factor multiplies the swing loads, not the weight.',
          'The anchor holds its rated pull-out in this soil, fastened to the leg as its maker specifies.',
        ],
      };
    },
  );

  return hardwareCheck({
    subject: ANCHOR_SUBJECT,
    loadCase: LOAD_CASES.strength,
    load,
    factor: dynamicFactor,
    rating,
  });
}

/**
 * Each leg's unbraced lengths (spec, Structural model, Legs). In the A-frame's plane the crossbar
 * and gusset hold the leg at the middle of each board's height; along the beam a buried leg is a
 * post fixed at grade and free at the top, and a leg on a pad has no end condition Kerf can count.
 */
export function legLengths(output: SwingSetOutput, leg: 'back' | 'front') {
  const p = output.params;
  const g = output.geometry;
  const cosA = Math.cos((g.splay * Math.PI) / 180);
  const groundZ = g[leg].groundZ;
  const crossbarMiddle = p.crossbarHeight - stock(p.crossbarStock).width / 2;
  const gussetMiddle = p.beamHeight - stock(p.gussetStock).width / 2;
  return {
    toCrossbar: (crossbarMiddle - groundZ) / cosA,
    crossbarToGusset: (gussetMiddle - crossbarMiddle) / cosA,
    toBeam: (p.beamHeight - groundZ) / cosA,
  };
}

type Leg = 'back' | 'front';

/**
 * The swing's push on one leg (spec, Structural model, Legs). Each A-frame stands on its two feet
 * where the legs meet the ground, loaded at (0, H) as for the uplift at the feet. With the other
 * foot lifting, moments about the loaded foot give the other foot's share, and the loaded foot
 * takes the rest: R = V·c_v + F·c_h, with c_v = |y_other| / (y_b − y_f) and c_h = (H − z) /
 * (y_b − y_f). The leg carries R along its axis, R / cos α. φ is where the swing part is largest.
 */
export function legPush(
  output: SwingSetOutput,
  riderWeights: readonly [number, number],
  maxSwingAngle: number,
  leg: Leg,
) {
  const p = output.params;
  const g = output.geometry;
  const dims = dimensions(p);
  const a = g.splay * RAD;
  const qy = dims.bw / 2 + dims.w / (2 * Math.cos(a));
  const H = dims.H;
  const zb = g.back.groundZ;
  const zf = g.front.groundZ;
  const yb = qy + (H - zb) * Math.tan(a);
  const yf = -(qy + (H - zf) * Math.tan(a));
  const base = yb - yf;
  const cv = (leg === 'back' ? -yf : yb) / base;
  const ch = (H - (leg === 'back' ? zb : zf)) / base;
  const theta = maxSwingAngle * RAD;
  const cosT = Math.cos(theta);
  const m = minimize(
    (phi) => -(3 * Math.cos(phi) - 2 * cosT) * (cv * Math.cos(phi) + ch * Math.sin(phi)),
    0,
    theta,
  );
  const [x0, x1] = beamSupports(output).x;
  const left = output.swings.hangersX.reduce(
    (sum, x, i) => sum + ((riderWeights[i < 2 ? 0 : 1] / 2) * (x1 - x)) / (x1 - x0),
    0,
  );
  const W = Math.max(left, riderWeights[0] + riderWeights[1] - left);
  return {
    W,
    phi: m.x / RAD,
    tension: 3 * Math.cos(m.x) - 2 * cosT,
    cv,
    ch,
    /** The swing part of R per unit dynamic factor, W·(3·cos φ − 2·cos θ)·(c_v·cos φ + c_h·sin φ). */
    swing: -W * m.value,
  };
}

function legColumn(
  output: SwingSetOutput,
  inputs: SwingSetStructuralInputs,
  swing: Needed<SwingLoads>,
  beamWeight: Needed<{ w: number; working: Quantity[] } | null>,
  dynamicFactor: LoadFactor,
): CheckResult {
  const p = output.params;
  const g = output.geometry;
  const leg = stock(p.legStock);
  const level = Math.abs(g.front.groundZ - g.back.groundZ) < 1e-9;
  // The leg longer above grade, the downhill one, first: its slenderness governs whether either is
  // computed. On level ground the two are the same, and the push loads each alike.
  const longer: Leg = g.front.groundZ < g.back.groundZ ? 'front' : 'back';
  const legs: Leg[] = level ? [longer] : [longer, longer === 'front' ? 'back' : 'front'];
  const cosA = Math.cos((g.splay * Math.PI) / 180);
  const hole = Math.max(
    boltHoleDiameter(p.hardware.crossbarBolts.diameter),
    boltHoleDiameter(p.hardware.gussetBolts.diameter),
  );
  const C = 'value' in dynamicFactor.value ? dynamicFactor.value.value : undefined;
  const riders = need(inputs, STRUCTURAL_INPUT_LABELS, 'riderWeights', 'maxSwingAngle');

  const checkLeg = (which: Leg) => {
    const subject = `${level ? 'Legs' : which === 'front' ? 'Front legs' : 'Back legs'}, ${p.legStock}`;
    const lengths = legLengths(output, which);
    const inPlane: ColumnAxis = {
      label: 'In the plane of the A-frame',
      d: leg.width,
      length: Math.max(lengths.toCrossbar, lengths.crossbarToGusset),
      Ke: 1,
      basis:
        'The crossbar and gusset tie the splayed legs into triangles, so each holds the leg from moving sideways at the middle of its height, and the leg is taken as free to turn there (NDS Table G1, case d, Ke = 1.0). ℓ is the longer of the stretch from the ground to the middle of the crossbar and the stretch from there to the middle of the gusset.',
    };
    const alongBeam: ColumnAxis = {
      label: 'Along the beam',
      d: leg.thickness,
      length: lengths.toBeam,
      Ke: 2.1,
      basis:
        "A buried leg is taken as fixed at grade. At the top the frame can lean along the beam and turn about the leg-to-beam bolt, so the leg's top is free to move and to turn (NDS Table G1, case e, Ke = 2.10). ℓ runs from grade to the underside of the beam, where the gusset carries the beam into the legs.",
    };

    const loads = combine(
      combine(swing, beamWeight, (s, weight) => ({ s, weight })),
      riders,
      (v, r): { shared: AxialLoad; pushed: AxialLoad } | null => {
        const { s, weight } = v;
        if (!weight) return null;
        const [x0, x1] = beamSupports(output).x;
        const R = reactions(x1 - x0, {
          points: output.swings.hangersX.map((x, i) => ({ a: x - x0, P: s.perHanger[i] ?? 0 })),
          w: 0,
        });
        const Rs = Math.max(R.left, R.right);
        const Rw = (weight.w * p.beamLength) / 2;
        const push = legPush(output, r.riderWeights, r.maxSwingAngle, which);
        // P = (C·R_s + R_w) / (2·cos α); N = (C·S + R_w·c_v) / cos α.
        const shared = { factored: Rs / (2 * cosA), unfactored: Rw / (2 * cosA) };
        const pushed = { factored: push.swing / cosA, unfactored: (Rw * push.cv) / cosA };
        const at = (l: { factored: number; unfactored: number }) =>
          C === undefined ? [] : [(C * l.factored + l.unfactored) as number];
        const toward = which === 'back' ? 'the back' : 'the front';
        const working: Quantity[] = [
          ...s.working,
          ...weight.working,
          {
            symbol: 'R_s',
            label: "Swing loads on the more loaded frame, the beam's larger support reaction",
            value: Rs,
            unit: 'lb',
          },
          {
            symbol: 'R_w',
            label: "Beam's weight on each frame, w · beam length / 2",
            value: Rw,
            unit: 'lb',
          },
          {
            symbol: 'α',
            label: 'Splay of each leg from vertical',
            value: g.splay,
            unit: '°',
            basis: 'From the template geometry',
          },
          {
            symbol: 'W_f',
            label: "Riders carried by the more loaded frame, by the beam's span",
            value: push.W,
            unit: 'lb',
          },
          {
            symbol: 'φ',
            label: `Chain angle where the push toward ${toward} loads this leg most`,
            value: push.phi,
            unit: '°',
          },
          {
            symbol: '3·cos φ − 2·cos θ',
            label: 'Chain tension per pound of rider at φ, on the way down from θ',
            value: push.tension,
            unit: '',
            basis: 'Smooth pendulum, from conservation of energy and the centripetal force',
            sources: PENDULUM_SOURCES,
          },
          {
            symbol: 'c_v',
            label: "This leg's foot: share of the downward load",
            value: push.cv,
            unit: '',
          },
          {
            symbol: 'c_h',
            label: "This leg's foot: load per pound of fore-and-aft force",
            value: push.ch,
            unit: '',
          },
          {
            symbol: 'S',
            label:
              "Swing part of the foot's load at factor 1, W_f·(3·cos φ − 2·cos θ)·(c_v·cos φ + c_h·sin φ)",
            value: push.swing,
            unit: 'lb',
          },
          ...at(shared).map((value) => ({
            symbol: 'P_0',
            label: 'Load per leg at the bottom of the arc, (C·R_s + R_w) / (2·cos α)',
            value,
            unit: 'lb',
          })),
          ...at(pushed).map((value) => ({
            symbol: 'N',
            label: `Load on this leg pushed toward ${toward}, (C·S + R_w·c_v) / cos α`,
            value,
            unit: 'lb',
          })),
        ];
        const assumptions = [
          ...SWING_ASSUMPTIONS,
          "The dynamic factor covers snap loads from slack chains. It is not applied to the beam's own weight.",
          "The leg is checked under the larger of two loads. At the bottom of the arc each frame's load is shared equally by its two legs, along their axes: the frame's load divided by 2·cos α. Pushed toward the front or the back, one leg carries more.",
          'Chain tension at angle φ on the way down from θ is W·(3·cos φ − 2·cos θ). Its vertical and fore-and-aft parts act at the beam, and φ is the angle where they load this leg most.',
          "For the push, each A-frame is taken as a rigid body standing on its feet where the legs meet the ground. Moments about this leg's foot give the other foot's share, this foot takes the rest, and the leg carries it along its axis, divided by cos α.",
          'Analyzing the whole frame with the same loads gave buried legs up to 5% more than this, because the legs also bend.',
          "The beam's whole weight, its overhangs included, is split equally between the frames. The legs', crossbars', and gussets' own weight is left out.",
        ];
        return {
          shared: { ...shared, working, assumptions },
          pushed: { ...pushed, working, assumptions },
        };
      },
    );

    const member = {
      subject,
      nominal: p.legStock,
      breadth: leg.thickness,
      depth: leg.width,
      sizeSources: STOCK_SIZE_SOURCES,
      axes:
        p.burialDepth > 0
          ? [inPlane, alongBeam]
          : {
              reason:
                'On pads, no end condition Kerf can count holds a leg along the beam: each foot can turn on its pad, and the frame can turn about the leg-to-beam bolt, so NDS Appendix G gives no buckling length. What holds the frame along the beam is the ground anchors and how tightly the bolts clamp, which an experienced builder judges.',
            },
      netArea: {
        value: (leg.width - hole) * leg.thickness,
        basis: `The crossbar and gusset bolts pass through each leg along the beam, in holes up to ${formatLength(hole)} across, which leave (w − hole) · t (NDS 2024 3.1.2.1).`,
      },
    };
    const check = (load: Needed<AxialLoad>) =>
      columnCheck({
        member,
        material: mapNeeded(
          need(inputs, STRUCTURAL_INPUT_LABELS, 'legSpeciesGrade', 'legIncised'),
          (v) => ({ speciesGrade: v.legSpeciesGrade, incised: v.legIncised }),
        ),
        conditions: LEG_CONDITIONS,
        loadCase: LOAD_CASES.strength,
        load,
        factor: dynamicFactor,
        assumptions: [
          ...(p.burialDepth > 0
            ? [
                'A buried leg is taken as fixed at grade. Soil near the surface gives, so the real point of fixity is below grade, which makes the effective length along the beam longer than this.',
              ]
            : []),
          level
            ? 'On level ground both legs are the same length, and the push loads the front leg toward the front as it loads the back leg toward the back.'
            : 'The push can load the shorter leg more than the longer one, so both are checked, and this is the one with the lower margin.',
        ],
      });
    if ('value' in loads && loads.value === null) {
      return [
        {
          kind: 'column',
          title: 'Compression',
          subject,
          loadCase: LOAD_CASES.strength,
          status: 'not-computed',
          reason: `No design values are entered for the beam's species and grade in ${p.beamStock}, so its weight on the legs is not known.`,
          sources: [],
        } satisfies CheckResult,
      ];
    }
    const both = loads as Needed<{ shared: AxialLoad; pushed: AxialLoad }>;
    return [check(mapNeeded(both, (l) => l.shared)), check(mapNeeded(both, (l) => l.pushed))];
  };

  // Every leg under both loads: the lowest margin, or with the factor missing the lowest
  // break-even factor. If the longer leg is not computed, neither is the other, for the same reason.
  const results = legs.flatMap(checkLeg);
  const first = results[0] as CheckResult;
  if (first.status === 'not-computed') return first;
  const computed = results.filter((r) => r.status === 'computed');
  if (computed.length > 0) {
    return computed.reduce((low, r) => (r.margin < low.margin ? r : low));
  }
  const breakEven = (r: CheckResult) =>
    (r.status === 'input-needed' && r.breakEven?.value) || Number.POSITIVE_INFINITY;
  return results.reduce((low, r) => (breakEven(r) < breakEven(low) ? r : low));
}

const params = (...paths: string[]) => paths.map((path): FieldRef => ({ from: 'params', path }));
const inputs = (...paths: (keyof typeof STRUCTURAL_INPUT_LABELS | `riderWeights.${0 | 1}`)[]) =>
  paths.map((path): FieldRef => ({ from: 'structuralInputs', path }));

/**
 * The fields each check changes with (`TemplateDefinition.checkFields`): for the top beam, its
 * size, its span between the gussets (or the bolts, with no gusset under it), where the hangers
 * hang on it and, for bending and shear, how they are fastened, then the inputs its material and loads come
 * from; for the legs, their size, the frame's shape, and the loads the beam brings them; for a
 * hanger, its loads and its rating; for a ground anchor, the frame's shape, the
 * anchors, and the inputs behind the beam's weight. The beam's size also changes its weight, but
 * it is left out, so the beam's other sizes are offered against the beam checks alone (#450).
 */
export function checkFields(check: { kind: CheckKind; subject: string }): FieldRef[] {
  const riders = inputs('riderWeights.0', 'riderWeights.1', 'maxSwingAngle');
  if (check.subject === ANCHOR_SUBJECT) {
    return [
      ...params('beamLength', 'beamHeight'),
      ...params('splay.kind', 'splay.degrees', 'splay.depth', 'frameInset', 'legStock'),
      ...params('gussetStock', 'groundSlope'),
      ...params('swings.centers.0', 'swings.centers.1', 'swings.hangerSpacing'),
      ...params('hardware.anchorsPerFoot', 'hardware.anchorRating'),
      ...inputs('beamSpeciesGrade', 'beamMoistureContent'),
      ...riders,
      ...inputs('dynamicFactor'),
    ];
  }
  if (check.kind === 'column') {
    return [
      ...params('legStock', 'beamHeight', 'splay.kind', 'splay.degrees', 'splay.depth'),
      ...params('groundSlope', 'burialDepth', 'crossbarStock', 'crossbarHeight', 'gussetStock'),
      ...params('beamStock', 'beamPlies', 'beamLength', 'frameInset'),
      ...params('swings.centers.0', 'swings.centers.1', 'swings.hangerSpacing'),
      ...inputs('legSpeciesGrade', 'legIncised', 'beamSpeciesGrade', 'beamMoistureContent'),
      ...riders,
      ...inputs('dynamicFactor'),
    ];
  }
  if (check.kind === 'hardware') return [...riders, ...inputs('dynamicFactor', 'hangerRating')];
  return [
    ...params('beamStock', 'beamPlies', 'beamLength', 'frameInset', 'gussetStock', 'legStock'),
    ...params('swings.centers.0', 'swings.centers.1', 'swings.hangerSpacing'),
    ...(check.kind === 'beam-bending' || check.kind === 'beam-shear'
      ? params(
          'hardware.hangerMounting.kind',
          'hardware.hangerMounting.diameter',
          'hardware.hangerMounting.perHanger',
          'hardware.hangerMounting.holeHeight',
        )
      : []),
    ...inputs('beamSpeciesGrade', 'beamIncised', 'beamMoistureContent'),
    ...riders,
    ...inputs(check.kind === 'beam-deflection' ? 'deflectionLimit' : 'dynamicFactor'),
  ];
}

/** Swing-set items to confirm with an experienced builder (DOMAIN.md, Swing set, Loads). */
function checklist(output: SwingSetOutput): ChecklistItem[] {
  const p = output.params;
  const g = output.geometry;
  const h = p.hardware;
  const items: ChecklistItem[] = [
    {
      category: 'bolted-connections',
      element: 'Leg-to-beam bolt and gusset, each frame',
      partIds: [...LEG_IDS, 'beam', 'gusset'],
      hardwareIds: ['leg-beam-bolts', 'gusset-bolts'],
      confirm: `Bolt size (${formatLength(h.legBoltDiameter)}, ${formatLength(g.boltGrip)} grip), edge and end distances in the legs and beam, washers on the tilted outer faces, and that the gusset and bolt together carry the beam's reaction.`,
      why: 'Each frame carries half of every swing load into the legs through this joint; connections are not computed.',
    },
    {
      category: 'check-assumptions',
      element: 'Beam ends at the frames',
      partIds: ['beam', ...LEG_IDS],
      hardwareIds: [],
      confirm: 'That each frame holds the beam against rolling over at its support.',
      why: 'The beam stability factor assumes it; without that restraint the beam can buckle sideways at a lower load.',
    },
    {
      category: 'racking',
      element: 'A-frames and crossbars',
      partIds: [...LEG_IDS, 'crossbar', 'gusset'],
      hardwareIds: ['crossbar-bolts', 'gusset-bolts'],
      confirm:
        'That the frames resist side-to-side and front-to-back swing forces without racking, and whether corner braces are needed.',
      why:
        p.burialDepth > 0
          ? 'Swinging pushes the top of the frame back and forth. Along the beam, buried legs hold the frames by bending at grade, and how far the frames lean depends on how tightly the bolts clamp. Racking is not computed.'
          : 'Swinging pushes the top of the frame back and forth. Along the beam, on pads, nothing in the frames themselves holds them: each foot can turn on its pad and each frame about its leg-to-beam bolt, so only how tightly the bolts clamp, the ground anchors, or corner braces keep the frames from leaning. Racking is not computed.',
    },
    p.burialDepth > 0
      ? {
          category: 'tipping-and-anchoring',
          element: 'Buried legs',
          partIds: [...LEG_IDS],
          hardwareIds: [],
          confirm: `Burial depth (${formatLength(p.burialDepth)}), soil, what each leg's end stands on (gravel or tamped soil), whether the backfill or concrete around it sheds water away from the wood, and lumber rated for ground contact (UC4A, or UC4B if critical or hard to replace).`,
          why: 'Burial keeps the frame from lifting and walking; tipping and anchoring are not computed.',
        }
      : {
          category: 'tipping-and-anchoring',
          element: 'Ground anchors on pads',
          partIds: [...LEG_IDS],
          hardwareIds: ['ground-anchors'],
          confirm: `Anchor type and count (${h.anchorsPerFoot ?? 'not entered'} per foot), that the rated pull-out holds in this soil, how each anchor is fastened to its leg, and how they are buried or covered.`,
          why: 'The anchor check gives the pull on one anchor from the swing alone; the soil, the fastening to the leg, and sliding along the ground are not computed.',
        },
    {
      category: 'bolted-connections',
      element: 'Swing hangers',
      partIds: ['beam'],
      hardwareIds: [
        'swing-hangers',
        ...(p.hardware.hangerMounting && p.hardware.hangerMounting.kind !== 'other'
          ? [HANGER_BOLTS]
          : []),
      ],
      confirm:
        p.hardware.hangerMounting?.kind === 'horizontal-bolts'
          ? 'Hangers rated for swing use, installed through the beam as the manufacturer specifies, with holes no larger and no lower in the beam than the bending and shear checks take.'
          : 'Hangers rated for swing use, installed through the beam as the manufacturer specifies, with holes no larger than the bending and shear checks take.',
      why: "The hanger margin uses the manufacturer's rating, which holds only for its specified installation.",
    },
    {
      category: 'lumber-quality',
      element: 'Beam and legs',
      partIds: ['beam', ...LEG_IDS],
      hardwareIds: [],
      confirm:
        'Boards free of large knots near the edges (especially near midspan of the beam), steep grain slope, splits, and wane.',
      why: 'Design values assume the grade; a defect in the wrong place lowers strength more than the grade allows for.',
    },
    {
      category: 'long-term-condition',
      element: 'Whole frame',
      // The whole design: no one part.
      partIds: [],
      hardwareIds: [],
      confirm:
        'An inspection routine: nuts and bolts twice a month, seats and chains monthly (CPSC Pub. 324, p. 5), and decay at the ground line.',
      why: 'Wood shrinks and bolts loosen, especially in pressure-treated lumber that was sold wet.',
    },
  ];
  if (p.beamPlies > 1) {
    items.splice(1, 0, {
      category: 'bolted-connections',
      element: `Beam plies (${p.beamPlies} x ${p.beamStock})`,
      partIds: ['beam'],
      hardwareIds: ['ply-bolts', 'swing-hangers'],
      confirm: `Ply bolt pattern and spacing (${h.plyBolts?.count ?? 'no'} bolts entered), and that every hanger's load reaches all ${p.beamPlies} plies.`,
      why: 'The checks assume each ply carries an equal share of every load (decision 0013); that holds only if the plies are fastened together and every load reaches every ply.',
    });
  }
  return items;
}

import { z } from 'zod';
import { DENSITY_SOURCES, woodDensity } from '../../design-values/density.ts';
import { referenceRow, SPECIES_GRADE_IDS, speciesGrade } from '../../design-values/sawnLumber.ts';
import type { Citation } from '../../design-values/sources.ts';
import { STOCK_SIZE_SOURCES, stock } from '../../lumber/stock.ts';
import type { FieldRef } from '../../model/form.ts';
import { ChecklistItem, type Issue } from '../../model/types.ts';
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

  return {
    ok: true,
    review: {
      inputs,
      beam: beamResult,
      hanger,
      ...(anchors ? { anchors } : {}),
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
            ? "The beam's weight holds the feet down. The legs, crossbars, and gussets would too, but no species is entered for them, so their weight is left out, which makes the uplift larger."
            : "No weight holds the feet down in this check: the beam's size has no design values, so it has no specific gravity, and no species is entered for the legs. That makes the uplift larger.",
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

const params = (...paths: string[]) => paths.map((path): FieldRef => ({ from: 'params', path }));
const inputs = (...paths: (keyof typeof STRUCTURAL_INPUT_LABELS | `riderWeights.${0 | 1}`)[]) =>
  paths.map((path): FieldRef => ({ from: 'structuralInputs', path }));

/**
 * The fields each check changes with (`TemplateDefinition.checkFields`): for the top beam, its
 * size, its span between the gussets (or the bolts, with no gusset under it), where the hangers
 * hang on it and, for bending and shear, how they are fastened, then the inputs its material and loads come
 * from; for a hanger, its loads and its rating; for a ground anchor, the frame's shape, the
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
      why: 'Swinging pushes the top of the frame back and forth; racking is not computed.',
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

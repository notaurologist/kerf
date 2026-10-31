import { z } from 'zod';
import { DENSITY_SOURCES, woodDensity } from '../../design-values/density.ts';
import { referenceRow, SPECIES_GRADE_IDS, speciesGrade } from '../../design-values/sawnLumber.ts';
import type { Citation } from '../../design-values/sources.ts';
import { STOCK_SIZE_SOURCES, stock } from '../../lumber/stock.ts';
import { ChecklistItem, type Issue } from '../../model/types.ts';
import {
  BeamChecks,
  beamChecks,
  hardwareCheck,
  type LoadCase,
  type PointLoad,
} from '../../structural/checks.ts';
import type { ServiceConditions } from '../../structural/factors.ts';
import {
  CheckResult,
  type MissingInput,
  type Needed,
  type Quantity,
} from '../../structural/types.ts';
import { formatLength } from '../../units/length.ts';
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
    /** Multiplier on the pendulum load for snap loads, chosen with an experienced builder. */
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

type Key = keyof SwingSetStructuralInputs;

function need<K extends Key>(
  inputs: SwingSetStructuralInputs,
  ...keys: K[]
): Needed<{ [P in K]: NonNullable<SwingSetStructuralInputs[P]> }> {
  const missing: MissingInput[] = keys
    .filter((k) => inputs[k] === undefined)
    .map((k) => ({ key: k, label: STRUCTURAL_INPUT_LABELS[k] }));
  if (missing.length > 0) return { missing };
  return { value: inputs as { [P in K]: NonNullable<SwingSetStructuralInputs[P]> } };
}

function mapNeeded<T, U>(n: Needed<T>, f: (value: T) => U): Needed<U> {
  return 'value' in n ? { value: f(n.value) } : n;
}

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
      },
      {
        symbol: 'W2',
        label: 'Rider on right swing, with seat and chain',
        value: riderWeights[1],
        unit: 'lb',
        basis: 'Entered',
      },
      {
        symbol: 'θ',
        label: 'Maximum swing angle',
        value: maxSwingAngle,
        unit: '°',
        basis: 'Entered',
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
export const BEAM_CONDITIONS: ServiceConditions = {
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
      'C_D = 1.0: the impact increase is not used, and factors above 1.6 do not apply to lumber treated with water-borne preservatives (NDS 4.3.13).',
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
  checklist: z.array(ChecklistItem),
});
export type SwingSetStructuralReview = z.infer<typeof SwingSetStructuralReview>;

export type ReviewResult =
  | { ok: true; review: SwingSetStructuralReview }
  | { ok: false; issues: Issue[] };

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
  const [x0, x1] = output.geometry.supportsX;
  const hangersX = output.swings.hangersX;

  const swing = mapNeeded(need(inputs, 'riderWeights', 'maxSwingAngle'), (v) =>
    swingLoads(v.riderWeights, v.maxSwingAngle),
  );
  const strengthLoads = mapNeeded(
    need(inputs, 'riderWeights', 'maxSwingAngle', 'dynamicFactor'),
    (v) => {
      const base = swingLoads(v.riderWeights, v.maxSwingAngle);
      return {
        perHanger: base.perHanger.map((P) => P * v.dynamicFactor),
        working: [
          ...base.working,
          {
            symbol: 'C_dyn',
            label: 'Dynamic factor',
            value: v.dynamicFactor,
            unit: '',
            basis: 'Entered',
          },
        ],
      };
    },
  );

  // The beam's own weight, from its density at the entered moisture content. With no design values
  // for the size there is no G either; the beam checks then report that.
  const beamWeight = mapNeeded(need(inputs, 'beamSpeciesGrade', 'beamMoistureContent'), (v) => {
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
  });
  const withWeight = <T extends { perHanger: number[]; working: Quantity[] }>(l: Needed<T>) =>
    combine(l, beamWeight, (loads, weight) => ({
      points: pointLoads(hangersX, loads.perHanger),
      ...(weight ? { uniform: { w: weight.w, label: "Beam's own weight" } } : {}),
      working: [...loads.working, ...(weight?.working ?? [])],
    }));
  const strengthBeam = withWeight(strengthLoads);
  const deflectionBeam = withWeight(swing);

  const strength: LoadCase = {
    name: LOAD_CASES.strength,
    loads: mapNeeded(strengthBeam, ({ points, uniform }) => ({ points, uniform })),
    working: 'value' in strengthBeam ? strengthBeam.value.working : [],
    assumptions: [
      ...SWING_ASSUMPTIONS,
      "The dynamic factor covers snap loads from slack chains, which exceed the smooth pendulum load. It is not applied to the beam's own weight.",
    ],
  };
  const deflection: LoadCase & { limitRatio: Needed<number> } = {
    name: LOAD_CASES.deflection,
    loads: mapNeeded(deflectionBeam, ({ points, uniform }) => ({ points, uniform })),
    working: 'value' in deflectionBeam ? deflectionBeam.value.working : [],
    assumptions: [
      ...SWING_ASSUMPTIONS,
      'Deflection describes normal use, so the dynamic factor is not applied.',
    ],
    limitRatio: mapNeeded(need(inputs, 'deflectionLimit'), (v) => v.deflectionLimit),
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
    material: mapNeeded(need(inputs, 'beamSpeciesGrade', 'beamIncised'), (v) => ({
      speciesGrade: v.beamSpeciesGrade,
      incised: v.beamIncised,
    })),
    conditions: BEAM_CONDITIONS,
    strength,
    deflection,
    assumptions: [
      `Supported at the two frame centerlines, ${formatLength(x0)} and ${formatLength(x1)} from the left end; the span runs center to center of the legs.`,
      'Each A-frame holds the beam against rotation at its support (legs bolted against both faces, gusset underneath), so the unbraced length is the span.',
      "The beam's own weight acts as a uniform load over the span, from its density at the entered moisture content; seats and chains are in the rider weights.",
    ],
  });

  const hanger = hardwareCheck({
    subject: 'Swing hanger',
    loadCase: LOAD_CASES.strength,
    load: mapNeeded(strengthLoads, (l) => {
      const P = Math.max(...l.perHanger);
      return {
        value: P,
        working: [
          ...l.working,
          {
            symbol: 'P',
            label: 'Load on the most loaded hanger, C_dyn·T / 2',
            value: P,
            unit: 'lb',
          },
        ],
        assumptions: [...SWING_ASSUMPTIONS],
      };
    }),
    rating: mapNeeded(need(inputs, 'hangerRating'), (v) => v.hangerRating),
  });

  return { ok: true, review: { inputs, beam: beamResult, hanger, checklist: checklist(output) } };
}

/** Swing-set items to confirm with an experienced builder (DOMAIN.md, Swing set, Loads). */
export function checklist(output: SwingSetOutput): ChecklistItem[] {
  const p = output.params;
  const g = output.geometry;
  const h = p.hardware;
  const items: ChecklistItem[] = [
    {
      category: 'bolted-connections',
      element: 'Leg-to-beam bolt and gusset, each frame',
      partIds: [...LEG_IDS, 'beam', 'gusset'],
      hardwareIds: ['leg-beam-bolts', 'gusset-bolts'],
      confirm: `Bolt size (${formatLength(h.legBoltDiameter)} entered, ${formatLength(g.boltGrip)} grip), edge and end distances in the legs and beam, washers on the tilted outer faces, and that the gusset and bolt together carry the beam's reaction.`,
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
          confirm: `Burial depth (${formatLength(p.burialDepth)}), soil, backfill or concrete, and lumber rated for ground contact.`,
          why: 'Burial keeps the frame from lifting and walking; tipping and anchoring are not computed.',
        }
      : {
          category: 'tipping-and-anchoring',
          element: 'Ground anchors on pads',
          partIds: [...LEG_IDS],
          hardwareIds: ['ground-anchors'],
          confirm: `Anchor type and count (${h.anchorsPerFoot ?? 'not entered'} per foot) and how they are buried or covered.`,
          why: 'Anchors keep the frame from lifting, tipping, and walking; tipping and anchoring are not computed.',
        },
    {
      category: 'bolted-connections',
      element: 'Swing hangers',
      partIds: ['beam'],
      hardwareIds: ['swing-hangers'],
      confirm:
        'Hangers rated for swing use, installed through the beam as the manufacturer specifies.',
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
      confirm: `Ply bolt pattern and spacing (${h.plyBolts?.count ?? 'no'} bolts entered), and that every hanger bolts through all ${p.beamPlies} plies.`,
      why: 'The checks assume each ply carries an equal share of every load (decision 0013); that holds only if the plies are fastened together and every load reaches every ply.',
    });
  }
  return items;
}

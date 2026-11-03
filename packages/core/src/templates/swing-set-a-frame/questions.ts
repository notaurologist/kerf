import { z } from 'zod';
import { stock } from '../../lumber/stock.ts';
import type { FormSection } from '../../model/form.ts';
import { type Suggestion, type SuggestionBasis, startingQuestions } from '../../model/questions.ts';
import { formatLength } from '../../units/length.ts';
import { boltSuggestions } from './boltSuggestions.ts';
import { WORKED_EXAMPLE } from './examples.ts';
import { CLEARANCES } from './layout.ts';
import { BEAM_HEIGHT } from './params.ts';
import { SwingSetStructuralInputs } from './structural.ts';

// Starting questions (#163; docs/templates/swing-set-a-frame.md, Starting questions). Kerf asks
// only what it cannot know: who rides, how heavy the heaviest riders are, the open space, the
// ground, and pads or burial. Everything else comes from the worked example or a stated rule of
// thumb. Three structural inputs are suggested from a named source or a stated bound, shown as
// suggestions until the owner saves the form (hard rule 3 as amended, #355): the deflection limit,
// the swing angle, and the beam's moisture content. Hardware, the species and grade, incising,
// the hanger rating, and the dynamic factor are left for the owner, and stock comes from the
// worked example: Kerf never sizes lumber from loads.

const RIDERS = ['kids', 'kids-and-adults'] as const;
type Riders = (typeof RIDERS)[number];

export const SwingSetAnswers = z.object({
  riders: z.enum(RIDERS),
  riderWeights: SwingSetStructuralInputs.shape.riderWeights.unwrap(),
  area: z.object({
    /** Open space along the beam, inches. */
    length: z.number().positive(),
    /** Open space front to back, inches. */
    depth: z.number().positive(),
  }),
  ground: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('level') }),
    /** Inches the ground falls per foot toward the front, as the parameter. */
    z.object({ kind: z.literal('sloped'), slope: z.number().min(-3).max(3) }),
  ]),
  feet: z.enum(['pads', 'buried']),
});
export type SwingSetAnswers = z.infer<typeof SwingSetAnswers>;

const QUESTIONS: readonly FormSection[] = [
  {
    title: 'Riders',
    fields: [
      {
        path: 'riders',
        label: 'Who will ride',
        kind: 'choice',
        options: [
          { value: 'kids', label: 'Only kids' },
          { value: 'kids-and-adults', label: 'Kids and adults' },
        ],
      },
      {
        path: 'riderWeights.0',
        label: 'Heaviest rider on the left swing, with seat and chain',
        kind: 'number',
        unit: 'lb',
        help: '0 for a swing left empty. This is the load the structural checks use.',
      },
      {
        path: 'riderWeights.1',
        label: 'Heaviest rider on the right swing, with seat and chain',
        kind: 'number',
        unit: 'lb',
        help: '0 for a swing left empty.',
      },
    ],
  },
  {
    title: 'Space',
    help: 'Open space with nothing in it: no house, fence, shed, tree, or pole. Kerf keeps the clear area and the swing zones inside it.',
    fields: [
      {
        path: 'area.length',
        label: 'Length along the beam',
        kind: 'length',
      },
      {
        path: 'area.depth',
        label: 'Depth, front to back',
        kind: 'length',
        help: 'The swings swing this way. The swing zones need four times the beam height.',
      },
    ],
  },
  {
    title: 'Ground',
    fields: [
      {
        path: 'ground.kind',
        label: 'Ground',
        kind: 'choice',
        options: [
          { value: 'level', label: 'Level' },
          { value: 'sloped', label: 'Sloped front to back' },
        ],
      },
      {
        path: 'ground.slope',
        label: 'Ground slope',
        kind: 'number',
        unit: 'in per ft',
        fractions: true,
        help: 'Inches the ground falls per foot toward the front. Negative if the front is uphill.',
        when: (v) => v('ground.kind') === 'sloped',
      },
      {
        path: 'feet',
        label: 'Leg feet',
        kind: 'choice',
        options: [
          { value: 'pads', label: 'On pads, with ground anchors' },
          { value: 'buried', label: 'Buried' },
        ],
      },
    ],
  },
];

const RULE_HEIGHT: Record<Riders, { inches: number; rule: string }> = {
  kids: {
    inches: 96,
    rule: 'a home swing set for kids usually hangs from about 8 ft',
  },
  'kids-and-adults': {
    inches: 120,
    rule: 'with adults riding, about 10 ft, for a longer chain and more room under the beam',
  },
};

const ft = (inches: number) => formatLength(inches, 'feet-inches');

const zones = CLEARANCES.swingZoneFactor;
const clear = CLEARANCES.clearAreaMargin;
const gap = CLEARANCES.seatGap.value;

/** The space front to back the swing zones need for a beam at height H: H in front and behind. */
const depthFor = (height: number) => 2 * zones.value * height;

/** IBC 2021 Table 1604.3, read at codes.iccsafe.org (#388). */
const FLOOR_DEFLECTION: SuggestionBasis = {
  kind: 'source',
  citation:
    'International Building Code (2021), Table 1604.3, floor members under dead plus live load, l/240',
};
/** The pendulum model's largest angle (spec, Structural model): 3 − 2 cos 90° = 3. */
const LARGEST_SWING: SuggestionBasis = {
  kind: 'rule-of-thumb',
  rule: "the largest angle Kerf's pendulum model takes, chains level with the beam, so the largest load it gives",
};
/** The fiber saturation point, where Simpson's density equations change form (`woodDensity`). */
const FIBER_SATURATION: SuggestionBasis = {
  kind: 'source',
  citation:
    'William T. Simpson, Specific Gravity, Moisture Content, and Density Relationship for Wood (FPL-GTR-76, 1993), Equation 4, wood at its fiber saturation point, about 30%',
};

const EXAMPLE: SuggestionBasis = { kind: 'example' };
const ANSWER: SuggestionBasis = { kind: 'answer' };

/** Nearest sixteenth, so a suggested position reads as a tape measure does. */
const sixteenth = (inches: number) => Math.round(inches * 16) / 16;

/**
 * The shortest beam that fits two swings at its thirds with the worked example's frame inset,
 * legs, and seats, keeping the CPSC seat gaps: L/3 − seat/2 − (inset + leg) from a seat to the
 * frame and L/3 − seat between the seats.
 */
export function shortestBeam(): number {
  const { frameInset, legStock, swings } = WORKED_EXAMPLE;
  const leg = stock(legStock).thickness;
  return 3 * Math.max(gap + swings.seatWidth / 2 + frameInset + leg, gap + swings.seatWidth);
}

function beamHeight(answers: SwingSetAnswers): Suggestion {
  const usual = RULE_HEIGHT[answers.riders];
  const tallest = Math.floor(answers.area.depth / (2 * zones.value));
  const base = { from: 'params', path: 'beamHeight' } as const;
  if (tallest >= usual.inches) {
    return { ...base, value: usual.inches, basis: { kind: 'rule-of-thumb', rule: usual.rule } };
  }
  const short = `The usual height is ${ft(usual.inches)}, and its swing zones need ${ft(depthFor(usual.inches))} front to back.`;
  if (tallest < BEAM_HEIGHT.min) {
    return {
      ...base,
      value: null,
      basis: { kind: 'source', citation: zones.source },
      note: `${short} Even the lowest beam Kerf draws, ${ft(BEAM_HEIGHT.min)}, needs ${ft(depthFor(BEAM_HEIGHT.min))}.`,
    };
  }
  return {
    ...base,
    value: tallest,
    basis: { kind: 'source', citation: zones.source },
    note: `${short} Your ${ft(answers.area.depth)} fits a beam up to ${ft(tallest)}.`,
  };
}

function beamLengthAndSwings(answers: SwingSetAnswers): Suggestion[] {
  const usual = WORKED_EXAMPLE.beamLength;
  const longest = Math.floor(answers.area.length - 2 * clear.value);
  const shortest = shortestBeam();
  const base = { from: 'params', path: 'beamLength' } as const;
  const centers = (length: number | null): Suggestion[] =>
    [1, 2].map((third, i) => ({
      from: 'params',
      path: `swings.centers.${i}`,
      value: length === null ? null : sixteenth((length * third) / 3),
      basis: { kind: 'rule-of-thumb', rule: "each swing at a third of the beam's length" },
    }));
  if (longest >= usual) {
    return [{ ...base, value: usual, basis: EXAMPLE }, ...centers(usual)];
  }
  const short = `The worked example's beam is ${ft(usual)}, which needs ${ft(usual + 2 * clear.value)} along the beam with the clear area at each end.`;
  if (longest < Math.ceil(shortest)) {
    return [
      {
        ...base,
        value: null,
        basis: { kind: 'source', citation: clear.source },
        note: `${short} Two swings need a beam of at least ${ft(Math.ceil(shortest))}, so ${ft(Math.ceil(shortest) + 2 * clear.value)}.`,
      },
      ...centers(null),
    ];
  }
  return [
    {
      ...base,
      value: longest,
      basis: { kind: 'source', citation: clear.source },
      note: `${short} Your ${ft(answers.area.length)} fits a beam up to ${ft(longest)}.`,
    },
    ...centers(longest),
  ];
}

/** The crossbar's top at the worked example's share of the beam height (40" of 96"). */
function crossbarHeight(height: number | null): Suggestion {
  const share = WORKED_EXAMPLE.crossbarHeight / WORKED_EXAMPLE.beamHeight;
  return {
    from: 'params',
    path: 'crossbarHeight',
    value: height === null ? null : Math.floor(height * share),
    basis: {
      kind: 'rule-of-thumb',
      rule: `the same share of the beam height as the worked example, ${ft(WORKED_EXAMPLE.crossbarHeight)} of ${ft(WORKED_EXAMPLE.beamHeight)}`,
    },
  };
}

export function suggest(answers: SwingSetAnswers): Suggestion[] {
  const others = suggestWithoutBolts(answers);
  return [...others, ...boltSuggestions(others)];
}

function suggestWithoutBolts(answers: SwingSetAnswers): Suggestion[] {
  const ex = WORKED_EXAMPLE;
  const height = beamHeight(answers);
  const param = (
    path: string,
    value: Suggestion['value'],
    basis: SuggestionBasis,
    note?: string,
  ): Suggestion => ({ from: 'params', path, value, basis, ...(note ? { note } : {}) });
  const stockNote =
    'Kerf does not size lumber from loads; the preview shows its margin under yours.';
  return [
    ...beamLengthAndSwings(answers),
    height,
    param('beamStock', ex.beamStock, EXAMPLE, stockNote),
    param('beamPlies', ex.beamPlies, EXAMPLE),
    param('splay.kind', ex.splay.kind, EXAMPLE),
    param('splay.degrees', ex.splay.kind === 'angle' ? ex.splay.degrees : null, EXAMPLE),
    param('frameInset', ex.frameInset, EXAMPLE),
    param('legStock', ex.legStock, EXAMPLE, stockNote),
    param('crossbarStock', ex.crossbarStock, EXAMPLE),
    crossbarHeight(typeof height.value === 'number' ? height.value : null),
    param('gussetStock', ex.gussetStock, EXAMPLE),
    param('groundSlope', answers.ground.kind === 'sloped' ? answers.ground.slope : 0, ANSWER),
    answers.feet === 'pads'
      ? param('burialDepth', 0, ANSWER)
      : param(
          'burialDepth',
          ex.burialDepth,
          EXAMPLE,
          'Settle the depth with an experienced builder; the plan flags it.',
        ),
    param('swings.hangerSpacing', ex.swings.seatWidth, {
      kind: 'rule-of-thumb',
      rule: 'hangers as far apart as the seat is wide, so the chains hang straight',
    }),
    param('swings.seatWidth', ex.swings.seatWidth, EXAMPLE),
    param('swings.seatHeight', ex.swings.seatHeight, EXAMPLE, 'Chains adjust it later.'),
    ...answers.riderWeights.map(
      (weight, i): Suggestion => ({
        from: 'structuralInputs',
        path: `riderWeights.${i}`,
        value: weight,
        basis: ANSWER,
      }),
    ),
    {
      from: 'structuralInputs',
      path: 'maxSwingAngle',
      value: 90,
      basis: LARGEST_SWING,
      note: 'A bound, not a guess at how high anyone swings. Enter less if you know it.',
    },
    {
      from: 'structuralInputs',
      path: 'deflectionLimit',
      value: 240,
      basis: FLOOR_DEFLECTION,
      note: 'A swing beam is not in the table, so this borrows the closest member type. A larger number allows less sag.',
    },
    {
      from: 'structuralInputs',
      path: 'beamMoistureContent',
      value: 30,
      basis: FIBER_SATURATION,
      note: 'The plan treats the beam as outdoors and uncovered. Pressure-treated lumber is often sold wetter, which weighs more; enter its moisture if you know it.',
    },
  ];
}

export const SWING_SET_QUESTIONS = startingQuestions({
  form: QUESTIONS,
  answers: SwingSetAnswers,
  suggest,
  examples: [
    // Room for the usual beam, on pads and level ground.
    {
      riders: 'kids',
      riderWeights: [90, 110],
      area: { length: 360, depth: 480 },
      ground: { kind: 'level' },
      feet: 'pads',
    },
    // Room for a shorter, lower beam than usual, buried in sloped ground.
    {
      riders: 'kids-and-adults',
      riderWeights: [200, 90],
      area: { length: 252, depth: 336 },
      ground: { kind: 'sloped', slope: 1 },
      feet: 'buried',
    },
    // Too little room for any beam the template draws.
    {
      riders: 'kids',
      riderWeights: [90, 0],
      area: { length: 240, depth: 192 },
      ground: { kind: 'level' },
      feet: 'pads',
    },
  ],
});

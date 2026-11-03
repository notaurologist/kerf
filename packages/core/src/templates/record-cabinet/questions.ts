import { z } from 'zod';
import type { FormSection } from '../../model/form.ts';
import { type Suggestion, type SuggestionBasis, startingQuestions } from '../../model/questions.ts';
import { formatLength } from '../../units/length.ts';
import { WORKED_EXAMPLE } from './examples.ts';
import { RecordCabinetParams } from './params.ts';

// Starting questions (#314; docs/templates/record-cabinet.md, Starting questions): the window
// the cabinet stands under, and the largest item on the top (#331). The height and width follow the
// owner's choices for this cabinet; the rest of the case comes from the worked example. The board
// stock, allowances, and joint sizes come from a standard and rules of thumb (#317). The moisture
// range and deflection limit are suggested from their sources for the owner to check; the other
// structural inputs are left for the owner (hard rule 3).

const range = (key: 'width') => {
  const field = RecordCabinetParams.shape[key];
  return { min: field.minValue ?? 0, max: field.maxValue ?? Infinity };
};

const CabinetAnswers = z.object({
  window: z.object({
    /** A: floor to the top of the window stool. */
    stoolHeight: z.number().positive(),
    /** B: how far the stool sticks out from the wall. */
    stoolDepth: z.number().min(0),
    /** C: floor to the bottom of the apron under the stool. */
    apronBottom: z.number().positive(),
    /** D: the width of the window's casing, outside to outside. */
    casingWidth: z.number().positive(),
    /** E: the stool's width, end to end. */
    stoolWidth: z.number().positive(),
  }),
  topItem: RecordCabinetParams.shape.topItem,
  /** Where the boards come from: a store's fixed widths, or a dealer's by the board foot. */
  lumber: z.object({ source: z.enum(['store', 'dealer']) }),
});
type CabinetAnswers = z.infer<typeof CabinetAnswers>;

const QUESTIONS: readonly FormSection[] = [
  {
    title: 'The window',
    help: 'Measure the window the cabinet stands under.',
    fields: [
      {
        path: 'window.stoolHeight',
        label: 'Stool height (A)',
        kind: 'length',
        help: 'Floor to the top of the window stool.',
      },
      {
        path: 'window.stoolDepth',
        label: 'Stool depth (B)',
        kind: 'length',
        help: 'How far the stool sticks out from the wall.',
      },
      {
        path: 'window.apronBottom',
        label: 'Apron bottom (C)',
        kind: 'length',
        help: 'Floor to the bottom of the trim under the stool.',
      },
      {
        path: 'window.casingWidth',
        label: 'Casing width (D)',
        kind: 'length',
        help: 'Outside edge to outside edge of the trim around the window.',
      },
      {
        path: 'window.stoolWidth',
        label: 'Stool width (E)',
        kind: 'length',
        help: 'End to end of the stool.',
      },
    ],
  },
  {
    title: 'Lumber',
    fields: [
      {
        path: 'lumber.source',
        label: 'Where you will buy the boards',
        kind: 'choice',
        options: [
          { value: 'store', label: 'A home center, in fixed widths' },
          { value: 'dealer', label: 'A lumber dealer, by the board foot' },
        ],
      },
    ],
  },
  {
    title: 'On the top',
    help: 'The largest item that will stand on the cabinet. Make sure anything else you put there fits too.',
    fields: [
      { path: 'topItem.width', label: 'Largest item, width', kind: 'length' },
      { path: 'topItem.depth', label: 'Largest item, depth', kind: 'length' },
      {
        path: 'topItem.height',
        label: 'Largest item, height',
        kind: 'length',
        help: 'At its tallest, such as with a lid open.',
      },
    ],
  },
];

const ANSWER: SuggestionBasis = { kind: 'answer' };
const EXAMPLE: SuggestionBasis = { kind: 'example' };
/** The base and its joints (spec, The Shaker-modern base): the owner's and rules of thumb. */
const BASE = {
  legShowing: 5,
  apronHeight: 2.5,
  legSize: 1.5,
  legLengths: [3, 4],
  apronSetback: 0.125,
} as const;
/** The doors' tracks and frames: rules of thumb (spec, Sliding doors on the end bays). */
export const SUGGESTED_DOOR = {
  clearance: 0.0625,
  land: 0.25,
  bottomDepth: 0.25,
  topDepth: 0.5625,
  overlap: 0.5,
  frameWidth: 2,
  grooveDepth: 0.375,
} as const;
const DOOR_RULES: Record<keyof typeof SUGGESTED_DOOR, string> = {
  clearance: 'each track 1/16" wider than the door is thick, so it slides freely',
  land: '1/4" of wood between the tracks and at their edges',
  bottomDepth: 'each door seated 1/4" in its bottom track',
  topDepth:
    'twice the bottom track’s depth, plus 1/16", so a door lifts up out of the bottom track',
  overlap: 'each door 1/2" past the partition, so no gap shows when it is closed',
  frameWidth: 'a 2" frame, in Shaker proportion',
  grooveDepth: 'a 3/8" groove for the panel and stub tenons',
};
const sixteenthsDown = (x: number) => Math.floor(x * 16) / 16;

/** A 1x6 board, dry, from the American Softwood Lumber Standard. */
const ONE_BY_SIX: SuggestionBasis = {
  kind: 'source',
  citation: 'American Softwood Lumber Standard, PS 20-10, Table 3, a dry 1x6 board',
};
const MEASURE = 'Measure the boards at your store.';

/** Moisture content for interior woodwork, individual pieces, most of the United States. */
const INDOORS: SuggestionBasis = {
  kind: 'source',
  citation:
    'Wood Handbook (2021), Table 13-2, interior woodwork in most of the United States, 6% to 10%',
};
const DAMP_COAST = 'In damp, warm coastal areas the same table gives 8% to 13%.';
/** L/144 for shelves (spec, Structural model). */
const SHELF_DEFLECTION: SuggestionBasis = {
  kind: 'source',
  citation:
    'Architectural Woodwork Standards (2009), Section 10, 1.2.21.3.1.1, the industry standard for shelves',
};

/** Rules of thumb for the panels and joints, with nothing published behind them. */
const PANEL_RULES = {
  'allowances.jointPerEdge': {
    value: 0.0625,
    rule: 'one or two light cuts on the jointer for each glued edge',
  },
  'allowances.rip': { value: 0.5, rule: 'about 1/2" of extra width, ripped off after glue-up' },
  'allowances.trimPerEnd': {
    value: 1,
    rule: 'boards about 2" over length, cut off with the panel’s ends',
  },
  'allowances.flatten': {
    value: 0.0625,
    rule: 'about 1/16" off a glued-up panel to level its joints',
  },
  stoppedSetback: { value: 0.5, rule: 'far enough back that the end of the dado does not show' },
} as const;

/** The suggested 1x6 board, and the store lengths of the worked example. */
const BOARD = { thickness: 0.75, width: 5.5 } as const;
const STORE_LENGTHS = [4, 6, 8] as const;

/** A dealer's 4/4 hardwood surfaced two sides, the class that flattens to a 3/4" panel. */
const DEALER = {
  quarters: 4,
  surfaced: 0.8125,
  planWidth: 6,
  wastePercent: 20,
} as const;
const DEALER_SOURCES = {
  surfaced: 'Wood Handbook (2021), ch. 6, Table 6-4: 4/4 hardwood surfaced two sides is 13/16"',
  planWidth:
    'Wood Handbook (2021), ch. 6, pp. 6-3 to 6-4: hardwood comes in random widths, and FAS, the top grade, is at least 6" wide',
} as const;

/** The panel the board flattens to, and a quarter of it, rounded down to a 1/16" router setting. */
function panelAndDado(board: number): { panel: number; dado: number } {
  const panel = board - PANEL_RULES['allowances.flatten'].value;
  return { panel, dado: Math.floor((panel / 4) * 16) / 16 };
}

/** A suggestion inside the parameter's range, or none, with what the answers allow. */
function within(path: 'width', value: number, basis: SuggestionBasis, note?: string): Suggestion {
  const { min, max } = range(path);
  const base = { from: 'params' as const, path, basis };
  if (value >= min && value <= max) return { ...base, value, ...(note ? { note } : {}) };
  return {
    ...base,
    value: null,
    note: `That gives ${formatLength(value)}, outside ${formatLength(min)} to ${formatLength(max)}, the range this template covers.`,
  };
}

function suggest(a: CabinetAnswers): Suggestion[] {
  const w = a.window;
  const dealer = a.lumber.source === 'dealer';
  const { panel, dado } = panelAndDado(dealer ? DEALER.surfaced : BOARD.thickness);
  // The top's height follows from the base and the bays (owner, November 1, 2026: "taller cabinet").
  const boardThickness = dealer ? DEALER.surfaced : BOARD.thickness;
  const height = BASE.legShowing + BASE.apronHeight + 2 * panel + WORKED_EXAMPLE.bayHeight;
  const aboveStool = height - w.stoolHeight;
  const standsOff =
    height > w.apronBottom
      ? ` The top is above the bottom of the stool's apron, so the cabinet stands at least ${formatLength(w.stoolDepth)} from the wall, clear of the stool.`
      : '';
  const rule = (text: string): SuggestionBasis => ({ kind: 'rule-of-thumb', rule: text });
  const example = (path: keyof typeof WORKED_EXAMPLE): Suggestion => ({
    from: 'params',
    path,
    value: WORKED_EXAMPLE[path] as number,
    basis: EXAMPLE,
  });
  return [
    {
      from: 'params',
      path: 'legShowing',
      value: BASE.legShowing,
      basis: rule('about 5" of leg below the aprons, the owner\'s choice for this cabinet'),
      note: `With these sizes the top is ${formatLength(height)} high${aboveStool > 0 ? `, ${formatLength(aboveStool)} above the window stool` : ''}.${standsOff}`,
    },
    {
      from: 'params',
      path: 'apronHeight',
      value: BASE.apronHeight,
      basis: rule('a 2-1/2" apron, in mid-century proportion to the legs'),
    },
    {
      from: 'params',
      path: 'legStock.size',
      value: BASE.legSize,
      basis: rule('1-1/2" square hardwood, as home centers and dealers sell it'),
      note: 'Measure the leg stock at your store.',
    },
    ...BASE.legLengths.map(
      (feet, i): Suggestion => ({
        from: 'params',
        path: `legStock.lengths.${i}`,
        value: feet,
        basis: rule("short lengths, since four legs take under 3'"),
        ...(i === 0 ? { note: 'Change these to the lengths your store sells.' } : {}),
      }),
    ),
    {
      from: 'params',
      path: 'footSize',
      value: sixteenthsDown((2 / 3) * BASE.legSize),
      basis: rule('a foot two-thirds the leg, for a Shaker taper'),
    },
    {
      from: 'params',
      path: 'apronSetback',
      value: BASE.apronSetback,
      basis: rule('a 1/8" step back from the leg, for a shadow line'),
    },
    {
      from: 'params',
      path: 'tenonThickness',
      value: sixteenthsDown(boardThickness / 3),
      basis: rule('a tenon a third of the apron’s thickness, rounded down to 1/16"'),
    },
    {
      from: 'params',
      path: 'tenonLength',
      value: BASE.legSize / 2 + 0.25,
      basis: rule('half the leg plus 1/4", mitered where two tenons meet'),
    },
    example('bayHeight'),
    {
      from: 'params',
      path: 'doors',
      value: 'sliding',
      basis: rule('two sliding doors over the end bays, the owner’s choice for this cabinet'),
    },
    ...Object.entries(DOOR_RULES).map(
      ([key, text]): Suggestion => ({
        from: 'params',
        path: `door.${key}`,
        value: SUGGESTED_DOOR[key as keyof typeof SUGGESTED_DOOR],
        basis: rule(text),
      }),
    ),
    within(
      'width',
      w.casingWidth,
      {
        kind: 'rule-of-thumb',
        rule: "as wide as the window's casing, the owner's choice for this cabinet",
      },
      `The stool is ${formatLength(w.stoolWidth)} wide, for comparison.`,
    ),
    ...(['caseDepth', 'bays', 'endOverhang', 'frontOverhang', 'railHeight'] as const).map(example),
    {
      from: 'params',
      path: 'panelThickness',
      value: panel,
      basis: { kind: 'rule-of-thumb', rule: 'the board thickness less the flattening' },
    },
    {
      from: 'params',
      path: 'dadoDepth',
      value: dado,
      basis: {
        kind: 'rule-of-thumb',
        rule: 'a dado at most a third of the thickness it is cut into. A partition has one on each face, so at most a quarter of the panel thickness, rounded down to 1/16", leaves at least half of it between them',
      },
    },
    example('jacket'),
    {
      from: 'params',
      path: 'board.thickness',
      value: BOARD.thickness,
      basis: ONE_BY_SIX,
      note: MEASURE,
    },
    { from: 'params', path: 'board.width', value: BOARD.width, basis: ONE_BY_SIX, note: MEASURE },
    { from: 'params', path: 'board.source', value: a.lumber.source, basis: ANSWER },
    // Both kinds are suggested, so changing where you buy shows filled fields either way.
    {
      from: 'params',
      path: 'board.quarters',
      value: DEALER.quarters,
      basis: { kind: 'rule-of-thumb', rule: 'the thinnest class that flattens to a 3/4" panel' },
    },
    {
      from: 'params',
      path: 'board.surfaced',
      value: DEALER.surfaced,
      basis: { kind: 'source', citation: DEALER_SOURCES.surfaced },
      note: 'Ask the dealer to surface two sides, and measure the boards.',
    },
    {
      from: 'params',
      path: 'board.planWidth',
      value: DEALER.planWidth,
      basis: { kind: 'source', citation: DEALER_SOURCES.planWidth },
      note: 'Wider boards need fewer; the plan says how wide each must be at least.',
    },
    {
      from: 'params',
      path: 'board.wastePercent',
      value: DEALER.wastePercent,
      basis: {
        kind: 'rule-of-thumb',
        rule: 'about a fifth more for defects, checked ends, and offcuts',
      },
    },
    ...STORE_LENGTHS.map(
      (feet, i): Suggestion => ({
        from: 'params',
        path: `board.lengths.${i}`,
        value: feet,
        basis: EXAMPLE,
        ...(i === 0 ? { note: 'Change these to the lengths your store sells.' } : {}),
      }),
    ),
    ...Object.entries(PANEL_RULES).map(
      ([path, { value, rule }]): Suggestion => ({
        from: 'params',
        path,
        value,
        basis: { kind: 'rule-of-thumb', rule },
      }),
    ),
    { from: 'structuralInputs', path: 'moisture.low', value: 6, basis: INDOORS, note: DAMP_COAST },
    { from: 'structuralInputs', path: 'moisture.high', value: 10, basis: INDOORS },
    {
      from: 'structuralInputs',
      path: 'deflectionLimit',
      value: 144,
      basis: SHELF_DEFLECTION,
      note: 'A larger number allows less sag.',
    },
    ...(['width', 'depth', 'height'] as const).map(
      (k): Suggestion => ({
        from: 'params',
        path: `topItem.${k}`,
        value: a.topItem[k],
        basis: ANSWER,
        ...(k === 'height' && aboveStool + a.topItem.height > 0
          ? {
              note: `On the ${formatLength(height)} top, it stands ${formatLength(height + a.topItem.height - w.stoolHeight)} above the window stool, in front of the window.`,
            }
          : {}),
      }),
    ),
  ];
}

export const CABINET_QUESTIONS = startingQuestions({
  form: QUESTIONS,
  answers: CabinetAnswers,
  suggest,
  examples: [
    // Under a window, so the top item stands above the stool, with boards from a store.
    {
      window: {
        stoolHeight: 22,
        stoolDepth: 2.5,
        apronBottom: 18,
        casingWidth: 54,
        stoolWidth: 56,
      },
      topItem: { width: 16.5, depth: 13.5, height: 15 },
      lumber: { source: 'store' },
    },
    // A high window, wider than the template covers, with boards from a dealer.
    {
      window: { stoolHeight: 40, stoolDepth: 1, apronBottom: 36, casingWidth: 80, stoolWidth: 84 },
      topItem: { width: 12, depth: 12, height: 4 },
      lumber: { source: 'dealer' },
    },
  ],
});

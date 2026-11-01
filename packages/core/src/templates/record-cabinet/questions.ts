import { z } from 'zod';
import type { FormSection } from '../../model/form.ts';
import { type Suggestion, type SuggestionBasis, startingQuestions } from '../../model/questions.ts';
import { formatLength } from '../../units/length.ts';
import { WORKED_EXAMPLE } from './examples.ts';
import { RecordCabinetParams } from './params.ts';

// Starting questions (#314; docs/templates/record-cabinet.md, Starting questions): the window
// the cabinet stands under, and the turntable and speaker. The height and width follow the
// owner's choices for this cabinet; the rest of the case comes from the worked example. The board
// stock, allowances, and joint sizes come from a standard and rules of thumb (#317). Every
// structural input is left for the owner (hard rule 3).

const range = (key: 'height' | 'width') => {
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
  turntable: RecordCabinetParams.shape.turntable,
  speaker: RecordCabinetParams.shape.speaker,
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
    title: 'Turntable and speaker',
    fields: [
      { path: 'turntable.width', label: 'Turntable width', kind: 'length' },
      { path: 'turntable.depth', label: 'Turntable depth', kind: 'length' },
      { path: 'turntable.lidHeight', label: 'Turntable height, lid open', kind: 'length' },
      { path: 'speaker.width', label: 'Speaker width', kind: 'length' },
      { path: 'speaker.height', label: 'Speaker height', kind: 'length' },
      { path: 'speaker.depth', label: 'Speaker depth', kind: 'length' },
      {
        path: 'speaker.place',
        label: 'Speaker place',
        kind: 'choice',
        options: [
          { value: 'top', label: 'On the top' },
          ...[1, 2, 3, 4].map((k) => ({ value: k, label: `Bay ${k}, from the left` })),
        ],
      },
    ],
  },
];

const ANSWER: SuggestionBasis = { kind: 'answer' };
const EXAMPLE: SuggestionBasis = { kind: 'example' };
/** The owner's choice for this cabinet (spec, Starting questions): 2" below the stool. */
const BELOW_STOOL = 2;

/** A 1x6 board, dry, from the American Softwood Lumber Standard. */
const ONE_BY_SIX: SuggestionBasis = {
  kind: 'source',
  citation: 'American Softwood Lumber Standard, PS 20-10, Table 3, a dry 1x6 board',
};
const MEASURE = 'Measure the boards at your store.';

/** Rules of thumb for the panels and joints, with nothing published behind them. */
const PANEL_RULES = {
  'allowances.jointPerEdge': {
    value: 0.0625,
    rule: 'one or two jointer passes on each glued edge',
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
function within(
  path: 'height' | 'width',
  value: number,
  basis: SuggestionBasis,
  note?: string,
): Suggestion {
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
  const height = w.stoolHeight - BELOW_STOOL;
  const standsOff =
    height > w.apronBottom
      ? `The top is above the bottom of the apron, so the cabinet stands at least ${formatLength(w.stoolDepth)} from the wall, clear of the stool.`
      : undefined;
  const example = (path: keyof typeof WORKED_EXAMPLE): Suggestion => ({
    from: 'params',
    path,
    value: WORKED_EXAMPLE[path] as number,
    basis: EXAMPLE,
  });
  return [
    within(
      'height',
      height,
      {
        kind: 'rule-of-thumb',
        rule: `the top ${formatLength(BELOW_STOOL)} below the window stool, the owner's choice for this cabinet`,
      },
      standsOff,
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
    ...(
      [
        'caseDepth',
        'bays',
        'endOverhang',
        'frontOverhang',
        'shelfHeight',
        'cutoutHeight',
        'footWidth',
        'railHeight',
      ] as const
    ).map(example),
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
    ...(['width', 'depth', 'lidHeight'] as const).map(
      (k): Suggestion => ({
        from: 'params',
        path: `turntable.${k}`,
        value: a.turntable[k],
        basis: ANSWER,
      }),
    ),
    ...(['width', 'height', 'depth', 'place'] as const).map(
      (k): Suggestion => ({
        from: 'params',
        path: `speaker.${k}`,
        value: a.speaker[k],
        basis: ANSWER,
      }),
    ),
  ];
}

export const CABINET_QUESTIONS = startingQuestions({
  form: QUESTIONS,
  answers: CabinetAnswers,
  suggest,
});

import { z } from 'zod';
import { ROUND_HOLDING_HOLE } from '../../knowledge/holes.ts';
import { standingHeightField, wristWorkHeight } from '../../knowledge/workHeight.ts';
import { typicalDrawerSlideSuggestions } from '../../model/drawerSlide.ts';
import type { FormSection } from '../../model/form.ts';
import { type Suggestion, type SuggestionBasis, startingQuestions } from '../../model/questions.ts';
import { formatLength } from '../../units/length.ts';
import { WORKED_EXAMPLE } from './examples.ts';
import { WorkbenchParams } from './params.ts';

// Starting questions (docs/templates/workbench.md, Starting questions): the owner's height, which
// suggests the bench's (#582); the space it goes in, which caps the top's length and depth; and
// where the boards come from. The rest comes from the worked example and the spec's rules of
// thumb. The slides' typical figures are suggested for the owner to check against their slides;
// the hinges' and vise screws' figures are left for the owner (hard rule 3). The moisture range
// and deflection limit are suggested from their sources, unconfirmed until the owner ticks them.

const Answers = z.object({
  /** The owner's standing height. */
  stature: z.number().min(48).max(90),
  /** The floor space the bench stands in, with both vises closed. */
  space: z.object({ length: z.number().positive(), depth: z.number().positive() }),
  lumber: z.object({ source: z.enum(['store', 'dealer']) }),
});
type Answers = z.infer<typeof Answers>;

const QUESTIONS: readonly FormSection[] = [
  { title: 'You', fields: [standingHeightField('stature')] },
  {
    title: 'The space',
    help: 'Measure the floor where the bench will stand. Leave room to walk round it and to turn a long board.',
    fields: [
      {
        path: 'space.length',
        label: 'Longest bench that fits',
        kind: 'length',
        help: 'End to end, with the end vise closed.',
      },
      {
        path: 'space.depth',
        label: 'Deepest bench that fits',
        kind: 'length',
        help: 'Front to back, with the face vise closed.',
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
];

const ANSWER: SuggestionBasis = { kind: 'answer' };
const EXAMPLE: SuggestionBasis = { kind: 'example' };
const rule = (text: string): SuggestionBasis => ({ kind: 'rule-of-thumb', rule: text });
const sixteenthsDown = (x: number) => Math.floor(x * 16) / 16;
const param = (path: string, value: number | string, basis: SuggestionBasis, note?: string) =>
  ({ from: 'params', path, value, basis, ...(note ? { note } : {}) }) satisfies Suggestion;

type Bounded = 'height' | 'topLength' | 'topDepth';
/** A suggestion inside the parameter's range, or none, with what the answers allow. */
function within(path: Bounded, value: number, basis: SuggestionBasis, note?: string): Suggestion {
  const field = WorkbenchParams.shape[path];
  const min = field.minValue ?? 0;
  const max = field.maxValue ?? Infinity;
  if (value >= min && value <= max) return param(path, value, basis, note);
  return {
    from: 'params',
    path,
    value: null,
    basis,
    note: `That gives ${formatLength(value)}, outside ${formatLength(min)} to ${formatLength(max)}, the range this template covers.`,
  };
}

/** Moisture content for interior woodwork, individual pieces, most of the United States. */
const INDOORS: SuggestionBasis = {
  kind: 'source',
  citation:
    'Wood Handbook (2021), Table 13-2, interior woodwork in most of the United States, 6% to 10%',
};
const SHELF_DEFLECTION: SuggestionBasis = {
  kind: 'source',
  citation:
    'Architectural Woodwork Standards (2009), Section 10, 1.2.21.3.1.1, the industry standard for shelves',
};
const ONE_BY_SIX: SuggestionBasis = {
  kind: 'source',
  citation: 'American Softwood Lumber Standard, PS 20-10, Table 3, a dry 1x6 board',
};
const MEASURE = 'Measure the boards at your store.';
/** A dealer's 4/4 hardwood surfaced two sides. */
const DEALER = { quarters: 4, surfaced: 0.8125, planWidth: 6, wastePercent: 20 } as const;
const STORE = { thickness: 0.75, width: 5.5, lengths: [6, 8, 10] } as const;
const FLATTEN = 0.0625;

/** Every size but the three the answers set, from the spec's examples and rules of thumb. */
function sizes(boardThickness: number): Suggestion[] {
  const w = WORKED_EXAMPLE;
  const panel = boardThickness - FLATTEN;
  const legs = w.legSize;
  const rails = legs / 2;
  return [
    param('topThickness', w.topThickness, rule('a 2-1/2" top, as you chose for this bench')),
    param('chopThickness', w.chopThickness, rule('chops as thick as the top')),
    param('overhangEnds', w.overhangEnds, EXAMPLE),
    param(
      'overhangFront',
      w.overhangFront,
      rule('flush with the front legs, so work in the face vise rests against the leg'),
    ),
    param('overhangBack', w.overhangBack, EXAMPLE),
    param('legSize', legs, EXAMPLE),
    param('footHeight', w.footHeight, EXAMPLE),
    param('footPast', w.footPast, EXAMPLE),
    param('lowRailHeight', w.lowRailHeight, EXAMPLE),
    param('endRailHeight', w.endRailHeight, rule('as tall as the low rails')),
    param('railThickness', rails, rule('half the leg')),
    param(
      'railTenon.thickness',
      sixteenthsDown(rails / 3),
      rule('a tenon a third of the rail’s thickness, rounded down to 1/16"'),
    ),
    param('railTenon.length', legs / 2 + 0.25, rule('half the leg plus 1/4"')),
    param('railTenon.shoulder', 0.25, rule('1/4" shoulders above and below')),
    param(
      'legTenon.thickness',
      sixteenthsDown(legs / 3),
      rule('a tenon a third of the leg, rounded down to 1/16"'),
    ),
    param('legTenon.shoulder', 0.25, rule('1/4" shoulders each side')),
    param('legTenon.footLength', w.footHeight / 2 + 0.25, rule('half the foot plus 1/4"')),
    param('caseThickness', panel, rule('the board thickness less the flattening')),
    param(
      'dadoDepth',
      sixteenthsDown(panel / 4),
      rule('a quarter of the panel thickness, rounded down to 1/16"'),
    ),
    param('stopSetback', 0.5, rule('far enough back that the end of the dado does not show')),
    param('drawerBand', w.drawerBand, EXAMPLE),
    param('upperOpening', w.upperOpening, EXAMPLE),
    param('back.grooveWidth', 0.25, rule('a 1/4" groove, the width of a common straight bit')),
    param('back.grooveDepth', 0.375, rule('a 3/8" groove, deep enough to hold the panel as it moves')),
    param('back.inset', 0.375, rule('3/8" in from the case’s back edge')),
    param('back.shelfGap', 0.0625, rule('the lower shelves 1/16" clear of the back')),
    param('drawer.boxThickness', 0.5, rule('1/2" box parts, planed from the board stock')),
    param('drawer.bottomThickness', 0.5, rule('a 1/2" solid bottom, planed from the board stock')),
    param('drawer.frontThickness', boardThickness, rule('fronts as thick as the board stock')),
    param('drawer.frontGap', 0.0625, rule('1/16" all round an inset front')),
    param('drawer.clearance', 0.25, rule('each box 1/4" clear of its opening above and below')),
    param('drawer.groove.width', 0.25, rule('a 1/4" groove for the bottom')),
    param('drawer.groove.depth', 0.25, rule('a 1/4" deep groove for the bottom')),
    param('drawer.groove.up', 0.25, rule('the bottom’s groove 1/4" up from the box’s edge')),
    param('drawer.slope', 8, { kind: 'convention', name: 'a 1 in 8 dovetail slope in hardwood' }),
    ...typicalDrawerSlideSuggestions('slides'),
    param('door.gap', 0.0625, rule('1/16" round and between inset doors')),
    param('door.frameWidth', 2, rule('a 2" frame, in Shaker proportion')),
    param('door.grooveWidth', 0.25, rule('a 1/4" groove for the panel and stub tenons')),
    param('door.grooveDepth', 0.375, rule('a 3/8" groove for the panel and stub tenons')),
    param('door.hingeFromEnd', 3, rule('each hinge cup 3" from the door’s end')),
    param('vise.face.height', w.vise.face.height, rule('a chop 14" tall, from your photo')),
    param(
      'vise.face.screwBelow',
      w.vise.face.screwBelow,
      rule('the screw 4" below the top, clear of the end rail'),
    ),
    param(
      'vise.end.blockHeight',
      w.vise.end.blockHeight,
      rule('a block 3-1/2" deep under the top'),
    ),
    param(
      'vise.dogs.diameter',
      ROUND_HOLDING_HOLE.diameter,
      ROUND_HOLDING_HOLE.basis,
      ROUND_HOLDING_HOLE.note,
    ),
    param('vise.dogs.spacing', 4, rule('dog holes 4" apart, less than the vise opens')),
    param('vise.dogs.fromFront', 2, rule('dog holes 2" in from the front edge')),
    param('vise.dogs.stopShort', 0.25, rule('1/4" of wood left under a stopped dog hole')),
    param('allowances.jointPerEdge', 0.0625, rule('one or two light cuts on the jointer')),
    param('allowances.rip', 0.5, rule('about 1/2" of extra width, ripped off after glue-up')),
    param('allowances.trimPerEnd', 1, rule('boards about 2" over length')),
    param('allowances.flatten', FLATTEN, rule('about 1/16" off a glue-up to level it')),
    param('kerf', 0.125, rule('a full-kerf saw blade cuts about 1/8" wide')),
  ];
}

function suggest(a: Answers): Suggestion[] {
  const dealer = a.lumber.source === 'dealer';
  const boardThickness = dealer ? DEALER.surfaced : STORE.thickness;
  const { value, basis, note } = wristWorkHeight(a.stature);
  const c = WORKED_EXAMPLE.chopThickness;
  const withinSpace = (path: 'topLength' | 'topDepth', example: number, space: number) =>
    space - c >= example
      ? param(path, example, EXAMPLE)
      : within(
          path,
          space - c,
          rule('as long as the space allows, less the vise’s chop'),
          `The space is ${formatLength(space)}; the chop is ${formatLength(c)} of it.`,
        );
  return [
    within('height', value, basis, note),
    withinSpace('topLength', WORKED_EXAMPLE.topLength, a.space.length),
    withinSpace('topDepth', WORKED_EXAMPLE.topDepth, a.space.depth),
    ...sizes(boardThickness),
    param('board.source', a.lumber.source, ANSWER),
    param('board.thickness', STORE.thickness, ONE_BY_SIX, MEASURE),
    param('board.width', STORE.width, ONE_BY_SIX, MEASURE),
    ...STORE.lengths.map((feet, i) =>
      param(
        `board.lengths.${i}`,
        feet,
        rule('lengths past the top’s, which takes the longest boards'),
        i === 0 ? 'Change these to the lengths your store sells.' : undefined,
      ),
    ),
    param('board.quarters', DEALER.quarters, rule('the thinnest class that flattens to 3/4"')),
    param(
      'board.surfaced',
      DEALER.surfaced,
      {
        kind: 'source',
        citation:
          'Wood Handbook (2021), ch. 6, Table 6-4: 4/4 hardwood surfaced two sides is 13/16"',
      },
      'Ask the dealer to surface two sides, and measure the boards.',
    ),
    param(
      'board.planWidth',
      DEALER.planWidth,
      {
        kind: 'source',
        citation:
          'Wood Handbook (2021), ch. 6, pp. 6-3 to 6-4: hardwood comes in random widths, and FAS, the top grade, is at least 6" wide',
      },
      'Wider boards need fewer; the plan says how wide each must be at least.',
    ),
    param(
      'board.wastePercent',
      DEALER.wastePercent,
      rule('about a fifth more for defects, checked ends, and offcuts'),
    ),
    {
      from: 'structuralInputs',
      path: 'moisture.low',
      value: 6,
      basis: INDOORS,
      note: 'In damp, warm coastal areas the same table gives 8% to 13%. A garage that is not heated can be wetter.',
    },
    { from: 'structuralInputs', path: 'moisture.high', value: 10, basis: INDOORS },
    {
      from: 'structuralInputs',
      path: 'deflectionLimit',
      value: 144,
      basis: SHELF_DEFLECTION,
      note: 'A bench may want stiffer; a larger number allows less sag.',
    },
  ];
}

export const WORKBENCH_QUESTIONS = startingQuestions({
  form: QUESTIONS,
  answers: Answers,
  suggest,
  examples: [
    // The owner's garage: room for the worked example, with boards from a store.
    { stature: 70.375, space: { length: 96, depth: 36 }, lumber: { source: 'store' } },
    // A tight corner, shorter than the example, and a tall owner past the range.
    { stature: 90, space: { length: 50, depth: 18 }, lumber: { source: 'dealer' } },
    // A space too small for any bench this template makes.
    { stature: 66, space: { length: 30, depth: 12 }, lumber: { source: 'store' } },
  ],
});

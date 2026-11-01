import { WOOD_SPECIES } from '../../design-values/woodSpecies.ts';
import type { FormField, TemplateForm } from '../../model/form.ts';
import { STRUCTURAL_INPUT_LABELS as INPUT } from './structural.ts';

// How the record cabinet's parameters and structural inputs are entered (spec, Parameters and
// Structural model). The board stock, allowances, and joint sizes start from standard sizes and
// rules of thumb, which each field's help gives, so a beginner need not know them (#317).

const length = (path: string, label: string, help?: string): FormField => ({
  path,
  label,
  kind: 'length',
  ...(help ? { help } : {}),
});

const fromDealer = (value: (path: string) => string) => value('board.source') === 'dealer';
const fromStore = (value: (path: string) => string) => !fromDealer(value);

export const RECORD_CABINET_FORM: TemplateForm = {
  help: 'Measure the window and one of your records before you enter sizes. The joint sizes, boards, and allowances start from usual values: check the boards at your store, and change any of them.',
  params: [
    {
      title: 'Size',
      fields: [
        length('width', 'Overall width', 'Length of the top, end to end.'),
        length('height', 'Overall height', 'Floor to the top surface.'),
        length('caseDepth', 'Case depth', 'Front to back of the sides and shelves.'),
        {
          path: 'bays',
          label: 'Bays',
          kind: 'integer',
          unit: 'bays',
          help: 'Equal open bays, side by side.',
        },
        length('endOverhang', 'Top overhang at each end'),
        length('frontOverhang', 'Top overhang at the front'),
      ],
    },
    {
      title: 'Bays and feet',
      fields: [
        length('jacket', 'Record jacket', 'Measure one of your records.'),
        length('shelfHeight', 'Shelf height', 'Floor to the underside of the bottom shelves.'),
        length(
          'cutoutHeight',
          'Cutout height',
          'Height of the opening between the feet; 0 for none.',
        ),
        length('footWidth', 'Foot width', 'Front to back width of each foot.'),
        length('railHeight', 'Back rail height'),
      ],
    },
    {
      title: 'Panels and joints',
      fields: [
        length(
          'panelThickness',
          'Panel thickness',
          'What is left after flattening the glued-up panels: the board thickness less the flattening.',
        ),
        length(
          'dadoDepth',
          'Dado depth',
          'Every dado. A dado is usually at most a third of the thickness it is cut into. A partition has one on each face, so a quarter of the panel thickness leaves half of it between them.',
        ),
        length(
          'stoppedSetback',
          'Stopped dado setback',
          'How far the dadoes under the top stop short of the front, so they do not show. About 1/2" is usual.',
        ),
      ],
    },
    {
      title: 'Lumber',
      help: 'The boards the panels are glued from. A store sells them in fixed widths and lengths; a dealer sells hardwood by the board foot, in random widths and lengths from 4 to 16 feet.',
      fields: [
        {
          path: 'board.source',
          label: 'Where you buy the boards',
          kind: 'choice',
          options: [
            { value: 'store', label: 'A home center, in fixed widths' },
            { value: 'dealer', label: 'A lumber dealer, by the board foot' },
          ],
        },
        {
          ...length(
            'board.thickness',
            'Board thickness',
            'Measure a board. A 1x board is 3/4" thick (American Softwood Lumber Standard).',
          ),
          when: fromStore,
        },
        {
          ...length('board.width', 'Board width', 'Measure a board. A 1x6 is 5-1/2" wide.'),
          when: fromStore,
        },
        ...[0, 1, 2, 3].map(
          (i): FormField => ({
            path: `board.lengths.${i}`,
            label: `Length sold ${i + 1}`,
            kind: 'integer',
            unit: 'ft',
            when: fromStore,
            ...(i > 0 ? { optional: true as const } : {}),
            ...(i === 0
              ? {
                  help: 'The lengths the store sells this board in, from its rack or website. Leave any you do not need empty.',
                }
              : {}),
          }),
        ),
        {
          path: 'board.quarters',
          label: 'Thickness class',
          kind: 'choice',
          options: [4, 5, 6, 8].map((q) => ({ value: q, label: `${q}/4` })),
          help: 'Hardwood thickness in quarter inches, rough: 4/4 is about 1".',
          when: fromDealer,
        },
        {
          ...length(
            'board.surfaced',
            'Thickness, surfaced two sides',
            'Ask the dealer to surface two sides. 4/4 surfaces to 13/16" (Wood Handbook, Table 6-4).',
          ),
          when: fromDealer,
        },
        {
          ...length(
            'board.planWidth',
            'Board width to plan with',
            'Boards come in random widths; the plan counts boards this wide, and says how wide each must be at least.',
          ),
          when: fromDealer,
        },
        {
          path: 'board.wastePercent',
          label: 'Extra for waste',
          kind: 'number',
          unit: '%',
          help: 'Board feet bought beyond what the plan uses, for defects and offcuts. About 20% is usual.',
          when: fromDealer,
        },
        length(
          'allowances.jointPerEdge',
          'Jointing, per glued edge',
          'Width planed off each glued edge to make it straight. About 1/16" is usual.',
        ),
        length(
          'allowances.rip',
          'Rip allowance',
          'Extra width on each glued-up panel, ripped off at the end. About 1/2" is usual.',
        ),
        length(
          'allowances.trimPerEnd',
          'Trim, per end',
          'Extra length on each board, cut off with the panel’s ends. About 1" is usual.',
        ),
        length(
          'allowances.flatten',
          'Flattening',
          'Thickness taken off a glued-up panel to make its faces flat and level. About 1/16" is usual, so 3/4" boards make 11/16" panels.',
        ),
      ],
    },
    {
      title: 'On the top',
      help: 'The largest item that will stand on the top. Kerf checks that it fits; make sure anything else you put there fits too.',
      fields: [
        length('topItem.width', 'Largest item, width'),
        length('topItem.depth', 'Largest item, depth'),
        length(
          'topItem.height',
          'Largest item, height',
          'At its tallest, such as with a lid open, to compare with the window.',
        ),
      ],
    },
  ],
  structuralInputs: [
    {
      title: 'Wood',
      fields: [
        {
          path: 'species',
          label: INPUT.species,
          kind: 'choice',
          options: WOOD_SPECIES.map((s) => ({ value: s.id, label: s.name })),
        },
        {
          path: 'orientation',
          label: INPUT.orientation,
          kind: 'choice',
          options: [
            { value: 'flatsawn', label: 'Flatsawn' },
            { value: 'quartersawn', label: 'Quartersawn' },
            { value: 'unknown', label: 'Unknown' },
          ],
        },
        {
          path: 'moisture.low',
          label: 'Lowest moisture content in service',
          kind: 'number',
          unit: '%',
          help: 'How dry the wood gets indoors in the driest part of the year, which sets how much the panels shrink. It is about the room the cabinet stands in, not the lumber as sold. The Wood Handbook gives 6% to 10% for most of the United States and 8% to 13% for damp coastal areas (Table 13-2). Kerf estimates movement from 6% to 14%.',
        },
        {
          path: 'moisture.high',
          label: 'Highest moisture content in service',
          kind: 'number',
          unit: '%',
          help: 'How damp the wood gets indoors in the most humid part of the year, which sets how much the panels swell.',
        },
      ],
    },
    {
      title: 'On the top',
      fields: [
        {
          path: 'topLoad',
          label: INPUT.topLoad,
          kind: 'number',
          unit: 'lb',
          help: 'Everything that will stand on the top together, from the makers’ specifications or a bathroom scale. Kerf checks it all at the middle of one span, where the top bends most.',
        },
      ],
    },
    {
      title: 'Bays and feet',
      fields: [
        {
          path: 'recordLoad',
          label: INPUT.recordLoad,
          kind: 'number',
          unit: 'lb/ft',
          help: 'Weigh a foot of your records.',
        },
        {
          path: 'deflectionLimit',
          label: INPUT.deflectionLimit,
          kind: 'number',
          help: 'How far a shelf or the top may sag, as its span divided by this number: 144 lets a 36" span sag 1/4". The Architectural Woodwork Standards call 144 the industry standard for shelves. A larger number allows less sag.',
        },
      ],
    },
  ],
};

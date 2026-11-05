import { WOOD_SPECIES } from '../../design-values/woodSpecies.ts';
import { cupHingeFields } from '../../model/cupHinge.ts';
import { drawerSlideFields } from '../../model/drawerSlide.ts';
import type { FormField, TemplateForm } from '../../model/form.ts';
import { viseScrewFields } from '../../model/viseScrew.ts';
import { STRUCTURAL_INPUT_LABELS as INPUT } from './structural.ts';

// How the workbench's parameters and structural inputs are entered (spec, Parameters and
// Structural model). Every size starts from a suggestion with its basis; the slides', hinges', and
// vise screws' figures are the owner's, from their makers (hard rule 3).

const length = (path: string, label: string, help?: string): FormField => ({
  path,
  label,
  kind: 'length',
  ...(help ? { help } : {}),
});

const fromDealer = (value: (path: string) => string) => value('board.source') === 'dealer';
const fromStore = (value: (path: string) => string) => !fromDealer(value);

export const WORKBENCH_FORM: TemplateForm = {
  help: 'Start from your height and the space the bench goes in. The joint sizes, boards, and allowances start from usual values; the slides, hinges, and vise screws come from their instructions once you have them.',
  params: [
    {
      title: 'Size',
      fields: [
        length(
          'height',
          'Height',
          'Floor to the top’s surface. About your wrist height suits hand work.',
        ),
        length('topLength', 'Top length', 'End to end of the top, without the end vise’s chop.'),
        length('topDepth', 'Top depth', 'Front to back of the top, without the face vise’s chop.'),
        length('topThickness', 'Top thickness', 'After flattening.'),
        length('overhangEnds', 'Top past the legs at each end'),
        length(
          'overhangFront',
          'Top past the front legs',
          'Flush, 0, lets a long board in the face vise rest against the leg.',
        ),
        length('overhangBack', 'Top past the back legs'),
      ],
    },
    {
      title: 'Base',
      help: 'Four legs on two feet, an end rail under the top at each end, and low rails front and back that carry the case. The legs’ tenons run through the top.',
      fields: [
        length('legSize', 'Leg size', 'Square, glued up from strips of the board stock.'),
        length('footHeight', 'Foot height'),
        length('footPast', 'Feet past the legs', 'Front and back, for a steadier stance.'),
        length('lowRailHeight', 'Low rail height'),
        length('endRailHeight', 'End rail height'),
        length(
          'railThickness',
          'Rail thickness',
          'Thinner than the legs, so the end vise’s screw clears the end rail.',
        ),
        length(
          'railTenon.thickness',
          'Rail tenon thickness',
          'About a third of the rail’s thickness.',
        ),
        length(
          'railTenon.length',
          'Rail tenon length',
          'Into the leg. About half the leg plus 1/4".',
        ),
        length(
          'railTenon.shoulder',
          'Rail tenon shoulders',
          'Above and below the tenon. About 1/4".',
        ),
        length('legTenon.thickness', 'Leg tenon thickness', 'About a third of the leg.'),
        length('legTenon.shoulder', 'Leg tenon shoulders', 'About 1/4" each side.'),
        length('legTenon.footLength', 'Leg tenon into the foot', 'About half the foot plus 1/4".'),
      ],
    },
    {
      title: 'Case',
      help: 'Panels between the legs: two drawers over one under the top, and two doors below.',
      fields: [
        length(
          'caseThickness',
          'Panel thickness',
          'What is left after flattening the glued-up panels.',
        ),
        length('dadoDepth', 'Dado depth', 'About a quarter of the panel thickness.'),
        length(
          'stopSetback',
          'Stopped dado setback',
          'How far the shelves’ dadoes stop short of the front, so they do not show. About 1/2".',
        ),
        length(
          'drawerBand',
          'Drawer band',
          'From the top’s underside down to the doors, shelves included.',
        ),
        length(
          'upperOpening',
          'Upper drawer opening',
          'The lower drawer gets the rest of the band.',
        ),
        length('back.grooveWidth', 'Back groove width'),
        length('back.grooveDepth', 'Back groove depth'),
        length('back.inset', 'Back groove from the back edge'),
        length('back.shelfGap', 'Shelves short of the back'),
      ],
    },
    {
      title: 'Drawers',
      help: 'Dovetailed boxes behind inset fronts, on side-mount slides.',
      fields: [
        length(
          'drawer.boxThickness',
          'Box sides, front, and back',
          'Planed from the board stock. About 1/2".',
        ),
        length('drawer.bottomThickness', 'Bottom thickness'),
        length(
          'drawer.frontThickness',
          'Front thickness',
          'A front within the flattening allowance of the board stays as thick as the board.',
        ),
        length('drawer.frontGap', 'Gap around each front'),
        length('drawer.clearance', 'Box clearance above and below'),
        length('drawer.groove.width', 'Bottom groove width'),
        length('drawer.groove.depth', 'Bottom groove depth'),
        length('drawer.groove.up', 'Bottom groove up from the box’s edge'),
        {
          path: 'drawer.slope',
          label: 'Dovetail slope, 1 in',
          kind: 'integer',
          help: '8 is usual in hardwood, 6 in softwood.',
        },
        ...drawerSlideFields('slides'),
      ],
    },
    {
      title: 'Doors',
      help: 'Two inset doors, each a frame around a floating panel, on concealed cup hinges.',
      fields: [
        length('door.gap', 'Gap around and between the doors'),
        length('door.frameWidth', 'Stile and rail width'),
        length('door.grooveWidth', 'Panel groove width', 'The rails’ stub tenons are as thick.'),
        length('door.grooveDepth', 'Panel groove depth', 'And the stub tenons’ length.'),
        length('door.hingeFromEnd', 'Hinge cup from the door’s end'),
        ...cupHingeFields('door.hinge'),
      ],
    },
    {
      title: 'Vises and dog holes',
      help: 'A face vise at the front left, whose jaw is the leg behind it, and an end vise at the right end, clamping between dogs in its chop and in the top.',
      fields: [
        length('chopThickness', 'Chop thickness', 'Both vises’ chops, glued up from strips.'),
        length('vise.face.height', 'Face vise chop height', 'Down from the top’s surface.'),
        length(
          'vise.face.screwBelow',
          'Face vise screw below the top',
          'Clear of the end rail’s mortise in the leg.',
        ),
        ...viseScrewFields('vise.face.screw'),
        length('vise.end.blockHeight', 'End vise block height', 'Glued under the top’s right end.'),
        ...viseScrewFields('vise.end.screw'),
        {
          ...length(
            'vise.dogs.diameter',
            'Dog hole diameter',
            'The size your dogs and holdfasts are made for, from their maker.',
          ),
          confirmed: true,
        },
        length('vise.dogs.spacing', 'Dog hole spacing'),
        length('vise.dogs.fromFront', 'Dog holes from the front edge'),
        length(
          'vise.dogs.stopShort',
          'Dog holes stopped short of the underside',
          'Where something is under the top.',
        ),
      ],
    },
    {
      title: 'Lumber',
      help: 'The boards everything is glued up or cut from. A store sells them in fixed widths and lengths; a dealer sells hardwood by the board foot, in random widths and lengths from 4 to 16 feet.',
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
        { ...length('board.thickness', 'Board thickness', 'Measure a board.'), when: fromStore },
        { ...length('board.width', 'Board width', 'Measure a board.'), when: fromStore },
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
        length('allowances.jointPerEdge', 'Jointing, per glued edge', 'About 1/16" is usual.'),
        length(
          'allowances.rip',
          'Rip allowance',
          'Extra width on each glue-up, ripped off at the end. About 1/2" is usual.',
        ),
        length('allowances.trimPerEnd', 'Trim, per end', 'About 1" is usual.'),
        length(
          'allowances.flatten',
          'Flattening',
          'Taken off a glue-up to make its faces flat. About 1/16" is usual.',
        ),
        length(
          'kerf',
          'Saw kerf',
          'The width of your saw blade’s cut, between strips ripped from one board.',
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
          help: 'The kind of wood, from the store\'s label or the lumber yard\'s paperwork. If a board is sold only as "hardwood", ask which species it is.',
          options: WOOD_SPECIES.map((s) => ({ value: s.id, label: s.name })),
        },
        {
          path: 'orientation',
          label: INPUT.orientation,
          kind: 'choice',
          help: "Look at a board's end grain. Growth rings running across the width, close to flat, are flatsawn; rings running up and down through the thickness are quartersawn. Mixed, or not sure: Unknown, which Kerf treats as flatsawn, the one that moves more.",
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
          help: 'How dry the wood gets where the bench stands, in the driest part of the year. The Wood Handbook gives 6% to 10% indoors for most of the United States and 8% to 13% for damp coastal areas (Table 13-2). A garage that is not heated can be wetter. Kerf estimates movement from 6% to 14%.',
        },
        {
          path: 'moisture.high',
          label: 'Highest moisture content in service',
          kind: 'number',
          unit: '%',
          help: 'How damp the wood gets where the bench stands, in the most humid part of the year. Use the top of the Wood Handbook range given under the lowest, for your area.',
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
          help: 'The heaviest thing you will put on the bench: a machine, from its maker’s specifications, or your own weight if you will kneel on it. Kerf checks it all at the middle of the span, where the top bends most.',
        },
        {
          path: 'deflectionLimit',
          label: INPUT.deflectionLimit,
          kind: 'number',
          help: 'How far the top may sag, as its span divided by this number: 144 lets a 36" span sag 1/4". The Architectural Woodwork Standards call 144 the industry standard for shelves; a bench may want a larger number, which allows less sag.',
        },
      ],
    },
  ],
};

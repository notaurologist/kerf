import { SPECIES_GRADES } from '../../design-values/sawnLumber.ts';
import { NOMINAL_SIZES } from '../../lumber/stock.ts';
import type { FieldOption, FormField, TemplateForm } from '../../model/form.ts';
import { formatLength } from '../../units/length.ts';
import { STRUCTURAL_INPUT_LABELS as INPUT } from './structural.ts';

// How the swing set's parameters and structural inputs are entered (spec, Parameters and
// Structural model, Inputs). Every field starts empty: geometry, hardware, and structural
// inputs are all the owner's to enter (hard rule 3). Sections are parts of the swing set, so a
// part's size, lumber, bolts, and structural inputs are entered together.

const stock: FieldOption[] = NOMINAL_SIZES.map((n) => ({ value: n, label: n }));

const boltDiameters: FieldOption[] = [0.375, 0.5, 0.625, 0.75].map((d) => ({
  value: d,
  label: formatLength(d),
}));

const builtUp = (value: (path: string) => string) => Number(value('beamPlies')) > 1;
const onPads = (value: (path: string) => string) =>
  value('burialDepth').trim() !== '' && Number(value('burialDepth')) === 0;

/** How to find a bolt's diameter, for every bolt the owner confirms (#403). */
const BOLT_DIAMETER_HELP =
  'Read it on the bolt package: the first size, such as 1/2" in 1/2" × 7". The structural review\'s bolt layout shows how this size fits the wood; settle it with an experienced builder.';
/** How to find how many bolts fit at a joint. */
const BOLT_COUNT_HELP =
  "The structural review's bolt layout shows how many fit at their edge and end distances; settle it with an experienced builder.";

const bolts = (path: string, label: string, help: string): FormField[] => [
  {
    path: `${path}.diameter`,
    label: `${label}, diameter`,
    kind: 'choice',
    options: boltDiameters,
    help: BOLT_DIAMETER_HELP,
    confirmed: true,
  },
  {
    path: `${path}.perJoint`,
    label: `${label}, per joint`,
    kind: 'integer',
    help: `${help} ${BOLT_COUNT_HELP}`,
    confirmed: true,
  },
];

export const SWING_SET_FORM: TemplateForm = {
  help: 'Confirm bolt sizes and counts with an experienced builder. They decide whether the frame holds.',
  params: [
    {
      title: 'Beam',
      fields: [
        {
          path: 'beamLength',
          label: 'Beam length',
          kind: 'length',
          help: 'Overall length of the top beam.',
        },
        {
          path: 'beamHeight',
          label: 'Beam height',
          kind: 'length',
          help: 'Underside of the beam above the ground directly under it: the height the swings hang from.',
        },
        {
          path: 'beamStock',
          label: 'Beam stock',
          kind: 'choice',
          options: stock,
          help: 'Stands on edge.',
        },
        {
          path: 'beamPlies',
          label: 'Beam plies',
          kind: 'choice',
          options: [
            { value: 1, label: '1 (solid beam)' },
            { value: 2, label: '2 (built-up)' },
            { value: 3, label: '3 (built-up)' },
          ],
          help: 'A built-up beam is 2x boards fastened face to face.',
        },
        {
          path: 'hardware.plyBolts.diameter',
          label: 'Ply bolts, diameter',
          kind: 'choice',
          options: boltDiameters,
          help: BOLT_DIAMETER_HELP,
          when: builtUp,
          confirmed: true,
        },
        {
          path: 'hardware.plyBolts.count',
          label: 'Ply bolts, count',
          kind: 'integer',
          help: 'Bolts fastening the beam plies together, over the whole beam. Settle the count and spacing with an experienced builder; Kerf checks each ply on its own, so it does not count on the bolts to share the load.',
          when: builtUp,
          confirmed: true,
        },
      ],
    },
    {
      title: 'Legs',
      fields: [
        {
          path: 'splay.kind',
          label: 'Leg splay entered as',
          kind: 'choice',
          options: [
            { value: 'angle', label: 'Angle of each leg from vertical' },
            { value: 'footprint', label: 'Footprint depth at the ground' },
          ],
        },
        {
          path: 'splay.degrees',
          label: 'Leg angle from vertical',
          kind: 'angle',
          when: (v) => v('splay.kind') === 'angle',
        },
        {
          path: 'splay.depth',
          label: 'Footprint depth',
          kind: 'length',
          help: 'Plan-view distance between the outer faces of the front and back legs where they meet the ground.',
          when: (v) => v('splay.kind') === 'footprint',
        },
        {
          path: 'frameInset',
          label: 'Frame inset',
          kind: 'length',
          help: "Beam end to the outside face of that frame's legs (the overhang).",
        },
        { path: 'legStock', label: 'Leg stock', kind: 'choice', options: stock },
        {
          path: 'hardware.legBoltDiameter',
          label: 'Leg-to-beam bolt diameter',
          kind: 'choice',
          options: boltDiameters,
          help: BOLT_DIAMETER_HELP,
          confirmed: true,
        },
      ],
    },
    {
      title: 'Crossbars',
      fields: [
        { path: 'crossbarStock', label: 'Crossbar stock', kind: 'choice', options: stock },
        {
          path: 'crossbarHeight',
          label: 'Crossbar height',
          kind: 'length',
          help: 'Top edge of the crossbar above the ground under the beam.',
        },
        ...bolts('hardware.crossbarBolts', 'Crossbar bolts', 'Bolts at each end of each crossbar.'),
      ],
    },
    {
      title: 'Gussets',
      fields: [
        { path: 'gussetStock', label: 'Gusset stock', kind: 'choice', options: stock },
        ...bolts(
          'hardware.gussetBolts',
          'Gusset bolts',
          'Bolts through the gusset into each side.',
        ),
      ],
    },
    {
      title: 'Site',
      fields: [
        {
          path: 'groundSlope',
          label: 'Ground slope',
          kind: 'number',
          unit: 'in per ft',
          fractions: true,
          help: 'Inches the ground falls per foot toward the front. 0 for level ground; negative if the front is uphill.',
        },
        {
          path: 'burialDepth',
          label: 'Burial depth',
          kind: 'length',
          help: 'How far each leg goes below grade, measured vertically. 0 for legs on pads.',
        },
        {
          path: 'hardware.anchorsPerFoot',
          label: 'Ground anchors per leg foot',
          kind: 'integer',
          help: "From the anchor maker's instructions for your soil, on the package or the maker's product sheet. Ask the store which ground anchors are meant for a swing set.",
          when: onPads,
          confirmed: true,
        },
      ],
    },
    {
      title: 'Swings',
      fields: [
        {
          path: 'swings.centers.0',
          label: 'Left swing center',
          kind: 'length',
          help: 'Distance from the left end of the beam.',
        },
        {
          path: 'swings.centers.1',
          label: 'Right swing center',
          kind: 'length',
          help: 'Distance from the left end of the beam.',
        },
        {
          path: 'swings.hangerSpacing',
          label: 'Hanger spacing',
          kind: 'length',
          help: "Between a swing's two hangers, along the beam.",
        },
        { path: 'swings.seatWidth', label: 'Seat width', kind: 'length' },
        {
          path: 'swings.seatHeight',
          label: 'Seat height',
          kind: 'length',
          help: 'Underside of the seat above the ground under the beam, at rest.',
        },
      ],
    },
  ],
  structuralInputs: [
    {
      title: 'Beam',
      fields: [
        {
          path: 'beamSpeciesGrade',
          label: INPUT.beamSpeciesGrade,
          kind: 'choice',
          options: SPECIES_GRADES.map((s) => ({ value: s.id, label: `${s.species} ${s.grade}` })),
          help: 'Read the grade stamp on the beam boards at the store: an inked block on a face or edge naming the species group (such as SYP for Southern Pine) and the grade (such as No. 2). If a board has no stamp, ask the yard for the species and grade on its paperwork.',
        },
        {
          path: 'beamIncised',
          label: INPUT.beamIncised,
          kind: 'yes-no',
          help: 'Look at the faces of the beam boards: incised lumber has rows of small slits pressed in for the treatment to soak in. No slits means not incised.',
        },
        {
          path: 'beamMoistureContent',
          label: INPUT.beamMoistureContent,
          kind: 'number',
          unit: '%',
          help: "Percent of oven-dry weight, for the beam's own weight. Measure it with a pin moisture meter pushed into a fresh cut, or use the suggested 30%. Pressure-treated lumber is often sold wetter.",
        },
        {
          path: 'deflectionLimit',
          label: INPUT.deflectionLimit,
          kind: 'number',
          unit: '',
          help: 'How far the beam may sag under riders, as its span divided by this number: 240 lets a 120" span sag 1/2". The suggestion borrows the building code\'s limit for floors. A larger number allows less sag.',
        },
      ],
    },
    {
      title: 'Swings',
      fields: [
        {
          path: 'hangerRating',
          label: INPUT.hangerRating,
          kind: 'number',
          unit: 'lb',
          help: "Printed on the hanger's package or the maker's product sheet: the rated or working load for one hanger, not its breaking strength.",
        },
      ],
    },
    {
      title: 'Loads',
      fields: [
        {
          path: 'riderWeights.0',
          label: 'Heaviest rider on the left swing, with seat and chain',
          kind: 'number',
          unit: 'lb',
          help: 'Weigh the rider on a bathroom scale holding the seat and chain, or weigh each and add. 0 for a swing left empty.',
        },
        {
          path: 'riderWeights.1',
          label: 'Heaviest rider on the right swing, with seat and chain',
          kind: 'number',
          unit: 'lb',
          help: 'Weigh the rider on a bathroom scale holding the seat and chain, or weigh each and add. 0 for a swing left empty.',
        },
        {
          path: 'maxSwingAngle',
          label: INPUT.maxSwingAngle,
          kind: 'angle',
          help: 'Largest angle the chains reach, from vertical: watch a swing at its highest and judge the chains against straight down. 90° is level with the beam, the most the model takes, and what Kerf suggests.',
        },
        {
          path: 'dynamicFactor',
          label: INPUT.dynamicFactor,
          kind: 'number',
          unit: '',
          help: 'How much harder than a smooth swing the chains pull when they go slack and snap tight, as a multiplier on the pendulum load. No published value covers home swings, so Kerf does not suggest one. Ask an experienced builder: "How many times the steady swing pull should a backyard swing beam be designed for when the chains snap tight?"',
        },
      ],
    },
  ],
};

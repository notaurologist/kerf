import { SPECIES_GRADES } from '../../design-values/sawnLumber.ts';
import { NOMINAL_SIZES } from '../../lumber/stock.ts';
import { formatLength } from '../../units/length.ts';
import type { FieldOption, FormField, TemplateForm } from '../form.ts';
import { STRUCTURAL_INPUT_LABELS as INPUT } from './structural.ts';

// How the swing set's parameters and structural inputs are entered (spec, Parameters and
// Structural model, Inputs). Every field starts empty: geometry, hardware, and structural
// inputs are all the owner's to enter (hard rule 3).

const stock: FieldOption[] = NOMINAL_SIZES.map((n) => ({ value: n, label: n }));

const boltDiameters: FieldOption[] = [0.375, 0.5, 0.625, 0.75].map((d) => ({
  value: d,
  label: formatLength(d),
}));

const builtUp = (value: (path: string) => string) => Number(value('beamPlies')) > 1;
const onPads = (value: (path: string) => string) =>
  value('burialDepth').trim() !== '' && Number(value('burialDepth')) === 0;

const bolts = (path: string, label: string, help: string): FormField[] => [
  { path: `${path}.diameter`, label: `${label}, diameter`, kind: 'choice', options: boltDiameters },
  { path: `${path}.perJoint`, label: `${label}, per joint`, kind: 'integer', help },
];

export const SWING_SET_FORM: TemplateForm = {
  params: [
    {
      title: 'Frame',
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
      ],
    },
    {
      title: 'Lumber',
      fields: [
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
        { path: 'legStock', label: 'Leg stock', kind: 'choice', options: stock },
        { path: 'crossbarStock', label: 'Crossbar stock', kind: 'choice', options: stock },
        {
          path: 'crossbarHeight',
          label: 'Crossbar height',
          kind: 'length',
          help: 'Top edge of the crossbar above the ground under the beam.',
        },
        { path: 'gussetStock', label: 'Gusset stock', kind: 'choice', options: stock },
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
          help: 'Inches the ground falls per foot toward the front. 0 for level ground; negative if the front is uphill.',
        },
        {
          path: 'burialDepth',
          label: 'Burial depth',
          kind: 'length',
          help: 'How far each leg goes below grade, measured vertically. 0 for legs on pads.',
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
    {
      title: 'Hardware',
      help: 'Bolt sizes and counts confirmed with an experienced builder. They decide whether the frame holds, so none is filled in for you.',
      fields: [
        {
          path: 'hardware.legBoltDiameter',
          label: 'Leg-to-beam bolt diameter',
          kind: 'choice',
          options: boltDiameters,
        },
        ...bolts('hardware.crossbarBolts', 'Crossbar bolts', 'Bolts at each end of each crossbar.'),
        ...bolts(
          'hardware.gussetBolts',
          'Gusset bolts',
          'Bolts through the gusset into each side.',
        ),
        {
          path: 'hardware.plyBolts.diameter',
          label: 'Ply bolts, diameter',
          kind: 'choice',
          options: boltDiameters,
          when: builtUp,
        },
        {
          path: 'hardware.plyBolts.count',
          label: 'Ply bolts, count',
          kind: 'integer',
          help: 'Bolts fastening the beam plies together, over the whole beam.',
          when: builtUp,
        },
        {
          path: 'hardware.anchorsPerFoot',
          label: 'Ground anchors per leg foot',
          kind: 'integer',
          when: onPads,
        },
      ],
    },
  ],
  structuralInputs: [
    {
      title: 'Beam lumber',
      fields: [
        {
          path: 'beamSpeciesGrade',
          label: INPUT.beamSpeciesGrade,
          kind: 'choice',
          options: SPECIES_GRADES.map((s) => ({ value: s.id, label: `${s.species} ${s.grade}` })),
          help: 'From the grade stamp on the boards you buy.',
        },
        {
          path: 'beamIncised',
          label: INPUT.beamIncised,
          kind: 'yes-no',
          help: 'Incised lumber has rows of small slits on its faces from pressure treatment.',
        },
        {
          path: 'beamMoistureContent',
          label: INPUT.beamMoistureContent,
          kind: 'number',
          unit: '%',
          help: "Percent of oven-dry weight, for the beam's own weight. Pressure-treated lumber is often sold above 30%.",
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
          help: '0 for a swing left empty.',
        },
        {
          path: 'riderWeights.1',
          label: 'Heaviest rider on the right swing, with seat and chain',
          kind: 'number',
          unit: 'lb',
          help: '0 for a swing left empty.',
        },
        {
          path: 'maxSwingAngle',
          label: INPUT.maxSwingAngle,
          kind: 'angle',
          help: 'Largest angle the chains reach, from vertical. 90° is level with the beam.',
        },
        {
          path: 'dynamicFactor',
          label: INPUT.dynamicFactor,
          kind: 'number',
          unit: '',
          help: 'Multiplier on the smooth pendulum load for snap loads from slack chains. Choose it with an experienced builder.',
        },
      ],
    },
    {
      title: 'Limits and ratings',
      fields: [
        {
          path: 'deflectionLimit',
          label: INPUT.deflectionLimit,
          kind: 'number',
          unit: '',
          help: 'Allowed sag is the span divided by this number, such as 240.',
        },
        {
          path: 'hangerRating',
          label: INPUT.hangerRating,
          kind: 'number',
          unit: 'lb',
          help: "From the manufacturer's specification for one hanger.",
        },
      ],
    },
  ],
};

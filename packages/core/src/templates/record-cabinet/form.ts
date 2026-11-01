import { WOOD_SPECIES } from '../../design-values/woodSpecies.ts';
import type { FormField, TemplateForm } from '../../model/form.ts';
import { STRUCTURAL_INPUT_LABELS as INPUT } from './structural.ts';

// How the record cabinet's parameters and structural inputs are entered (spec, Parameters and
// Structural model). Every field starts empty. The board stock, allowances, dado depth, and
// setback have no source, so they are the owner's to enter and confirm (#278, #283).

const length = (path: string, label: string, help?: string, confirmed?: true): FormField => ({
  path,
  label,
  kind: 'length',
  ...(help ? { help } : {}),
  ...(confirmed ? { confirmed } : {}),
});

export const RECORD_CABINET_FORM: TemplateForm = {
  help: 'Measure the window and one of your records before you enter sizes. The board sizes and allowances are yours to enter: stores and shops differ, and Kerf has no source for them.',
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
          'What is left after flattening the glued-up panels.',
        ),
        length(
          'dadoDepth',
          'Dado depth',
          'Every dado. A partition has one on each face, so the plan shows the wood left between them.',
          true,
        ),
        length(
          'stoppedSetback',
          'Stopped dado setback',
          'How far the dadoes under the top stop short of the front, so they do not show.',
          true,
        ),
      ],
    },
    {
      title: 'Lumber',
      help: 'The surfaced boards your store sells. Enter the lengths it sells in order, as many as apply.',
      fields: [
        length('board.thickness', 'Board thickness', undefined, true),
        length('board.width', 'Board width', undefined, true),
        ...[0, 1, 2, 3].map(
          (i): FormField => ({
            path: `board.lengths.${i}`,
            label: `Length sold ${i + 1}`,
            kind: 'integer',
            unit: 'ft',
            confirmed: true,
          }),
        ),
        length(
          'allowances.jointPerEdge',
          'Jointing, per glued edge',
          'Width planed off each glued edge.',
          true,
        ),
        length(
          'allowances.rip',
          'Rip allowance',
          'Extra width on each glued-up panel, ripped off at the end.',
          true,
        ),
        length(
          'allowances.trimPerEnd',
          'Trim, per end',
          'Extra length on each board, cut off with the panel’s ends.',
          true,
        ),
      ],
    },
    {
      title: 'Turntable and speaker',
      fields: [
        length('turntable.width', 'Turntable width'),
        length('turntable.depth', 'Turntable depth'),
        length('turntable.lidHeight', 'Turntable height, lid open'),
        length('speaker.width', 'Speaker width'),
        length('speaker.height', 'Speaker height'),
        length('speaker.depth', 'Speaker depth'),
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
          help: 'The Wood Handbook gives typical indoor ranges by region (Table 13-2).',
        },
        {
          path: 'moisture.high',
          label: 'Highest moisture content in service',
          kind: 'number',
          unit: '%',
        },
      ],
    },
    {
      title: 'Turntable and speaker',
      fields: [
        { path: 'turntableWeight', label: INPUT.turntableWeight, kind: 'number', unit: 'lb' },
        {
          path: 'speakerWeight',
          label: INPUT.speakerWeight,
          kind: 'number',
          unit: 'lb',
          help: 'From the speaker maker’s specifications.',
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
          help: 'The deflection you accept, as the span divided by this number.',
        },
      ],
    },
  ],
};

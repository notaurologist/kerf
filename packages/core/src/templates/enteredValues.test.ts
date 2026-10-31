import { describe, expect, it } from 'vitest';
import {
  enteredParts,
  enteredValues,
  type FormSection,
  formParts,
  type TemplateForm,
} from './form.ts';

// Reading a stored object back by its form (#119), on a made-up form: each kind of field.

const sections: FormSection[] = [
  {
    title: 'Size',
    fields: [
      { path: 'length', label: 'Length', kind: 'length' },
      {
        path: 'shape.kind',
        label: 'Shape',
        kind: 'choice',
        options: [
          { value: 'angle', label: 'By angle' },
          { value: 'depth', label: 'By depth' },
        ],
      },
      {
        path: 'shape.degrees',
        label: 'Angle',
        kind: 'angle',
        when: (v) => v('shape.kind') === 'angle',
      },
      {
        path: 'shape.depth',
        label: 'Depth',
        kind: 'length',
        when: (v) => v('shape.kind') === 'depth',
      },
    ],
  },
  {
    title: 'Loads',
    fields: [
      { path: 'weights.0', label: 'First weight', kind: 'number', unit: 'lb' },
      { path: 'moisture', label: 'Moisture', kind: 'number', unit: '%' },
      { path: 'count', label: 'Count', kind: 'integer' },
      { path: 'treated', label: 'Treated', kind: 'yes-no' },
      { path: 'limit', label: 'Limit', kind: 'integer' },
    ],
  },
];

describe('enteredValues', () => {
  const read = enteredValues(sections, {
    length: 138.354,
    shape: { kind: 'angle', degrees: 20 },
    weights: [150],
    moisture: 19,
    count: 2,
    treated: false,
  });

  it('reads each kind through core’s formatters, keeping the sections', () => {
    expect(read.map((s) => s.title)).toEqual(['Size', 'Loads']);
    expect(read[0]?.values.map((v) => [v.label, v.text])).toEqual([
      // 138.354" is 11' 6.354": nearest 1/16 is 6-3/8, and the exact value is said.
      ['Length', `11' 6-3/8" · 138-3/8" to the nearest 1/16; Kerf keeps 138.354 exactly`],
      ['Shape', 'By angle'],
      ['Angle', '20.0°'],
    ]);
    expect(read[1]?.values.map((v) => [v.label, v.text])).toEqual([
      ['First weight', '150 lb'],
      ['Moisture', '19%'],
      ['Count', '2'],
      ['Treated', 'No'],
      ['Limit', null],
    ]);
  });

  it('leaves out fields that do not apply', () => {
    expect(read[0]?.values.some((v) => v.label === 'Depth')).toBe(false);
  });
});

// The form shown by part (#164): sections of the same title in both objects are one part.
const form: TemplateForm = {
  params: [
    {
      title: 'Size',
      help: 'Measured on site.',
      fields: [{ path: 'length', label: 'Length', kind: 'length' }],
    },
    {
      title: 'Bolts',
      fields: [{ path: 'bolts', label: 'Bolts', kind: 'integer', confirmed: true }],
    },
  ],
  structuralInputs: [
    { title: 'Loads', fields: [{ path: 'weight', label: 'Weight', kind: 'number', unit: 'lb' }] },
    {
      title: 'Size',
      help: 'From the grade stamp.',
      fields: [{ path: 'grade', label: 'Grade', kind: 'integer' }],
    },
  ],
};

describe('formParts', () => {
  const parts = formParts(form);

  it('puts the parameters’ parts first, each with the inputs of the same title, then the rest', () => {
    expect(parts.map((p) => p.title)).toEqual(['Size', 'Bolts', 'Loads']);
    expect(parts[0]?.fields.map((f) => [f.from, f.field.path])).toEqual([
      ['params', 'length'],
      ['structuralInputs', 'grade'],
    ]);
  });

  it('joins the help of the sections it merges', () => {
    expect(parts[0]?.help).toBe('Measured on site. From the grade stamp.');
    expect(parts[1]?.help).toBeUndefined();
  });
});

describe('enteredParts', () => {
  it('reads both objects back by part, saying where each value is from', () => {
    const read = enteredParts(form, { length: 120, bolts: 4 }, { weight: 150 });
    expect(read.map((p) => [p.title, p.values.map((v) => [v.from, v.label, v.text])])).toEqual([
      [
        'Size',
        [
          ['params', 'Length', `10' 0" · 120"`],
          ['structuralInputs', 'Grade', null],
        ],
      ],
      ['Bolts', [['params', 'Bolts', '4']]],
      ['Loads', [['structuralInputs', 'Weight', '150 lb']]],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import type { TemplateForm } from './form.ts';
import { describeBasis, suggestedValues } from './questions.ts';

const form: TemplateForm = {
  params: [
    {
      title: 'Top',
      fields: [
        { path: 'size.length', label: 'Length', kind: 'length' },
        { path: 'style', label: 'Style', kind: 'choice', options: [{ value: 'a', label: 'A' }] },
        { path: 'height', label: 'Height', kind: 'length' },
      ],
    },
  ],
  structuralInputs: [
    { title: 'Loads', fields: [{ path: 'load', label: 'Load', kind: 'number', unit: 'lb' }] },
  ],
};

describe('suggested values', () => {
  it('fills the form text, writing lengths as the form writes a stored length', () => {
    const { params, inputs, about } = suggestedValues(form, [
      { from: 'params', path: 'size.length', value: 36.5, basis: { kind: 'example' } },
      {
        from: 'params',
        path: 'height',
        value: null,
        basis: { kind: 'rule-of-thumb', rule: 'knee height' },
        note: 'Too low for the space.',
      },
      { from: 'structuralInputs', path: 'load', value: 200, basis: { kind: 'answer' } },
    ]);
    expect(params).toEqual({ 'size.length': '36-1/2', style: '', height: '' });
    expect(inputs).toEqual({ load: '200' });
    expect(about.get('params height')).toEqual({
      text: '',
      about: 'Rule of thumb: knee height. Too low for the space.',
    });
    expect(about.get('structuralInputs load')?.about).toBe('From your answers.');
    expect(about.has('params style')).toBe(false);
  });

  it('refuses a suggestion for a field the form does not have', () => {
    expect(() =>
      suggestedValues(form, [
        { from: 'structuralInputs', path: 'height', value: 1, basis: { kind: 'answer' } },
      ]),
    ).toThrow(/No structuralInputs field at height/);
  });

  it('says where each kind of value came from', () => {
    expect(describeBasis({ kind: 'source', citation: 'Handbook, p. 2' })).toBe(
      'Source: Handbook, p. 2.',
    );
    expect(describeBasis({ kind: 'convention', name: 'table height' })).toBe(
      'Convention: table height.',
    );
    expect(describeBasis({ kind: 'example' })).toBe("From the template's worked example.");
  });
});

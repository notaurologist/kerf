import { describe, expect, it } from 'vitest';
import { mapNeeded, need } from './types.ts';

const LABELS = { load: 'Load', span: 'Span', limit: 'Deflection limit' };

describe('need', () => {
  it('gives the named inputs once every one is entered', () => {
    const inputs = { load: 100, span: 48, limit: undefined };
    expect(need(inputs, LABELS, 'load', 'span')).toEqual({ value: inputs });
  });

  it('lists every named input not entered, with its label, and never a stand-in', () => {
    const inputs = { load: undefined, span: 48, limit: undefined };
    expect(need(inputs, LABELS, 'load', 'span', 'limit')).toEqual({
      missing: [
        { key: 'load', label: 'Load' },
        { key: 'limit', label: 'Deflection limit' },
      ],
    });
  });

  it('maps a value and passes what is missing through', () => {
    expect(mapNeeded(need({ load: 100 }, { load: 'Load' }, 'load'), (v) => v.load * 2)).toEqual({
      value: 200,
    });
    const missing = need({ load: undefined }, { load: 'Load' }, 'load');
    expect(mapNeeded(missing, () => 1)).toBe(missing);
  });
});

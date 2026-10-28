import { describe, expect, it } from 'vitest';
import { formatNumber, formatQuantity } from './format.ts';

describe('formatNumber', () => {
  it.each([
    [1_400_000, '1,400,000'],
    [7207.883773101164, '7,208'],
    [620.0631674727858, '620.1'],
    [459000, '459,000'],
    [120, '120'],
    [100.04, '100'],
    [17.645833333333332, '17.6'],
    [1.0833, '1.08'],
    [4.000000000000001, '4'],
    [0.991, '0.991'],
    [0.012345, '0.0123'],
    [0, '0'],
    [-0, '0'],
    [-2.5, '-2.5'],
  ])('%s shows as %s', (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });

  it('rejects values that are not finite', () => {
    expect(() => formatNumber(Number.NaN)).toThrow(RangeError);
  });
});

describe('formatQuantity', () => {
  it('adds the unit, with no space for degrees, percent, or a bare number', () => {
    expect(formatQuantity({ value: 1_400_000, unit: 'psi' })).toBe('1,400,000 psi');
    expect(formatQuantity({ value: 60, unit: '°' })).toBe('60°');
    expect(formatQuantity({ value: 30, unit: '%' })).toBe('30%');
    expect(formatQuantity({ value: 1.1, unit: '' })).toBe('1.1');
  });

  it('shows a length with its fraction, and a deflection-sized one without', () => {
    expect(formatQuantity({ value: 92.5, unit: 'in' })).toBe('92.5 in (92-1/2")');
    expect(formatQuantity({ value: 170.20000000000002, unit: 'in' })).toBe('170.2 in (170-3/16")');
    expect(formatQuantity({ value: 0.2961, unit: 'in' })).toBe('0.296 in');
  });
});

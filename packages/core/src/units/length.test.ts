import { describe, expect, it } from 'vitest';
import { compareRoundedSum, formatBoardLength, formatLength, toSixteenths } from './length.ts';

describe('toSixteenths', () => {
  it('rounds to the nearest sixteenth', () => {
    expect(toSixteenths(0)).toBe(0);
    expect(toSixteenths(1)).toBe(16);
    expect(toSixteenths(3.5)).toBe(56);
    // 1/32 either side of a sixteenth boundary
    expect(toSixteenths(1 / 16 - 1 / 33)).toBe(1);
    expect(toSixteenths(1 / 32 - 0.0001)).toBe(0);
  });

  it('rounds exact halves up', () => {
    // 1/32, 3/32, 5/32 are exactly representable, so these are true ties.
    expect(toSixteenths(1 / 32)).toBe(1);
    expect(toSixteenths(3 / 32)).toBe(2);
    expect(toSixteenths(10 + 5 / 32)).toBe(163);
  });

  it('rejects negative and non-finite lengths', () => {
    expect(() => toSixteenths(-0.01)).toThrow(RangeError);
    expect(() => toSixteenths(Number.NaN)).toThrow(RangeError);
    expect(() => toSixteenths(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('formatLength in inches', () => {
  it.each([
    [0, '0"'],
    [12, '12"'],
    [3 / 16, '3/16"'],
    [0.5, '1/2"'],
    [0.25, '1/4"'],
    [0.125, '1/8"'],
    [100 + 3 / 16, '100-3/16"'],
    [3.5, '3-1/2"'],
    [5.5, '5-1/2"'],
    [15 / 16, '15/16"'],
  ])('%s shows as %s', (inches, text) => {
    expect(formatLength(inches)).toBe(text);
  });

  it('rounds before splitting, so a fraction never shows as 16/16', () => {
    expect(formatLength(11.99)).toBe('12"');
    expect(formatLength(0.99)).toBe('1"');
  });
});

describe('formatLength in feet and inches', () => {
  it.each([
    [0, '0"'],
    [11, '11"'],
    [12, `1' 0"`],
    [96, `8' 0"`],
    [100 + 3 / 16, `8' 4-3/16"`],
    [144.5, `12' 0-1/2"`],
  ])('%s shows as %s', (inches, text) => {
    expect(formatLength(inches, 'feet-inches')).toBe(text);
  });

  it('carries into the next foot instead of showing 12 inches', () => {
    expect(formatLength(95.99, 'feet-inches')).toBe(`8' 0"`);
    expect(formatLength(119.98, 'feet-inches')).toBe(`10' 0"`);
  });
});

describe('compareRoundedSum', () => {
  it('reports agreement when rounded parts add up to the rounded total', () => {
    expect(compareRoundedSum([10, 20.5])).toEqual({
      totalSixteenths: 488,
      sumOfRoundedPartsSixteenths: 488,
      differs: false,
    });
  });

  it('reports a difference when rounding the parts drifts from the exact total', () => {
    // Each part is 0.04" (0.64 sixteenths): each rounds to 1/16, but the exact total of three
    // is 1.92 sixteenths, which rounds to 2/16. Adding the displayed parts gives 3/16.
    const result = compareRoundedSum([0.04, 0.04, 0.04]);
    expect(result.totalSixteenths).toBe(2);
    expect(result.sumOfRoundedPartsSixteenths).toBe(3);
    expect(result.differs).toBe(true);
  });

  it('rejects invalid parts', () => {
    expect(() => compareRoundedSum([1, -1])).toThrow(RangeError);
  });
});

describe('formatBoardLength', () => {
  it('shows a board length in feet as feet and inches', () => {
    expect(formatBoardLength(12)).toBe(`12' 0"`);
    expect(formatBoardLength(8.5)).toBe(`8' 6"`);
  });
});

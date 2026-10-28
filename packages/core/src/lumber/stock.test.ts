import { describe, expect, it } from 'vitest';
import { NOMINAL_SIZES, stock } from './stock.ts';

describe('stock', () => {
  it('gives actual dressed sizes, not nominal ones', () => {
    expect(stock('2x4')).toEqual({ nominal: '2x4', thickness: 1.5, width: 3.5 });
    expect(stock('4x6')).toEqual({ nominal: '4x6', thickness: 3.5, width: 5.5 });
    expect(stock('2x8')).toEqual({ nominal: '2x8', thickness: 1.5, width: 7.25 });
  });

  it('keeps thickness no larger than width for every size', () => {
    for (const nominal of NOMINAL_SIZES) {
      const { thickness, width } = stock(nominal);
      expect(thickness).toBeLessThanOrEqual(width);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { compare, TOLERANCE } from './compare.ts';

describe('compare', () => {
  it('accepts numbers within the tolerance and reports those past it', () => {
    expect(compare({ length: 48 }, { length: 48 + TOLERANCE / 2 })).toEqual([]);
    expect(compare({ length: 48 }, { length: 48 + 1e-6 })).toEqual([
      { path: 'length', current: 48, candidate: 48 + 1e-6 },
    ]);
  });

  it('compares strings exactly', () => {
    expect(compare({ text: '4\' 0"' }, { text: '4\' 0-1/16"' })).toEqual([
      { path: 'text', current: '4\' 0"', candidate: '4\' 0-1/16"' },
    ]);
  });

  it('reports a key or list item on one side only', () => {
    expect(compare({ a: 1, list: [1, 2] }, { b: 1, list: [1] })).toEqual([
      { path: 'a', current: 1 },
      { path: 'list[1]', current: 2 },
      { path: 'b', candidate: 1 },
    ]);
  });

  it('tells a number from a string that reads the same', () => {
    expect(compare([1], ['1'])).toEqual([{ path: '[0]', current: 1, candidate: '1' }]);
  });
});

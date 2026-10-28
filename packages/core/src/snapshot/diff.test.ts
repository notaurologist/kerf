import { describe, expect, it } from 'vitest';
import { diff } from './diff.ts';

describe('diff', () => {
  it('finds nothing between equal values', () => {
    expect(diff({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toEqual({
      changes: [],
      truncated: false,
    });
  });

  it('reports changed, added, and removed paths with values before and after', () => {
    const before = { rows: [{ length: '96"' }, { length: '40"' }], gone: 1 };
    const after = { rows: [{ length: '97"' }, { length: '40"' }, { length: '12"' }], added: true };
    expect(diff(before, after).changes).toEqual([
      { path: 'rows[0].length', before: '96"', after: '97"' },
      { path: 'rows[2]', after: { length: '12"' } },
      { path: 'gone', before: 1 },
      { path: 'added', after: true },
    ]);
  });

  it('reports a change of type as one change', () => {
    expect(diff({ a: [1] }, { a: { 0: 1 } }).changes).toEqual([
      { path: 'a', before: [1], after: { 0: 1 } },
    ]);
  });

  it('stops at the limit and says so', () => {
    const result = diff([1, 2, 3], [4, 5, 6], 2);
    expect(result.changes).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });
});

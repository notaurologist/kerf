import { describe, expect, it } from 'vitest';
import { diff, sameNumber, sameOutput } from './diff.ts';

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

  it('counts last-bit differences in numbers as no change', () => {
    // Values from the swing set's sweep on macOS arm64 and on Linux x64 (decision 0014).
    const mac = {
      setting: 13.437500000000002,
      length: 5.500000000000001,
      angle: 3.3318724237399615,
    };
    const x64 = { setting: 13.4375, length: 5.499999999999999, angle: 3.331872423739962 };
    expect(diff(mac, x64)).toEqual({ changes: [], truncated: false });
    expect(sameOutput(mac, x64)).toBe(true);
  });

  it('reports a sixty-fourth of an inch', () => {
    expect(diff({ length: 13.4375 }, { length: 13.4375 + 1 / 64 }).changes).toEqual([
      { path: 'length', before: 13.4375, after: 13.453125 },
    ]);
    expect(sameOutput({ length: 13.4375 }, { length: 13.453125 })).toBe(false);
  });

  it('compares everything other than numbers exactly', () => {
    expect(sameOutput({ note: '13 7/16"' }, { note: '13 7/16" ' })).toBe(false);
    expect(sameOutput([0], ['0'])).toBe(false);
    expect(sameOutput({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });
});

describe('sameNumber', () => {
  it('allows 1e-6, and 1e-12 of values past a million', () => {
    expect(sameNumber(1, 1 + 0.9e-6)).toBe(true);
    expect(sameNumber(1, 1 + 1.1e-6)).toBe(false);
    expect(sameNumber(0, -1.7e-15)).toBe(true);
    expect(sameNumber(1.6e6, 1.6e6 + 2e-6)).toBe(true);
    expect(sameNumber(1.6e6, 1.6e6 + 1e-5)).toBe(false);
  });
});

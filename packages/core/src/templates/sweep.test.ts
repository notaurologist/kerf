import { describe, expect, it } from 'vitest';
import { type DrawDigest, digestChanges, drawDigest, type SweepDigest } from './sweep.ts';

const digestOf = (outputs: Record<string, DrawDigest>): SweepDigest => ({
  templateVersion: 1,
  seed: 1,
  count: 10,
  outputs,
});

const changes = (before: unknown, after: unknown) =>
  digestChanges(digestOf({ 0: drawDigest(before) }), digestOf({ 0: drawDigest(after) }));

describe('a draw digest', () => {
  const plan = { setting: 13.4375, rows: [{ length: 5.5, note: 'cut 2' }, { length: 13.4375 }] };

  it('lists each distinct number once, rounded to 7 places', () => {
    expect(drawDigest(plan).values).toEqual([13.4375, 5.5]);
    expect(drawDigest({ a: 1 / 3 }).values).toEqual([0.3333333]);
  });

  it('counts last-bit differences as the same draw', () => {
    // Values from the swing set's sweep on macOS arm64 and on Linux x64 (decision 0014).
    const x64 = {
      setting: 13.4375,
      rows: [{ length: 5.499999999999999, note: 'cut 2' }, { length: 13.4375 }],
    };
    const mac = {
      ...x64,
      setting: 13.437500000000002,
      rows: [{ ...x64.rows[0], length: 5.500000000000001 }, { length: 13.4375 }],
    };
    expect(changes(mac, x64)).toEqual([]);
  });

  it('reports a sixty-fourth of an inch', () => {
    const moved = { ...plan, rows: [plan.rows[0], { length: 13.4375 + 1 / 64 }] };
    expect(changes(plan, moved)).toEqual(['draw 0 generates different output']);
  });

  it('reports a number that moves to another place, and a changed string', () => {
    const swapped = { ...plan, rows: [{ length: 13.4375, note: 'cut 2' }, { length: 5.5 }] };
    expect(changes(plan, swapped)).toEqual(['draw 0 generates different output']);
    const reworded = { ...plan, rows: [{ length: 5.5, note: 'cut 3' }, plan.rows[1]] };
    expect(changes(plan, reworded)).toEqual(['draw 0 generates different output']);
  });

  it('reports draws added and gone, and another seed', () => {
    const one = digestOf({ 0: drawDigest(plan) });
    const other = { ...digestOf({ 1: drawDigest(plan) }), seed: 2 };
    expect(digestChanges(one, other)).toEqual([
      'seed 1 is now 2',
      'draw 0 is no longer accepted',
      'draw 1 is newly accepted',
    ]);
  });
});

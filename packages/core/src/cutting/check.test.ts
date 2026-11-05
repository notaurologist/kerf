import { describe, expect, it } from 'vitest';
import { planProblems } from './check.ts';
import type { CutInstance } from './instance.ts';
import { measure } from './instance.ts';

// Three pieces on 8' and 10' boards, kerf 1/8", trim 1/2" each end. Pieces 0 and 1 together use
// 1 + 60.125 + 30.125 = 91.25", within an 8' board (96"); piece 2 alone uses 1 + 110.125 = 111.125",
// within 10' (120") but not 8'. A 130" piece uses 131.125", more than any length.
const INSTANCE: CutInstance = {
  lengths: [8, 10],
  pieces: [60, 30, 110, 130],
  kerf: 0.125,
  trimPerEnd: 0.5,
};

const GOOD = {
  boards: [
    { feet: 8, pieces: [0, 1] },
    { feet: 10, pieces: [2] },
  ],
  unfit: [3],
};

describe('planProblems', () => {
  it('accepts a plan with every piece once and every board within its length', () => {
    expect(planProblems(INSTANCE, GOOD)).toEqual([]);
    expect(measure(GOOD)).toEqual({ feet: 18, boards: 2 });
  });

  it.each([
    ['a piece missing', { ...GOOD, unfit: [] }, 'Piece 3 is missing.'],
    [
      'a piece doubled',
      {
        ...GOOD,
        boards: [
          { feet: 8, pieces: [0, 1, 1] },
          { feet: 10, pieces: [2] },
        ],
      },
      'Piece 1 is planned 2 times.',
    ],
    [
      'an overfull board',
      {
        ...GOOD,
        boards: [
          { feet: 8, pieces: [0, 1] },
          { feet: 8, pieces: [2] },
        ],
      },
      'Board 1 needs 111.125" but is 96".',
    ],
    [
      'a length the store does not sell',
      {
        ...GOOD,
        boards: [
          { feet: 9, pieces: [0, 1] },
          { feet: 10, pieces: [2] },
        ],
      },
      "Board 0 is 9', which is not a buyable length.",
    ],
    [
      'a piece called unfit that fits',
      { boards: [{ feet: 8, pieces: [0, 1] }], unfit: [2, 3] },
      'Piece 2 is listed as unfit but fits a buyable length.',
    ],
    ['a piece not in the instance', { ...GOOD, unfit: [3, 4] }, 'Piece 4 is not in the instance.'],
    [
      'an empty board',
      { ...GOOD, boards: [...GOOD.boards, { feet: 8, pieces: [] }] },
      'Board 2 has no pieces.',
    ],
  ])('refuses %s', (_, plan, problem) => {
    expect(planProblems(INSTANCE, plan)).toContain(problem);
  });
});

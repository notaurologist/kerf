import { describe, expect, it } from 'vitest';
import { firstFitDecreasing } from './firstFit.ts';

describe('firstFitDecreasing', () => {
  // Pieces 70, 50, 40, 20" on 8' and 10' boards, kerf 1/8", trim 1/2" each end. Longest first
  // into 120": 70 opens a board (71.125"), 50 does not fit beside it (121.25"), so it opens a
  // second (51.125"); 40 joins the first (111.25"); 20 joins the second (71.25"). Then each is
  // shortened: 111.25" needs 10', 71.25" fits 8'.
  it('matches a hand-worked example', () => {
    expect(
      firstFitDecreasing({
        lengths: [8, 10],
        pieces: [20, 70, 40, 50],
        kerf: 0.125,
        trimPerEnd: 0.5,
      }),
    ).toEqual({
      boards: [
        { feet: 10, pieces: [1, 2] },
        { feet: 8, pieces: [3, 0] },
      ],
      unfit: [],
    });
  });

  it('keeps a piece no length holds apart', () => {
    expect(firstFitDecreasing({ lengths: [8], pieces: [40, 100], kerf: 0, trimPerEnd: 0 })).toEqual(
      { boards: [{ feet: 8, pieces: [0] }], unfit: [1] },
    );
  });
});

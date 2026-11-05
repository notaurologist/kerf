import { describe, expect, it } from 'vitest';
import { Matrix } from './matrix.ts';
import { solveSymmetric } from './solve.ts';

describe('solveSymmetric', () => {
  it('solves a small positive definite system', () => {
    // [4 2; 2 3]·x = [10; 8] has x = [7/4, 3/2]: 4 × 7/4 + 2 × 3/2 = 10, 2 × 7/4 + 3 × 3/2 = 8.
    const result = solveSymmetric(
      Matrix.from([
        [4, 2],
        [2, 3],
      ]),
      [10, 8],
    );
    if (result.kind !== 'solved') throw new Error('Expected a solution');
    expect(result.x[0]).toBeCloseTo(7 / 4, 12);
    expect(result.x[1]).toBeCloseTo(3 / 2, 12);
  });

  it('reports the row where a singular matrix runs out of stiffness', () => {
    // Two springs in series with nothing holding either end: the second row is the first's
    // negative once the first is eliminated.
    const result = solveSymmetric(
      Matrix.from([
        [1, -1],
        [-1, 1],
      ]),
      [0, 0],
    );
    expect(result).toEqual({ kind: 'singular', index: 1 });
  });

  it('reports a zero diagonal as singular', () => {
    expect(solveSymmetric(new Matrix(1), [0])).toEqual({ kind: 'singular', index: 0 });
  });
});

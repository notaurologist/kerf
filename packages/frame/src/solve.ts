// Solves K·d = P for a symmetric stiffness matrix by Cholesky factorization, K = L·Lᵀ, written
// here so the package has no dependency. A stable structure's stiffness matrix, with its supports
// applied, is positive definite, so the factorization succeeds. When a pivot vanishes, the
// structure can move without straining any member there (a mechanism) and no displacements exist
// to report.

import type { Matrix } from './matrix.ts';

// A pivot this small next to its own diagonal term means the stiffness left at that degree of
// freedom, once the ones before it are eliminated, is rounding error: the 15 or so significant
// digits of a double, less what a frame with stiff axial and soft bending terms uses up.
const SINGULAR = 1e-10;

export type Solution =
  | { kind: 'solved'; x: number[] }
  /** `index` is the row whose pivot vanished: a degree of freedom the structure cannot hold. */
  | { kind: 'singular'; index: number };

export function solveSymmetric(k: Matrix, p: readonly number[]): Solution {
  const n = k.size;
  if (p.length !== n) throw new Error('Load vector length does not match the matrix.');
  const l: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const at = (i: number, j: number) => (l[i] as number[])[j] as number;
  for (let j = 0; j < n; j++) {
    let pivot = k.get(j, j);
    for (let m = 0; m < j; m++) pivot -= at(j, m) ** 2;
    if (!(pivot > SINGULAR * Math.abs(k.get(j, j)) && pivot > 0))
      return { kind: 'singular', index: j };
    const root = Math.sqrt(pivot);
    (l[j] as number[])[j] = root;
    for (let i = j + 1; i < n; i++) {
      let sum = k.get(i, j);
      for (let m = 0; m < j; m++) sum -= at(i, m) * at(j, m);
      (l[i] as number[])[j] = sum / root;
    }
  }
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = p[i] as number;
    for (let m = 0; m < i; m++) sum -= at(i, m) * (y[m] as number);
    y[i] = sum / at(i, i);
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i] as number;
    for (let m = i + 1; m < n; m++) sum -= at(m, i) * (x[m] as number);
    x[i] = sum / at(i, i);
  }
  return { kind: 'solved', x };
}

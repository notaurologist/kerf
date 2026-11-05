// A dense tableau simplex for max c·y subject to A·y ≤ b, y ≥ 0, with b ≥ 0, so the slack basis
// is a feasible start and no first phase is needed. Bland's rule (lowest index enters, lowest
// basic index leaves on ties) keeps it from cycling (Bland, "New finite pivoting rules for the
// simplex method", Mathematics of Operations Research 2(2), 1977). Small and slow by design: the
// instances here have tens of rows and columns.

const EPS = 1e-9;

export interface LpResult {
  /** The optimal objective value. */
  value: number;
  /** The optimal y. */
  y: number[];
  /**
   * The dual values, one per row of A: the optimal solution of min b·x subject to Aᵀx ≥ c, x ≥ 0,
   * read from the objective row under each slack column.
   */
  dual: number[];
}

export function maximize(
  c: readonly number[],
  a: readonly (readonly number[])[],
  b: readonly number[],
): LpResult {
  const m = a.length;
  const n = c.length;
  if (b.some((v) => v < 0)) throw new Error('Right-hand sides must be at least zero.');
  const width = n + m + 1;
  const rows: number[][] = a.map((row, i) => {
    const r = new Array<number>(width).fill(0);
    for (let j = 0; j < n; j++) r[j] = row[j] ?? 0;
    r[n + i] = 1;
    r[width - 1] = b[i] ?? 0;
    return r;
  });
  const z = new Array<number>(width).fill(0);
  for (let j = 0; j < n; j++) z[j] = -(c[j] ?? 0);
  const basis = Array.from({ length: m }, (_, i) => n + i);

  for (;;) {
    let enter = -1;
    for (let j = 0; j < width - 1; j++) {
      if ((z[j] ?? 0) < -EPS) {
        enter = j;
        break;
      }
    }
    if (enter < 0) break;
    let leave = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < m; i++) {
      const row = rows[i] as number[];
      const pivot = row[enter] ?? 0;
      if (pivot <= EPS) continue;
      const ratio = (row[width - 1] ?? 0) / pivot;
      if (
        ratio < best - EPS ||
        (Math.abs(ratio - best) <= EPS && (basis[i] ?? 0) < (basis[leave] ?? 0))
      ) {
        best = ratio;
        leave = i;
      }
    }
    if (leave < 0) throw new Error('The linear program is unbounded.');
    const pivotRow = rows[leave] as number[];
    const pivot = pivotRow[enter] ?? 1;
    for (let j = 0; j < width; j++) pivotRow[j] = (pivotRow[j] ?? 0) / pivot;
    const eliminate = (row: number[]) => {
      const factor = row[enter] ?? 0;
      if (factor === 0) return;
      for (let j = 0; j < width; j++) row[j] = (row[j] ?? 0) - factor * (pivotRow[j] ?? 0);
    };
    rows.forEach((row, i) => {
      if (i !== leave) eliminate(row);
    });
    eliminate(z);
    basis[leave] = enter;
  }

  const y = new Array<number>(n).fill(0);
  basis.forEach((j, i) => {
    if (j < n) y[j] = rows[i]?.[width - 1] ?? 0;
  });
  return {
    value: z[width - 1] ?? 0,
    y,
    dual: Array.from({ length: m }, (_, i) => z[n + i] ?? 0),
  };
}

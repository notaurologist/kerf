// The exact method's work, counted as it runs, so a search stopped at a limit stops at the same
// point on any machine and under any load, where a time limit would not.
//
// Three operations take nearly all the time, and each is charged in units of about the same
// time: a step of the knapsack's branch-and-bound (1 unit), a step of the enumeration of boards a
// search node branches on (20 units), and a simplex pivot (1 unit per 25 cells of its tableau).
// The weights are a least-squares fit of time to the three counts over the benchmark's 260
// instances, where they predict each slow instance's time to within about 20%. One unit took 20 to
// 40 ns on the machine that wrote report.md. The weights set how far the search gets before it
// stops, so changing them changes plans.

export const COST = {
  /** Each search node, so every loop of the search is charged. */
  node: 1,
  knapsackStep: 1,
  boardStep: 20,
  /** Tableau cells per unit of a pivot. */
  cellsPerUnit: 25,
} as const;

/** Thrown when the work spent passes the limit. */
export class OutOfWork extends Error {
  constructor() {
    super('Out of work.');
  }
}

export class Work {
  readonly limit: number;
  spent = 0;

  constructor(limit = Number.POSITIVE_INFINITY) {
    this.limit = limit;
  }

  spend(units: number): void {
    this.spent += units;
    if (this.spent > this.limit) throw new OutOfWork();
  }
}

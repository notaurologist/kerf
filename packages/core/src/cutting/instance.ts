// A cutting-stock instance is one stock's pieces and the lengths that stock is sold in, with the
// saw kerf and end trim every plan allows (DOMAIN.md, Buyable lengths). A board of length L holds a
// set of pieces when 2·trim + Σ(piece + kerf) ≤ L. Pieces are never joined end to end.

export interface CutInstance {
  /** Buyable lengths in whole feet, shortest first. */
  lengths: readonly number[];
  /** Each piece's length, in inches. */
  pieces: readonly number[];
  /** Inches charged once per piece. */
  kerf: number;
  /** Inches trimmed off each factory end. */
  trimPerEnd: number;
}

/** A plan for one instance. Pieces are named by their index in the instance's pieces. */
export interface CutPlan {
  boards: { feet: number; pieces: number[] }[];
  /** Pieces no buyable length holds. */
  unfit: number[];
}

/** Inches a board's pieces use: trim at both ends, plus each piece and its kerf. */
export function used(instance: CutInstance, pieces: readonly number[]): number {
  let sum = 2 * instance.trimPerEnd;
  for (const i of pieces) sum += (instance.pieces[i] ?? Number.NaN) + instance.kerf;
  return sum;
}

/** True when a piece fits no buyable length, even alone. */
export function fitsNoLength(instance: CutInstance, piece: number): boolean {
  const need = used(instance, [piece]);
  return !instance.lengths.some((feet) => feet * 12 >= need);
}

/** Feet bought and boards: the objective and its tie-break. */
export function measure(plan: CutPlan): { feet: number; boards: number } {
  return {
    feet: plan.boards.reduce((sum, board) => sum + board.feet, 0),
    boards: plan.boards.length,
  };
}

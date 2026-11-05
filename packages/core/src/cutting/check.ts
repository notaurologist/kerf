import { type CutInstance, type CutPlan, fitsNoLength, used } from './instance.ts';

/**
 * What is wrong with a plan, empty when nothing is: every piece on exactly one board or listed as
 * unfit, unfit only when no length holds it alone, each board a buyable length, and each board's
 * pieces, trim, and kerf within its length.
 */
export function planProblems(instance: CutInstance, plan: CutPlan): string[] {
  const problems: string[] = [];
  const seen = new Array<number>(instance.pieces.length).fill(0);
  const count = (i: number) => {
    if (!Number.isInteger(i) || i < 0 || i >= instance.pieces.length) {
      problems.push(`Piece ${i} is not in the instance.`);
      return;
    }
    seen[i] = (seen[i] ?? 0) + 1;
  };
  plan.boards.forEach((board, b) => {
    if (board.pieces.length === 0) problems.push(`Board ${b} has no pieces.`);
    if (!instance.lengths.includes(board.feet)) {
      problems.push(`Board ${b} is ${board.feet}', which is not a buyable length.`);
    }
    for (const i of board.pieces) count(i);
    const need = used(instance, board.pieces);
    if (need > board.feet * 12) {
      problems.push(`Board ${b} needs ${need}" but is ${board.feet * 12}".`);
    }
  });
  for (const i of plan.unfit) {
    count(i);
    if (i >= 0 && i < instance.pieces.length && !fitsNoLength(instance, i)) {
      problems.push(`Piece ${i} is listed as unfit but fits a buyable length.`);
    }
  }
  seen.forEach((n, i) => {
    if (n === 0) problems.push(`Piece ${i} is missing.`);
    if (n > 1) problems.push(`Piece ${i} is planned ${n} times.`);
  });
  return problems;
}

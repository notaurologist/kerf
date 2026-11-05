import { type CutPlan, type Instance, used } from './instance.ts';

/**
 * Today's grouping (`planLumber` in core): first-fit decreasing into the longest length, then
 * each board shortened to the shortest length that still holds its pieces.
 */
export function firstFitDecreasing(instance: Instance): CutPlan {
  const longest = (instance.lengths.at(-1) ?? 0) * 12;
  const order = instance.pieces
    .map((piece, i) => ({ i, length: piece.length }))
    .sort((a, b) => b.length - a.length)
    .map(({ i }) => i);
  const open: number[][] = [];
  const unfit: number[] = [];
  for (const i of order) {
    if (used(instance, [i]) > longest) {
      unfit.push(i);
      continue;
    }
    const fit = open.find((board) => used(instance, [...board, i]) <= longest);
    if (fit) fit.push(i);
    else open.push([i]);
  }
  const boards = open.map((pieces) => {
    const need = used(instance, pieces);
    const feet = instance.lengths.find((f) => f * 12 >= need) ?? longest / 12;
    return { feet, pieces };
  });
  return { boards, unfit };
}

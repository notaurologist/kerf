import {
  type BoardOptions,
  DEFAULT_BOARD_OPTIONS,
  isBoardStock,
  isPanel,
  isStripGlueUp,
  type Part,
  stripBoardsFor,
} from '@kerf/core';

// A cutting-stock instance is one stock's pieces and the lengths that stock is sold in, with the
// saw kerf and end trim every plan allows. The pieces are what `planLumber` plans onto boards, in
// its order, so a method's plan can be compared with the shopping list's board for board.

export interface Piece {
  partId: string;
  name: string;
  /** Inches. */
  length: number;
}

export interface Instance {
  /** The stock's name, as the shopping list shows it. */
  nominal: string;
  /** Buyable lengths in feet, shortest first. */
  lengths: readonly number[];
  pieces: readonly Piece[];
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

/**
 * One instance per stock, grouped as `planLumber` groups them: a panel's boards and a strip
 * glue-up's boards are pieces of their board stock, and other parts are pieces of their own stock.
 * A piece whose stock reuses another stock's name with a different size is left out, as
 * `planLumber` leaves it out with an issue.
 */
export function instancesFromParts(
  parts: readonly Part[],
  options: BoardOptions = DEFAULT_BOARD_OPTIONS,
): Instance[] {
  const groups = new Map<string, { size: string; lengths: number[]; pieces: Piece[] }>();
  const add = (
    stock: { nominal: string; thickness: number; width: number; byBoardFoot?: unknown },
    feet: readonly number[],
    piece: Piece,
    count: number,
  ) => {
    const lengths = [...feet].sort((a, b) => a - b);
    const size = JSON.stringify([stock.thickness, stock.width, lengths, stock.byBoardFoot ?? null]);
    const group = groups.get(stock.nominal) ?? { size, lengths, pieces: [] };
    if (group.size !== size) return;
    for (let i = 0; i < count; i++) group.pieces.push({ ...piece });
    groups.set(stock.nominal, group);
  };
  for (const part of parts) {
    const { stock } = part;
    if (isPanel(stock)) {
      add(
        stock.board,
        stock.board.buyableFeet,
        { partId: part.id, name: `${part.name} board`, length: stock.boardLength },
        part.quantity * stock.boards,
      );
    } else if (isStripGlueUp(stock)) {
      add(
        stock.board,
        stock.board.buyableFeet,
        { partId: part.id, name: `${part.name} board for strips`, length: stock.stripLength },
        stripBoardsFor(stock, part.quantity),
      );
    } else {
      add(
        stock,
        isBoardStock(stock) ? stock.buyableFeet : options.buyableFeet,
        { partId: part.id, name: part.name, length: part.length },
        part.quantity,
      );
    }
  }
  return [...groups].map(([nominal, group]) => ({
    nominal,
    lengths: group.lengths,
    pieces: group.pieces,
    kerf: options.kerf,
    trimPerEnd: options.trimPerEnd,
  }));
}

/** Inches a board's pieces use: trim at both ends, plus each piece and its kerf. */
export function used(instance: Instance, pieces: readonly number[]): number {
  let sum = 2 * instance.trimPerEnd;
  for (const i of pieces) sum += (instance.pieces[i]?.length ?? Number.NaN) + instance.kerf;
  return sum;
}

/** The shortest buyable length, in feet, that holds `inches`, if any. */
function shortestHolding(instance: Instance, inches: number): number | undefined {
  return instance.lengths.find((feet) => feet * 12 >= inches);
}

/** True when a piece fits no buyable length, even alone. */
export function fitsNoLength(instance: Instance, piece: number): boolean {
  return shortestHolding(instance, used(instance, [piece])) === undefined;
}

import { z } from 'zod';
import { NOMINAL_SIZES, type NominalSize } from '../lumber/stock.ts';
import { Issue, type Part } from '../templates/types.ts';
import { formatLength } from '../units/length.ts';

// Groups parts into boards to buy (PRODUCT.md, MVP feature 4; DOMAIN.md, Buyable lengths).
// This is simple grouping, not optimization: first-fit decreasing into the longest board, then
// each board is shortened to the smallest buyable length that still holds its pieces.

export interface BoardOptions {
  /** Width of the saw blade's cut, charged once per piece. */
  kerf: number;
  /** Trimmed off each factory end before cutting, since factory ends are often not square. */
  trimPerEnd: number;
  /** Lengths the store sells, in feet. */
  buyableFeet: readonly number[];
}

export const DEFAULT_BOARD_OPTIONS: BoardOptions = {
  kerf: 0.125,
  trimPerEnd: 0.5,
  buyableFeet: [8, 10, 12, 14, 16],
};

const Nominal = z.enum(NOMINAL_SIZES as [NominalSize, ...NominalSize[]]);

export const PlannedPiece = z.object({
  partId: z.string(),
  name: z.string(),
  length: z.number(),
});
export type PlannedPiece = z.infer<typeof PlannedPiece>;

export const PlannedBoard = z.object({
  nominal: Nominal,
  feet: z.number(),
  pieces: z.array(PlannedPiece),
  /** Board length left after trim, pieces, and kerf. */
  offcut: z.number(),
});
export type PlannedBoard = z.infer<typeof PlannedBoard>;

export const ShoppingLine = z.object({
  nominal: Nominal,
  feet: z.number(),
  count: z.number().int(),
});
export type ShoppingLine = z.infer<typeof ShoppingLine>;

export const LumberPlan = z.object({
  boards: z.array(PlannedBoard),
  lines: z.array(ShoppingLine),
  /** Assumptions and tips to show with the list. */
  notes: z.array(z.string()),
  /** Parts that fit no buyable board. They are never dropped silently. */
  issues: z.array(Issue),
});
export type LumberPlan = z.infer<typeof LumberPlan>;

/** Length a set of pieces uses on one board: trim at both ends, plus each piece and its kerf. */
function used(pieces: readonly PlannedPiece[], options: BoardOptions): number {
  return (
    2 * options.trimPerEnd + pieces.reduce((sum, piece) => sum + piece.length + options.kerf, 0)
  );
}

export function planLumber(
  parts: readonly Part[],
  options: BoardOptions = DEFAULT_BOARD_OPTIONS,
): LumberPlan {
  const lengths = [...options.buyableFeet].sort((a, b) => a - b);
  const longestFeet = lengths[lengths.length - 1] ?? 0;
  const issues: Issue[] = [];
  const notes: string[] = [
    `Allows ${formatLength(options.kerf)} for each saw cut and trims ${formatLength(options.trimPerEnd)} off each factory end.`,
  ];

  // Pieces grouped by stock, longest first.
  const byStock = new Map<NominalSize, PlannedPiece[]>();
  for (const part of parts) {
    const pieces = byStock.get(part.stock.nominal) ?? [];
    for (let i = 0; i < part.quantity; i++) {
      pieces.push({ partId: part.id, name: part.name, length: part.length });
    }
    byStock.set(part.stock.nominal, pieces);
  }

  const boards: PlannedBoard[] = [];
  for (const [nominal, pieces] of byStock) {
    pieces.sort((a, b) => b.length - a.length);
    const open: PlannedPiece[][] = [];
    for (const piece of pieces) {
      if (used([piece], options) > longestFeet * 12) {
        issues.push({
          code: 'part-longer-than-any-board',
          message: `${piece.name} (${formatLength(piece.length)}) is longer than the longest ${nominal} board available (${longestFeet}' after trim and kerf).`,
          params: [],
        });
        continue;
      }
      const fit = open.find((board) => used([...board, piece], options) <= longestFeet * 12);
      if (fit) fit.push(piece);
      else open.push([piece]);
    }
    for (const boardPieces of open) {
      const need = used(boardPieces, options);
      const feet = lengths.find((f) => f * 12 >= need) ?? longestFeet;
      boards.push({ nominal, feet, pieces: boardPieces, offcut: feet * 12 - need });

      // A single piece that just misses a shorter board: store boards often run a little long.
      const shorter = lengths.filter((f) => f < feet).at(-1);
      if (
        boardPieces.length === 1 &&
        shorter !== undefined &&
        need - shorter * 12 <= 2 * options.trimPerEnd + options.kerf
      ) {
        notes.push(
          `${boardPieces[0]?.name}: listed as ${feet}' to leave room for trimming the ends. A ${shorter}' board works if it measures at least ${formatLength(need)}.`,
        );
      }
    }
  }

  const counts = new Map<string, ShoppingLine>();
  for (const board of boards) {
    const key = `${board.nominal}/${board.feet}`;
    const line = counts.get(key) ?? { nominal: board.nominal, feet: board.feet, count: 0 };
    line.count += 1;
    counts.set(key, line);
  }

  return { boards, lines: [...counts.values()], notes, issues };
}

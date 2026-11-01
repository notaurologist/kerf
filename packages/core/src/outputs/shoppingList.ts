import { z } from 'zod';
import { type BoardStock, isBoardStock, isPanel } from '../lumber/panel.ts';
import { Issue, type Part } from '../model/types.ts';
import { formatLength } from '../units/length.ts';

// Groups parts into boards to buy (PRODUCT.md, MVP feature 4; DOMAIN.md, Buyable lengths).
// This is simple grouping, not optimization: first-fit decreasing into the longest board, then
// each board is shortened to the smallest buyable length that still holds its pieces. A panel's
// boards are pieces of its board stock, each the panel's board length.

export interface BoardOptions {
  /** Width of the saw blade's cut, charged once per piece. */
  kerf: number;
  /** Trimmed off each factory end before cutting, since factory ends are often not square. */
  trimPerEnd: number;
  /** Lengths the store sells dimension lumber in, in feet. Board stock gives its own. */
  buyableFeet: readonly number[];
}

export const DEFAULT_BOARD_OPTIONS: BoardOptions = {
  kerf: 0.125,
  trimPerEnd: 0.5,
  buyableFeet: [8, 10, 12, 14, 16],
};

/** A stock's name: a nominal size for dimension lumber, or the owner's name for board stock. */
const Nominal = z.string();

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
  /** For stock sold by the board foot: the board feet these boards make, with the waste added. */
  boardFeet: z.number().optional(),
});
export type ShoppingLine = z.infer<typeof ShoppingLine>;

export const LumberPlan = z.object({
  /** Boards in the order to cut them; each board's pieces in the order they come off it (#58). */
  boards: z.array(PlannedBoard),
  /**
   * The saw cut and end trim the boards were planned with (BoardOptions), so cutting steps can
   * say them.
   */
  kerf: z.number(),
  trimPerEnd: z.number(),
  lines: z.array(ShoppingLine),
  /** Assumptions and tips to show with the list. */
  notes: z.array(z.string()),
  /** Parts that fit no buyable board. They are never dropped silently. */
  issues: z.array(Issue),
  /**
   * What to look for when choosing each part's board, by part ID: guide IDs from the knowledge
   * base, as the part lists them.
   */
  selection: z.array(z.object({ partId: z.string(), guides: z.array(z.string()) })),
});
export type LumberPlan = z.infer<typeof LumberPlan>;

/** A lumber line's key: its nominal size and length, such as "2x6/12" (#57). */
export function lumberLineKey(line: Pick<ShoppingLine, 'nominal' | 'feet'>): string {
  return `${line.nominal}/${line.feet}`;
}

/**
 * An ID for each board, in the board plan's order: its line's key and which board of that line it
 * is, from 1, such as "2x6/12/2" (#57). Boards of other sizes do not shift it, so saved progress on
 * a board survives a change that adds or removes boards of another size.
 */
export function boardIds(boards: readonly Pick<PlannedBoard, 'nominal' | 'feet'>[]): string[] {
  const seen = new Map<string, number>();
  return boards.map((board) => {
    const line = lumberLineKey(board);
    const n = (seen.get(line) ?? 0) + 1;
    seen.set(line, n);
    return `${line}/${n}`;
  });
}

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
  const issues: Issue[] = [];
  const notes: string[] = [
    `Allows ${formatLength(options.kerf)} for each saw cut and trims ${formatLength(options.trimPerEnd)} off each factory end.`,
  ];

  // Pieces grouped by stock, longest first, with the lengths each stock is sold in. Two stocks
  // with one name but different sizes or lengths would be bought as one, so that is refused.
  type Group = {
    size: string;
    feet: readonly number[];
    pieces: PlannedPiece[];
    byBoardFoot?: { width: number } & NonNullable<BoardStock['byBoardFoot']>;
  };
  const byStock = new Map<string, Group>();
  const add = (
    stock: {
      nominal: string;
      thickness: number;
      width: number;
      byBoardFoot?: BoardStock['byBoardFoot'];
    },
    feet: readonly number[],
    piece: PlannedPiece,
    count: number,
  ) => {
    const size = JSON.stringify([
      stock.thickness,
      stock.width,
      [...feet].sort((a, b) => a - b),
      stock.byBoardFoot ?? null,
    ]);
    const group = byStock.get(stock.nominal) ?? {
      size,
      feet,
      pieces: [],
      ...(stock.byBoardFoot ? { byBoardFoot: { ...stock.byBoardFoot, width: stock.width } } : {}),
    };
    if (group.size !== size) {
      issues.push({
        code: 'stock-name-reused',
        message: `Two different stocks are both named ${stock.nominal}. Give each its own name.`,
        params: [],
      });
      return;
    }
    for (let i = 0; i < count; i++) group.pieces.push({ ...piece });
    byStock.set(stock.nominal, group);
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
    } else {
      add(
        stock,
        isBoardStock(stock) ? stock.buyableFeet : options.buyableFeet,
        { partId: part.id, name: part.name, length: part.length },
        part.quantity,
      );
    }
  }

  const boards: PlannedBoard[] = [];
  for (const [nominal, group] of byStock) {
    const lengths = [...group.feet].sort((a, b) => a - b);
    const longestFeet = lengths[lengths.length - 1] ?? 0;
    const pieces = group.pieces.sort((a, b) => b.length - a.length);
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

  // Board feet (American Softwood Lumber Standard, PS 20-10, 2.2): nominal thickness in inches ×
  // width in feet × length in feet, for each board the plan counts on, plus the waste allowance.
  const counts = new Map<string, ShoppingLine>();
  for (const board of boards) {
    const key = `${board.nominal}/${board.feet}`;
    const line = counts.get(key) ?? { nominal: board.nominal, feet: board.feet, count: 0 };
    line.count += 1;
    const sold = byStock.get(board.nominal)?.byBoardFoot;
    if (sold) {
      const feet = sold.nominalThickness * (sold.width / 12) * board.feet * (1 + sold.waste);
      line.boardFeet = (line.boardFeet ?? 0) + feet;
    }
    counts.set(key, line);
  }
  for (const [nominal, group] of byStock) {
    const sold = group.byBoardFoot;
    if (!sold) continue;
    notes.push(
      `${nominal} is sold by the board foot in random widths. The boards are planned ${formatLength(sold.width)} wide, with ${Math.round(sold.waste * 100)}% more board feet for defects and offcuts; wider boards need fewer.`,
    );
  }

  const selection = parts
    .filter((p) => p.selection.length > 0)
    .map((p) => ({ partId: p.id, guides: [...p.selection] }));
  return {
    boards,
    kerf: options.kerf,
    trimPerEnd: options.trimPerEnd,
    lines: [...counts.values()],
    notes,
    issues,
    selection,
  };
}

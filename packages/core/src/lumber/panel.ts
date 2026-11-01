import { z } from 'zod';
import type { Issue } from '../model/types.ts';
import { formatLength } from '../units/length.ts';
import { Stock } from './stock.ts';

// Edge-glued panels (DOMAIN.md, Lumber basics): a part wider than a board, made from boards glued
// edge to edge and then cut to its finished width and length. The boards run along the part's
// length, so its grain does too.

/**
 * Surfaced boards the owner buys at a fixed width, such as hardwood boards at a home center. Sizes
 * and lengths vary by store and Kerf has no published standard for them, so the owner enters what
 * their store sells.
 */
export const BoardStock = z.object({
  /** The owner's name for it, such as "1x6 cherry". Shopping lists group boards by it. */
  nominal: z.string().min(1),
  /** Actual thickness, inches. */
  thickness: z.number().positive(),
  /** Actual width, inches. */
  width: z.number().positive(),
  /** Lengths the store sells, in feet. */
  buyableFeet: z.array(z.number().positive()).min(1),
});
export type BoardStock = z.infer<typeof BoardStock>;

/** Extra wood for making a panel, all entered by the owner: Kerf has no source for any of them. */
export const PanelAllowances = z.object({
  /** Width planed off each glued edge to make it straight and square for gluing. */
  jointPerEdge: z.number().nonnegative(),
  /** Extra width the glued-up panel needs beyond its finished width, ripped off at the end. */
  rip: z.number().nonnegative(),
  /** Extra length at each end of each board, cut off when the panel is cut to length. */
  trimPerEnd: z.number().nonnegative(),
  /** Thickness taken off a glued-up panel to bring its faces flat and level across the joints. */
  flatten: z.number().nonnegative(),
});
export type PanelAllowances = z.infer<typeof PanelAllowances>;

/** A panel part's stock: its finished size and the boards it is glued from. */
export const PanelStock = z.object({
  /** Finished thickness, inches. One board ripped to width keeps the board's thickness. */
  thickness: z.number(),
  /** Finished width, inches. */
  width: z.number(),
  board: BoardStock,
  /** Boards glued edge to edge, side by side. One board is ripped to width, with nothing glued. */
  boards: z.number().int().positive(),
  /** Each board's length before gluing: the part's length plus trim at both ends. */
  boardLength: z.number(),
  /** Width of the glued-up panel before it is ripped to its finished width. */
  gluedWidth: z.number(),
  allowances: PanelAllowances,
});
export type PanelStock = z.infer<typeof PanelStock>;

/** What a part is cut from: dimension lumber, or a panel glued from boards. */
export const PartStock = z.union([PanelStock, Stock]);
export type PartStock = z.infer<typeof PartStock>;

export function isPanel(stock: PartStock): stock is PanelStock {
  return 'boards' in stock;
}

/** Board counts within this of a whole number are taken as that number, so float error adds none. */
const WHOLE = 1e-9;

/**
 * The panel stock for a part of the given finished size. With n boards of width w, each glued
 * edge loses the jointing allowance a, and there are n − 1 glue joints with two edges each, so the
 * glued width is n·w − 2a(n − 1). The fewest boards whose glued width covers the finished width
 * plus the rip allowance is n = ⌈(width + rip − 2a) / (w − 2a)⌉.
 */
export function panelStock(input: {
  thickness: number;
  width: number;
  length: number;
  board: BoardStock;
  allowances: PanelAllowances;
}): { ok: true; stock: PanelStock } | { ok: false; issue: Issue } {
  const { thickness, width, length, board, allowances } = input;
  const a = allowances.jointPerEdge;
  if (thickness > board.thickness) {
    return refuse(
      'panel-thicker-than-board',
      `A ${formatLength(thickness)} panel can't be made from ${board.nominal}, which is ${formatLength(board.thickness)} thick.`,
    );
  }
  if (board.width <= 2 * a) {
    return refuse(
      'board-narrower-than-jointing',
      `${board.nominal} is ${formatLength(board.width)} wide, which jointing ${formatLength(a)} off each edge would use up.`,
    );
  }
  const boards = Math.max(
    1,
    Math.ceil((width + allowances.rip - 2 * a) / (board.width - 2 * a) - WHOLE),
  );
  // Only a glued-up panel is flattened; one board ripped to width keeps its thickness.
  const flattened = board.thickness - allowances.flatten;
  if (boards > 1 && thickness > flattened) {
    return refuse(
      'panel-thicker-than-flattened',
      `A ${formatLength(thickness)} panel can't be glued up from ${board.nominal}: it is ${formatLength(board.thickness)} thick, and flattening the glued-up panel takes off ${formatLength(allowances.flatten)}, leaving ${formatLength(flattened)}.`,
    );
  }
  return {
    ok: true,
    stock: {
      thickness: boards === 1 ? board.thickness : thickness,
      width,
      board,
      boards,
      boardLength: length + 2 * allowances.trimPerEnd,
      gluedWidth: boards * board.width - 2 * a * (boards - 1),
      allowances,
    },
  };
}

function refuse(code: string, message: string): { ok: false; issue: Issue } {
  return { ok: false, issue: { code, message, params: [] } };
}

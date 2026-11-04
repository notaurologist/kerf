import { z } from 'zod';
import type { Issue } from '../model/types.ts';
import { formatLength } from '../units/length.ts';
import { BoardStock, PanelAllowances } from './panel.ts';

// Strip glue-ups (DOMAIN.md, Lumber basics): a part thicker than a board, made from strips ripped
// from boards and glued face to face, so the boards' faces meet at each glue line. Standing on
// edge, the strips make a thick top whose thickness is their ripped width; lying flat, they make
// a square leg or beam. The strips run along the part's length, so its grain does too.

/**
 * Extra wood for a strip glue-up: the panel allowances that apply to it. Jointing does not: the
 * glued faces are the boards' own surfaced faces, and each strip's sawn edges are flattened.
 */
export const StripAllowances = PanelAllowances.pick({ rip: true, trimPerEnd: true, flatten: true });
export type StripAllowances = z.infer<typeof StripAllowances>;

/** A strip glue-up part's stock: its finished size and the strips it is glued from. */
export const StripGlueUp = z.object({
  /** Finished thickness, inches. */
  thickness: z.number(),
  /** Finished width, inches. */
  width: z.number(),
  board: BoardStock,
  /**
   * The finished dimension the strips are stacked across, glue line to glue line, which the
   * strip count covers: the width for a top of strips standing on edge. The other dimension is
   * the strips' ripped width less flattening.
   */
  stackedAcross: z.enum(['thickness', 'width']),
  /** Strips glued face to face, each one board thick. */
  strips: z.number().int().min(2),
  /** Each strip's ripped width: the finished dimension across it plus the flattening allowance. */
  stripWidth: z.number(),
  /** Each strip's length before gluing: the part's length plus trim at both ends. */
  stripLength: z.number(),
  /** Strips ripped side by side from one board's width, with a saw kerf between each two. */
  stripsPerBoard: z.number().int().positive(),
  /** Size of the glue-up across its strips before it is ripped: strips × board thickness. */
  gluedAcross: z.number(),
  /** The saw kerf between strips ripped from one board. */
  kerf: z.number().nonnegative(),
  /** For board-foot stock, the narrowest board that still gives `stripsPerBoard` strips. */
  minBoardWidth: z.number().optional(),
  allowances: StripAllowances,
});
export type StripGlueUp = z.infer<typeof StripGlueUp>;

/** Counts within this of a whole number are taken as that number, so float error adds none. */
const WHOLE = 1e-9;

/**
 * The strip glue-up for a part of the given finished size. With boards t thick and w wide, a
 * flattening allowance f, and a rip allowance r:
 * - each strip is ripped to s = (the finished size across the strips' width) + f;
 * - the fewest strips whose glued size covers the stacked dimension plus r is
 *   n = ⌈(stacked + r) / t⌉, glued to n·t;
 * - one board gives k = ⌊(w + kerf) / (s + kerf)⌋ strips, since k strips and the k − 1 kerfs
 *   between them use k·s + (k − 1)·kerf of its width.
 */
export function stripGlueUp(input: {
  thickness: number;
  width: number;
  length: number;
  stackedAcross: StripGlueUp['stackedAcross'];
  board: BoardStock;
  allowances: StripAllowances;
  kerf: number;
}): { ok: true; stock: StripGlueUp } | { ok: false; issue: Issue } {
  const { thickness, width, length, stackedAcross, board, kerf } = input;
  const { rip, trimPerEnd, flatten } = input.allowances;
  const [stacked, ripped] = stackedAcross === 'width' ? [width, thickness] : [thickness, width];
  const stripWidth = ripped + flatten;
  if (stripWidth > board.width) {
    return refuse(
      'strip-wider-than-board',
      `A ${formatLength(ripped)} glue-up needs strips ${formatLength(stripWidth)} wide, with ${formatLength(flatten)} for flattening, and ${board.nominal} is ${formatLength(board.width)} wide.`,
    );
  }
  const strips = Math.ceil((stacked + rip) / board.thickness - WHOLE);
  if (strips < 2) {
    return refuse(
      'glue-up-of-one-strip',
      `A ${formatLength(stacked)} glue-up is one strip of ${board.nominal}, which is ${formatLength(board.thickness)} thick. Cut the part from the board instead.`,
    );
  }
  const stripsPerBoard = Math.floor((board.width + kerf) / (stripWidth + kerf) + WHOLE);
  return {
    ok: true,
    stock: {
      thickness,
      width,
      board,
      stackedAcross,
      strips,
      stripWidth,
      stripLength: length + 2 * trimPerEnd,
      stripsPerBoard,
      gluedAcross: strips * board.thickness,
      kerf,
      ...(board.byBoardFoot
        ? { minBoardWidth: stripsPerBoard * stripWidth + (stripsPerBoard - 1) * kerf }
        : {}),
      allowances: { rip, trimPerEnd, flatten },
    },
  };
}

/** Board lengths to buy for `quantity` parts: their strips share boards, k to a board. */
export function stripBoardsFor(stock: StripGlueUp, quantity: number): number {
  return Math.ceil((quantity * stock.strips) / stock.stripsPerBoard);
}

function refuse(code: string, message: string): { ok: false; issue: Issue } {
  return { ok: false, issue: { code, message, params: [] } };
}

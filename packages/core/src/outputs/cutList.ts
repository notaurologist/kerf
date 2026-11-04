import { z } from 'zod';
import { isBoardStock, isPanel, isStripGlueUp, type PartStock } from '../lumber/partStock.ts';
import type { StripGlueUp } from '../lumber/strips.ts';
import type { Part } from '../model/types.ts';
import { angleToEdge, formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';

// Cut list rows ready to display (PRODUCT.md, MVP feature 3). Every length and angle goes
// through the shared formatters, so the cut list rounds the same way as every other view.

export const CutListRow = z.object({
  partId: z.string(),
  /** The part's letter, the same one its drawings show (#66). */
  letter: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  /**
   * Nominal name for buying, actual size for cutting: `4x4 (3-1/2" x 3-1/2")`. A panel gives its
   * finished size, `Panel (3/4" x 15")`, and its boards in `panel`.
   */
  stock: z.string(),
  /** A panel's finished width and the boards it is glued from; left out for other parts. */
  panel: z
    .object({
      width: z.string(),
      /** Each board's length before gluing. */
      boardLength: z.string(),
      /** How many boards: more than one are glued up; one is only ripped to width. */
      boards: z.number().int().positive(),
      /** The boards, how long, and the widths it is glued and ripped to, as one sentence. */
      recipe: z.string(),
    })
    .optional(),
  /** A strip glue-up's strips and how they are glued up; left out for other parts. */
  strips: z
    .object({
      /** How many strips, glued face to face. */
      strips: z.number().int().positive(),
      /** Each strip's ripped width. */
      stripWidth: z.string(),
      /** Each strip's length before gluing. */
      stripLength: z.string(),
      /** The strips, their size, the boards they come from, and the glue-up, as one sentence. */
      recipe: z.string(),
    })
    .optional(),
  /** Overall length, long point to long point. */
  length: z.string(),
  /** Each end: the saw setting and the angle to the board's edge, labeled (DOMAIN.md, Units). */
  ends: z.array(z.string()),
  /** True when both end cuts angle the same way (parallel); false when they mirror each other. */
  endsParallel: z.boolean(),
  marks: z.array(z.object({ label: z.string(), value: z.string() })),
  notes: z.array(z.string()),
});
export type CutListRow = z.infer<typeof CutListRow>;

function endText(setting: number, description: string): string {
  if (setting === 0) return description;
  return `${description}; saw at ${formatAngle(setting)}, ${formatAngle(angleToEdge(setting))} to the edge`;
}

const size = (s: { thickness: number; width: number }) =>
  `${formatLength(s.thickness)} x ${formatLength(s.width)}`;

function stockText(stock: PartStock): string {
  // Board stock named by its size, as the owner's often is, is not given it twice.
  if (isBoardStock(stock) && stock.nominal === size(stock)) return stock.nominal;
  if (isStripGlueUp(stock)) return `Glue-up (${size(stock)})`;
  if (!isPanel(stock)) return `${stock.nominal} (${size(stock)})`;
  return `${stock.boards === 1 ? 'Board' : 'Panel'} (${size(stock)})`;
}

function panelOf(stock: PartStock): CutListRow['panel'] {
  if (!isPanel(stock)) return undefined;
  const { board, boards } = stock;
  const width = formatLength(stock.width);
  const boardLength = formatLength(stock.boardLength);
  if (board.byBoardFoot && stock.minBoardWidth !== undefined) {
    // Random widths: each board's least width says what to pick at the yard.
    const named = `${board.nominal} (${formatLength(board.thickness)} thick)`;
    const least = formatLength(stock.minBoardWidth);
    const recipe =
      boards === 1
        ? `1 board of ${named}, at least ${least} wide and ${boardLength} long, ripped to ${width}`
        : `${boards} boards of ${named}, each at least ${least} wide and ${boardLength} long, glued up and ripped to ${width}`;
    return { width, boardLength, boards, recipe };
  }
  // A board stock named by its size, as the owner's often is, is not given it twice.
  const named = board.nominal === size(board) ? board.nominal : `${board.nominal} (${size(board)})`;
  const recipe =
    boards === 1
      ? `1 board of ${named}, ${boardLength} long, ripped to ${width}`
      : `${boards} boards of ${named}, each ${boardLength} long, glued to ${formatLength(stock.gluedWidth)} wide and ripped to ${width}`;
  return { width, boardLength, boards, recipe };
}

function stripsOf(stock: StripGlueUp): NonNullable<CutListRow['strips']> {
  const { board, strips, stripsPerBoard } = stock;
  const stripWidth = formatLength(stock.stripWidth);
  const stripLength = formatLength(stock.stripLength);
  const [stacked, ripped] =
    stock.stackedAcross === 'width'
      ? [stock.width, stock.thickness]
      : [stock.thickness, stock.width];
  const named = board.byBoardFoot
    ? `${board.nominal} (${formatLength(board.thickness)} thick)`
    : board.nominal === size(board)
      ? board.nominal
      : `${board.nominal} (${size(board)})`;
  // Random widths: the least width that gives this many strips says what to pick at the yard.
  const fromEach =
    stock.minBoardWidth === undefined
      ? `${stripsPerBoard} ripped from each board`
      : `${stripsPerBoard} ripped from each board at least ${formatLength(stock.minBoardWidth)} wide`;
  const trimmed =
    stock.gluedAcross - stacked > 1e-9
      ? `glued face to face to ${formatLength(stock.gluedAcross)} and ripped to ${formatLength(stacked)}`
      : `glued face to face to ${formatLength(stacked)}`;
  const recipe = `${strips} strips of ${named}, each ${stripWidth} wide and ${stripLength} long, ${fromEach}, ${trimmed}, then flattened to ${formatLength(ripped)}`;
  return { strips, stripWidth, stripLength, recipe };
}

/**
 * What a template calls an end, such as "Top" for "Top: level cut", so a drawing and a step label
 * the end with the name its text uses. Undefined for an end the template does not name.
 */
export function endName(description: string): string | undefined {
  const at = description.indexOf(': ');
  return at > 0 ? description.slice(0, at) : undefined;
}

/** How a panel row's part is made from its boards, to go before its recipe. */
export function panelMade(panel: NonNullable<CutListRow['panel']>): string {
  return panel.boards === 1 ? 'Ripped from' : 'Glued up from';
}

export function cutList(parts: readonly Part[]): CutListRow[] {
  return parts.map((part) => ({
    partId: part.id,
    letter: part.letter,
    name: part.name,
    quantity: part.quantity,
    stock: stockText(part.stock),
    ...(isPanel(part.stock) ? { panel: panelOf(part.stock) } : {}),
    ...(isStripGlueUp(part.stock) ? { strips: stripsOf(part.stock) } : {}),
    length: formatLength(part.length),
    ends: part.ends.map((end) => endText(end.setting, end.description)),
    endsParallel: part.endsParallel,
    marks: part.markLengths.map((mark) => ({ label: mark.label, value: formatLength(mark.value) })),
    notes: part.notes,
  }));
}

/**
 * A cut-list row as a plan shows it (#360): with each end's saw setting on its own, for a narrow
 * column. Stored rows lack it, so it is added on read from the stored parts' end cuts.
 */
export type PlannedCutRow = CutListRow & {
  /** Each end's saw setting, in the miter-saw convention (0.0° is square), in end order. */
  settings: string[];
};

/** The rows with each part's end settings, formatted by core; a part not found gets none. */
export function withSettings(
  rows: readonly CutListRow[],
  parts: readonly { id: string; ends: readonly { setting: number }[] }[],
): PlannedCutRow[] {
  return rows.map((row) => ({
    ...row,
    settings: parts.find((p) => p.id === row.partId)?.ends.map((e) => formatAngle(e.setting)) ?? [],
  }));
}

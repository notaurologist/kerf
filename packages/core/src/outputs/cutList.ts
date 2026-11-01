import { z } from 'zod';
import { isPanel, type PartStock } from '../lumber/panel.ts';
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
  if (!isPanel(stock)) return `${stock.nominal} (${size(stock)})`;
  return `${stock.boards === 1 ? 'Board' : 'Panel'} (${size(stock)})`;
}

function panelOf(stock: PartStock): CutListRow['panel'] {
  if (!isPanel(stock)) return undefined;
  const { board, boards } = stock;
  // A board stock named by its size, as the owner's often is, is not given it twice.
  const named = board.nominal === size(board) ? board.nominal : `${board.nominal} (${size(board)})`;
  const width = formatLength(stock.width);
  const boardLength = formatLength(stock.boardLength);
  const recipe =
    boards === 1
      ? `1 board of ${named}, ${boardLength} long, ripped to ${width}`
      : `${boards} boards of ${named}, each ${boardLength} long, glued to ${formatLength(stock.gluedWidth)} wide and ripped to ${width}`;
  return { width, boardLength, boards, recipe };
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
    length: formatLength(part.length),
    ends: part.ends.map((end) => endText(end.setting, end.description)),
    endsParallel: part.endsParallel,
    marks: part.markLengths.map((mark) => ({ label: mark.label, value: formatLength(mark.value) })),
    notes: part.notes,
  }));
}

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
   * finished size and the boards it is glued from.
   */
  stock: z.string(),
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

function stockText(stock: PartStock): string {
  const size = (s: { thickness: number; width: number }) =>
    `${formatLength(s.thickness)} x ${formatLength(s.width)}`;
  if (!isPanel(stock)) return `${stock.nominal} (${size(stock)})`;
  const { board, boards } = stock;
  const from =
    boards === 1
      ? `1 board of ${board.nominal} (${size(board)}), ${formatLength(stock.boardLength)} long, ripped to width`
      : `${boards} boards of ${board.nominal} (${size(board)}), each ${formatLength(stock.boardLength)} long, glued to ${formatLength(stock.gluedWidth)} wide`;
  return `Panel (${size(stock)}) from ${from}`;
}

export function cutList(parts: readonly Part[]): CutListRow[] {
  return parts.map((part) => ({
    partId: part.id,
    letter: part.letter,
    name: part.name,
    quantity: part.quantity,
    stock: stockText(part.stock),
    length: formatLength(part.length),
    ends: part.ends.map((end) => endText(end.setting, end.description)),
    endsParallel: part.endsParallel,
    marks: part.markLengths.map((mark) => ({ label: mark.label, value: formatLength(mark.value) })),
    notes: part.notes,
  }));
}

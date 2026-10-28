import type { Part } from '../templates/types.ts';
import { angleToEdge, formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';

// Cut list rows ready to display (PRODUCT.md, MVP feature 3). Every length and angle goes
// through the shared formatters, so the cut list rounds the same way as every other view.

export interface CutListRow {
  partId: string;
  name: string;
  quantity: number;
  /** Nominal name for buying, actual size for cutting: `4x4 (3-1/2" x 3-1/2")`. */
  stock: string;
  /** Overall length, long point to long point. */
  length: string;
  /** Each end: the saw setting and the angle to the board's edge, labeled (DOMAIN.md, Units). */
  ends: string[];
  /** True when both end cuts angle the same way (parallel); false when they mirror each other. */
  endsParallel: boolean;
  marks: { label: string; value: string }[];
  notes: string[];
}

function endText(setting: number, description: string): string {
  if (setting === 0) return description;
  return `${description}; saw at ${formatAngle(setting)}, ${formatAngle(angleToEdge(setting))} to the edge`;
}

export function cutList(parts: readonly Part[]): CutListRow[] {
  return parts.map((part) => ({
    partId: part.id,
    name: part.name,
    quantity: part.quantity,
    stock: `${part.stock.nominal} (${formatLength(part.stock.thickness)} x ${formatLength(part.stock.width)})`,
    length: formatLength(part.length),
    ends: part.ends.map((end) => endText(end.setting, end.description)),
    endsParallel: part.endsParallel,
    marks: part.markLengths.map((mark) => ({ label: mark.label, value: formatLength(mark.value) })),
    notes: part.notes,
  }));
}

// Laying a full-size drawing out across letter pages. Every length here is in inches, the unit a
// page's SVG uses, so a drawing in inches prints at full size when the page prints at 100%.

/** US letter, portrait, in inches. */
export const LETTER = { width: 8.5, height: 11 } as const;

/** Kept clear at every edge of the paper, wider than most printers' unprintable border. */
export const MARGIN = 0.5;

/** The band at the bottom of each page for its label, the scale checks, and the sheet map. */
export const FOOTER = 1.4;

export interface Size {
  width: number;
  height: number;
}

export interface Tiling {
  orientation: 'portrait' | 'landscape';
  /** The paper as it is printed. */
  page: Size;
  /** The part of each page the drawing is printed in, inside the margins and above the footer. */
  cell: Size;
  columns: number;
  rows: number;
  /**
   * Where the drawing's origin sits in the grid of cells: centered across one page, and against
   * the first page's edge when it spans pages, so notes written from the left stay on that page.
   */
  offset: { x: number; y: number };
}

/** The drawing area on a page of this size. */
export function cellOf(page: Size): Size {
  return { width: page.width - 2 * MARGIN, height: page.height - 2 * MARGIN - FOOTER };
}

function tileOn(drawing: Size, orientation: Tiling['orientation']): Tiling {
  const page =
    orientation === 'portrait' ? { ...LETTER } : { width: LETTER.height, height: LETTER.width };
  const cell = cellOf(page);
  const columns = Math.max(1, Math.ceil(drawing.width / cell.width - 1e-9));
  const rows = Math.max(1, Math.ceil(drawing.height / cell.height - 1e-9));
  return {
    orientation,
    page,
    cell,
    columns,
    rows,
    offset: {
      x: columns === 1 ? (cell.width - drawing.width) / 2 : 0,
      y: rows === 1 ? (cell.height - drawing.height) / 2 : 0,
    },
  };
}

/** The tiling with fewer pages, portrait when both need the same number. */
export function tile(drawing: Size): Tiling {
  const portrait = tileOn(drawing, 'portrait');
  const landscape = tileOn(drawing, 'landscape');
  const pages = (t: Tiling) => t.columns * t.rows;
  return pages(landscape) < pages(portrait) ? landscape : portrait;
}

/**
 * The page a point of the drawing prints on, by row and column from 0. A point on a trim line
 * belongs to the page before it.
 */
export function pageOf(tiling: Tiling, x: number, y: number): { row: number; column: number } {
  const gx = x + tiling.offset.x;
  const gy = y + tiling.offset.y;
  const clamp = (n: number, count: number) => Math.min(count - 1, Math.max(0, n));
  return {
    row: clamp(Math.ceil(gy / tiling.cell.height - 1e-9) - 1, tiling.rows),
    column: clamp(Math.ceil(gx / tiling.cell.width - 1e-9) - 1, tiling.columns),
  };
}

/**
 * Where the registration marks go, in the drawing's coordinates: on every trim line between two
 * pages, at each corner it shares with other pages and halfway along each page's edge. Each
 * page prints the half on its side, so butted pages make whole marks.
 */
export function registrationMarks(tiling: Tiling): { x: number; y: number }[] {
  const { cell, columns, rows, offset } = tiling;
  const marks: { x: number; y: number }[] = [];
  const add = (gx: number, gy: number) => marks.push({ x: gx - offset.x, y: gy - offset.y });
  for (let c = 1; c < columns; c++) {
    for (let r = 0; r < rows; r++) add(c * cell.width, (r + 0.5) * cell.height);
    for (let r = 1; r < rows; r++) add(c * cell.width, r * cell.height);
  }
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < columns; c++) add((c + 0.5) * cell.width, r * cell.height);
  }
  return marks;
}

import { formatLength } from '@kerf/core';
import type { Shape, Sheet } from './sheet.ts';
import { FOOTER, MARGIN, registrationMarks, type Tiling, tile } from './tile.ts';

// A sheet printed across letter pages. Each page is an SVG whose user unit is one inch: its
// width and height are given in inches and its viewBox spans the same numbers, so a line one
// unit long prints one inch long at 100%. Every page carries a check square and a scale bar to
// measure before cutting, since a printer set to fit the page shrinks it by a few percent.

/** The check square's side and the scale bar's length, in inches. */
export const CHECK_SQUARE = 1;
export const SCALE_BAR = 6;
/** A registration mark's circle radius and its cross's half-length. */
const MARK_RADIUS = 0.12;
const MARK_ARM = 0.22;

/** Lines thin enough to cut to, and thick enough to see. */
const CUT_LINE = 0.02;
const FINE_LINE = 0.01;

/** Where the footer's pieces sit, below the footer's top and right of the check square. */
const TITLE_Y = 0.2;
const SQUARE_Y = 0.32;
const BESIDE = CHECK_SQUARE + 0.25;
const INSTRUCTION_Y = [0.45, 0.6];
const BAR_Y = 0.78;
const MAP_Y = 1.1;

export interface PrintedSheet {
  title: string;
  orientation: Tiling['orientation'];
  /** One SVG per page, row by row. */
  pages: string[];
}

/** Coordinates written in full, so the page is exactly the drawing; -0 written as 0. */
const n = (x: number) => String(x + 0);

/** Text for an element's content; nothing here goes in an attribute. */
const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FINE = `stroke="#000" stroke-width="${n(FINE_LINE)}"`;

function text(x: number, y: number, size: number, body: string, attrs = ''): string {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}"${attrs}>${escapeText(body)}</text>`;
}

function line(x1: number, y1: number, x2: number, y2: number, attrs: string): string {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs}/>`;
}

function shape(s: Shape): string {
  if (s.kind === 'text') return text(s.at.x, s.at.y, s.size, s.text);
  const points = s.points.map((p) => `${n(p.x)},${n(p.y)}`).join(' ');
  return `<polygon class="cut" points="${points}" fill="none" stroke="#000" stroke-width="${n(CUT_LINE)}" stroke-linejoin="miter"/>`;
}

function mark(x: number, y: number): string {
  return [
    `<circle class="registration" cx="${n(x)}" cy="${n(y)}" r="${n(MARK_RADIUS)}" fill="none" ${FINE}/>`,
    line(x - MARK_ARM, y, x + MARK_ARM, y, FINE),
    line(x, y - MARK_ARM, x, y + MARK_ARM, FINE),
  ].join('');
}

/** The check square, with its size inside it. */
function checkSquare(x: number, y: number): string {
  return [
    `<rect class="check-square" x="${n(x)}" y="${n(y)}" width="${n(CHECK_SQUARE)}" height="${n(CHECK_SQUARE)}" fill="none" ${FINE}/>`,
    text(x + 0.08, y + 0.2, 0.12, formatLength(CHECK_SQUARE)),
  ].join('');
}

/** The scale bar, with a tick at each inch and its length under its far end. */
function scaleBar(x: number, y: number): string {
  const ticks = Array.from({ length: SCALE_BAR + 1 }, (_, i) =>
    line(x + i, y, x + i, y + 0.12, FINE),
  );
  return [
    `<line class="scale-bar" x1="${n(x)}" y1="${n(y)}" x2="${n(x + SCALE_BAR)}" y2="${n(y)}" ${FINE}/>`,
    ...ticks,
    text(x + SCALE_BAR - 0.2, y + 0.27, 0.12, formatLength(SCALE_BAR)),
  ].join('');
}

/** A small map of the sheet with this page filled in, and the page's place in words. */
function sheetMap(t: Tiling, row: number, column: number, x: number, y: number): string {
  const size = Math.min(0.25 / t.rows, 1.5 / t.columns, 0.2);
  const cells: string[] = [];
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.columns; c++) {
      const fill = r === row && c === column ? '#000' : 'none';
      cells.push(
        `<rect x="${n(x + c * size)}" y="${n(y + r * size)}" width="${n(size)}" height="${n(size)}" fill="${fill}" ${FINE}/>`,
      );
    }
  }
  const index = row * t.columns + column;
  const where = `Page ${index + 1} of ${t.rows * t.columns}: row ${row + 1} of ${t.rows}, column ${column + 1} of ${t.columns}`;
  return `<g class="sheet-map">${cells.join('')}</g>${text(x + t.columns * size + 0.15, y + 0.12, 0.12, where)}`;
}

/** The dashed trim lines on the edges this page shares with another. */
function trimLines(t: Tiling, row: number, column: number): string {
  const left = MARGIN;
  const top = MARGIN;
  const right = MARGIN + t.cell.width;
  const bottom = MARGIN + t.cell.height;
  const dashed = `class="trim" ${FINE} stroke-dasharray="0.08 0.06"`;
  return [
    column > 0 ? line(left, top, left, bottom, dashed) : '',
    column < t.columns - 1 ? line(right, top, right, bottom, dashed) : '',
    row > 0 ? line(left, top, right, top, dashed) : '',
    row < t.rows - 1 ? line(left, bottom, right, bottom, dashed) : '',
  ].join('');
}

/** The sheet across as many pages as it needs. */
export function printSheet(sheet: Sheet, tiling: Tiling = tile(sheet.size)): PrintedSheet {
  const { page, cell, columns, rows, offset } = tiling;
  const content = [
    ...sheet.shapes.map(shape),
    ...registrationMarks(tiling).map((m) => mark(m.x, m.y)),
  ].join('');
  const instructions = [
    'Print at actual size (100%), not fit to page. Measure the square and the bar before cutting.',
    ...(columns * rows > 1
      ? ['Trim on the dashed lines and butt the pages so the marks meet.']
      : []),
  ];
  const footerTop = page.height - MARGIN - FOOTER;
  const pages: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const id = `cell-${row * columns + column + 1}`;
      // The sheet moved so this page's cell sits inside the margins.
      const dx = MARGIN - column * cell.width + offset.x;
      const dy = MARGIN - row * cell.height + offset.y;
      const footer = [
        text(MARGIN, footerTop + TITLE_Y, 0.15, sheet.title, ' font-weight="bold"'),
        checkSquare(MARGIN, footerTop + SQUARE_Y),
        ...instructions.map((body, i) =>
          text(MARGIN + BESIDE, footerTop + (INSTRUCTION_Y[i] as number), 0.1, body),
        ),
        scaleBar(MARGIN + BESIDE, footerTop + BAR_Y),
        sheetMap(tiling, row, column, MARGIN + BESIDE, footerTop + MAP_Y),
      ].join('');
      pages.push(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${n(page.width)}in" height="${n(page.height)}in" viewBox="0 0 ${n(page.width)} ${n(page.height)}" font-family="sans-serif">`,
          `<defs><clipPath id="${id}"><rect x="${n(MARGIN)}" y="${n(MARGIN)}" width="${n(cell.width)}" height="${n(cell.height)}"/></clipPath></defs>`,
          `<g clip-path="url(#${id})"><g transform="translate(${n(dx)} ${n(dy)})">${content}</g></g>`,
          trimLines(tiling, row, column),
          footer,
          '</svg>',
        ].join(''),
      );
    }
  }
  return { title: sheet.title, orientation: tiling.orientation, pages };
}

/**
 * Sheets as one HTML file that prints each page on its own sheet of letter paper, turned for
 * the sheets laid out landscape. Clip-path IDs are numbered across the file so pages never share
 * one.
 */
export function printDocument(title: string, sheets: readonly PrintedSheet[]): string {
  let next = 0;
  const pages = sheets.flatMap((sheet) =>
    sheet.pages.map((svg) => {
      const id = `p${++next}`;
      const unique = svg.replace(/cell-(\d+)/g, `${id}-cell-$1`);
      return `<div class="page ${sheet.orientation}">${unique}</div>`;
    }),
  );
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeText(title)}</title>`,
    '<style>',
    '@page { size: letter portrait; margin: 0; }',
    '@page landscape { size: letter landscape; margin: 0; }',
    'html, body { margin: 0; padding: 0; background: #fff; }',
    '.page { break-after: page; }',
    '.page:last-child { break-after: auto; }',
    '.page.landscape { page: landscape; }',
    '.page svg { display: block; }',
    '@media screen { body { background: #ddd; } .page { width: fit-content; margin: 0.25in auto; background: #fff; } }',
    '</style>',
    '</head>',
    '<body>',
    ...pages,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

import { cutList, type Part } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { exampleParts } from './parts.ts';
import { CHECK_SQUARE, printDocument, printSheet, SCALE_BAR } from './print.ts';
import { NOTE_LINE, PAD, partSheet, type Sheet } from './sheet.ts';
import { cellOf, FOOTER, LETTER, MARGIN, pageOf, registrationMarks, tile } from './tile.ts';

const RAD = Math.PI / 180;

/** A blank sheet of a given size, for layout tests that need no part. */
const blank = (width: number, height: number): Sheet => ({
  title: 'Blank',
  size: { width, height },
  shapes: [],
});

/** Attribute values of every element with this tag (and class, if given) in an SVG. */
function elements(svg: string, tag: string, cls?: string): Record<string, string>[] {
  const found: Record<string, string>[] = [];
  for (const m of svg.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))) {
    const attrs: Record<string, string> = {};
    for (const a of (m[1] ?? '').matchAll(/([\w-]+)="([^"]*)"/g))
      attrs[a[1] as string] = a[2] ?? '';
    if (!cls || attrs.class === cls) found.push(attrs);
  }
  return found;
}

const num = (s: string | undefined) => Number(s);

/** How many inches one SVG user unit prints as. */
function inchesPerUnit(svg: string): { x: number; y: number } {
  const root = elements(svg, 'svg')[0] as Record<string, string>;
  const [, , vbWidth, vbHeight] = (root.viewBox ?? '').split(' ').map(Number);
  expect(root.width).toMatch(/^[\d.]+in$/);
  expect(root.height).toMatch(/^[\d.]+in$/);
  return {
    x: Number.parseFloat(root.width as string) / (vbWidth as number),
    y: Number.parseFloat(root.height as string) / (vbHeight as number),
  };
}

describe('page units', () => {
  it('gives each page in inches with a viewBox of the same numbers, so one unit prints one inch', () => {
    const [page] = printSheet(blank(5, 5)).pages;
    expect(page).toContain('width="8.5in" height="11in" viewBox="0 0 8.5 11"');
    expect(inchesPerUnit(page as string)).toEqual({ x: 1, y: 1 });
  });

  it('turns a landscape page and keeps one unit to the inch', () => {
    const printed = printSheet(blank(19, 5));
    expect(printed.orientation).toBe('landscape');
    expect(printed.pages[0]).toContain('width="11in" height="8.5in" viewBox="0 0 11 8.5"');
    expect(inchesPerUnit(printed.pages[0] as string)).toEqual({ x: 1, y: 1 });
  });

  it('prints a 1" check square and a 6" scale bar on every page', () => {
    expect(CHECK_SQUARE).toBe(1);
    expect(SCALE_BAR).toBe(6);
    const { pages } = printSheet(blank(30, 30));
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const unit = inchesPerUnit(page);
      const [square] = elements(page, 'rect', 'check-square');
      expect(num(square?.width) * unit.x).toBe(1);
      expect(num(square?.height) * unit.y).toBe(1);
      const [bar] = elements(page, 'line', 'scale-bar');
      expect((num(bar?.x2) - num(bar?.x1)) * unit.x).toBe(6);
      expect(page).toContain('>1"</text>');
      expect(page).toContain('>6"</text>');
    }
  });

  it('keeps the footer inside the margins', () => {
    for (const sheet of [blank(5, 5), blank(19, 5)]) {
      const { pages } = printSheet(sheet);
      const page = pages[0] as string;
      const root = elements(page, 'svg')[0] as Record<string, string>;
      const width = Number.parseFloat(root.width as string);
      const height = Number.parseFloat(root.height as string);
      const [bar] = elements(page, 'line', 'scale-bar');
      expect(num(bar?.x2)).toBeLessThanOrEqual(width - MARGIN);
      const [square] = elements(page, 'rect', 'check-square');
      expect(num(square?.y) + num(square?.height)).toBeLessThanOrEqual(height - MARGIN);
      for (const t of elements(page, 'text')) expect(num(t.y)).toBeLessThanOrEqual(height - MARGIN);
    }
  });
});

describe('tiling', () => {
  // A portrait cell is 8-1/2 less two 1/2" margins wide, 7-1/2"; and 11 less the margins and the
  // 1.4" footer tall, 8.6". A landscape cell is 10" by 6.1".
  it('has the cells worked out by hand', () => {
    expect(cellOf(LETTER)).toEqual({ width: 7.5, height: 11 - 1 - FOOTER });
    expect(FOOTER).toBe(1.4);
    expect(cellOf({ width: 11, height: 8.5 }).width).toBe(10);
    expect(cellOf({ width: 11, height: 8.5 }).height).toBeCloseTo(6.1, 12);
  });

  it('puts a drawing that fits one cell on one page, centered', () => {
    const t = tile({ width: 5, height: 5 });
    expect([t.orientation, t.columns, t.rows]).toEqual(['portrait', 1, 1]);
    expect(t.offset.x).toBeCloseTo(1.25, 12);
    expect(t.offset.y).toBeCloseTo(1.8, 12);
  });

  it('puts a long drawing in a row: 20-1/2" by 8" is 3 portrait pages, against 6 landscape', () => {
    const t = tile({ width: 20.5, height: 8 });
    expect([t.orientation, t.columns, t.rows]).toEqual(['portrait', 3, 1]);
  });

  it('turns to landscape when that takes fewer pages: 19" by 5" is 2 landscape, 3 portrait', () => {
    const t = tile({ width: 19, height: 5 });
    expect([t.orientation, t.columns, t.rows]).toEqual(['landscape', 2, 1]);
  });

  it('puts a large drawing in a grid: 30" by 25" is 4 by 3 portrait, against 3 by 5 landscape', () => {
    const t = tile({ width: 30, height: 25 });
    expect([t.orientation, t.columns, t.rows]).toEqual(['portrait', 4, 3]);
    expect(printSheet(blank(30, 25)).pages).toHaveLength(12);
  });

  it('does not add a page for a drawing exactly as wide as its cells', () => {
    expect(tile({ width: 15, height: 8.6 }).columns).toBe(2);
  });

  it('puts every point of a drawing inside the cell of the page it prints on', () => {
    for (const size of [
      { width: 5, height: 5 },
      { width: 20.5, height: 8 },
      { width: 30, height: 25 },
    ]) {
      const t = tile(size);
      expect(t.offset.x).toBeGreaterThanOrEqual(0);
      expect(t.offset.y).toBeGreaterThanOrEqual(0);
      for (let x = 0; x <= size.width; x += size.width / 37) {
        for (let y = 0; y <= size.height; y += size.height / 41) {
          const { row, column } = pageOf(t, x, y);
          const gx = x + t.offset.x;
          const gy = y + t.offset.y;
          expect(gx).toBeGreaterThanOrEqual(column * t.cell.width - 1e-9);
          expect(gx).toBeLessThanOrEqual((column + 1) * t.cell.width + 1e-9);
          expect(gy).toBeGreaterThanOrEqual(row * t.cell.height - 1e-9);
          expect(gy).toBeLessThanOrEqual((row + 1) * t.cell.height + 1e-9);
        }
      }
    }
  });

  it('puts registration marks on the trim lines only: none on one page', () => {
    expect(registrationMarks(tile({ width: 5, height: 5 }))).toEqual([]);
  });

  it('puts a mark halfway along each join in a row', () => {
    const t = tile({ width: 20.5, height: 8 });
    const marks = registrationMarks(t);
    expect(marks).toHaveLength(2);
    for (const [i, m] of marks.entries()) {
      expect(m.x + t.offset.x).toBeCloseTo((i + 1) * 7.5, 12);
      expect(m.y + t.offset.y).toBeCloseTo(4.3, 12);
    }
  });

  it('puts marks at each shared corner and halfway along each join in a grid', () => {
    // 2 by 2: the vertical join has two halves and the middle corner, the horizontal join two
    // halves; the middle corner is counted once.
    const t = tile({ width: 14, height: 16 });
    expect([t.columns, t.rows]).toEqual([2, 2]);
    const marks = registrationMarks(t).map((m) => [m.x + t.offset.x, m.y + t.offset.y]);
    expect(marks).toHaveLength(5);
    const at = (x: number, y: number) =>
      marks.some(
        ([mx, my]) => Math.abs((mx as number) - x) < 1e-9 && Math.abs((my as number) - y) < 1e-9,
      );
    expect(at(7.5, 4.3)).toBe(true);
    expect(at(7.5, 12.9)).toBe(true);
    expect(at(7.5, 8.6)).toBe(true);
    expect(at(3.75, 8.6)).toBe(true);
    expect(at(11.25, 8.6)).toBe(true);
  });

  it('draws trim lines only on the edges a page shares', () => {
    const { pages } = printSheet(blank(20.5, 8));
    const trims = pages.map((p) => elements(p, 'line', 'trim').length);
    expect(trims).toEqual([1, 2, 1]);
    expect(elements(printSheet(blank(5, 5)).pages[0] as string, 'line', 'trim')).toEqual([]);
  });
});

describe('a gusset, worked by hand', () => {
  const example = exampleParts('swing-set-a-frame').find((p) => p.name === 'Gusset') as Part;
  // A 20-inch gusset from a 2x8, both ends cut at 20 degrees toward each other (a trapezoid).
  const gusset: Part = { ...example, length: 20 };

  it('starts from the worked example', () => {
    expect(example.stock.width).toBe(7.25);
    expect(example.ends.map((e) => e.setting)).toEqual([20, 20]);
    expect(example.endsParallel).toBe(false);
  });

  it('draws the outline full size: far edge L − 2·W·tan 20° = 14.72243"', () => {
    // tan 20° = 0.3639702; 7.25 × 0.3639702 = 2.638784 at each end; 20 − 5.277568 = 14.722432.
    const sheet = partSheet(gusset);
    const outline = sheet.shapes.find((s) => s.kind === 'outline');
    if (outline?.kind !== 'outline') throw new Error('no outline');
    const xs = outline.points.map((p) => p.x);
    const ys = outline.points.map((p) => p.y);
    const bottom = PAD + 7.25;
    const along = (y: number) =>
      outline.points.filter((p) => Math.abs(p.y - y) < 1e-9).map((p) => p.x);
    const [b0, b1] = along(bottom).sort((a, b) => a - b) as [number, number];
    const [t0, t1] = along(PAD).sort((a, b) => a - b) as [number, number];
    expect(b1 - b0).toBeCloseTo(20, 12);
    expect(t1 - t0).toBeCloseTo(14.722432, 6);
    expect(t0 - b0).toBeCloseTo(2.638784, 6);
    expect(Math.min(...xs)).toBeCloseTo(PAD, 12);
    expect(Math.min(...ys)).toBeCloseTo(PAD, 12);
    expect(7.25 * Math.tan(20 * RAD)).toBeCloseTo(2.638784, 6);
  });

  it('writes the ends and edges from core, rounded only there', () => {
    const sheet = partSheet(gusset);
    const notes = sheet.shapes.flatMap((s) => (s.kind === 'text' ? [s.text] : []));
    const [row] = cutList([gusset]);
    // The two ends are cut alike, so they share a note.
    expect(row?.ends[0]).toBe(row?.ends[1]);
    expect(notes).toContain(`Both ends: ${row?.ends[0]}`);
    expect(notes.join(' ')).toContain('saw at 20.0°, 70.0° to the edge');
    // 14.722432" is 235.56 sixteenths, so 14-3/4".
    const edges = notes.find((n) => n.startsWith('Bottom:'));
    expect(edges).toContain('the reference edge (bottom edge), 20"');
    expect(edges).toContain('the far edge, 14-3/4"');
  });

  it('takes 3 portrait pages, worked by hand', () => {
    // Width: the 20" outline and 1/4" either side, 20-1/2". Height: 1/4" + 7-1/4" + 1/4" to the
    // notes, then three 0.24" lines (both ends, the edges, the four bolt holes): 8.47". Portrait cells are 7-1/2" by 8.6": 3 by 1. Landscape
    // cells are 10" by 6.1": 3 by 2.
    const sheet = partSheet(gusset);
    expect(sheet.size.width).toBeCloseTo(20.5, 12);
    expect(sheet.size.height).toBeCloseTo(PAD + 7.25 + PAD + 3 * NOTE_LINE, 12);
    expect(sheet.size.height).toBeCloseTo(8.47, 12);
    const printed = printSheet(sheet);
    expect(printed.orientation).toBe('portrait');
    expect(printed.pages).toHaveLength(3);
    expect(printed.pages[1]).toContain('Page 2 of 3: row 1 of 1, column 2 of 3');
    expect(printed.pages[0]).toContain('E · Gusset · 2x8 (1-1/2" x 7-1/4") · make 2');
  });

  it('prints the worked example’s own gusset on 3 pages', () => {
    expect(printSheet(partSheet(example)).pages).toHaveLength(3);
  });
});

describe('the printable file', () => {
  it('gives every page its own clip path and turns landscape sheets', () => {
    const html = printDocument('Test', [printSheet(blank(20.5, 8)), printSheet(blank(19, 5))]);
    const ids = [...html.matchAll(/clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    for (const id of ids) expect(html).toContain(`url(#${id})`);
    expect(html.match(/class="page landscape"/g)).toHaveLength(2);
    expect(html).toContain('@page landscape { size: letter landscape; margin: 0; }');
  });

  it('escapes text', () => {
    const sheet: Sheet = {
      title: 'A & B <C>',
      size: { width: 1, height: 1 },
      shapes: [{ kind: 'text', at: { x: 0, y: 0 }, text: '"x"', size: 0.1 }],
    };
    const [page] = printSheet(sheet).pages;
    expect(page).toContain('A &amp; B &lt;C&gt;');
    expect(page).toContain('>"x"</text>');
  });
});

import {
  cutList,
  type PlannedCutRow,
  panelStock,
  stock,
  stripGlueUp,
  withSettings,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { render, renderText, textOf } from '../../test/render.tsx';
import { CutList } from './CutList.tsx';

// A made-up panel next to a post: the panel's stock stays short and its boards go in the notes
// (#305). Core's outputs.test.ts works the panel's numbers.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const made = panelStock({
  thickness: 0.75,
  width: 15,
  length: 19.4375,
  board: { nominal: '1x6 cherry', thickness: 0.75, width: 5.5, buyableFeet: [8] },
  allowances: { jointPerEdge: 1 / 16, rip: 0.5, trimPerEnd: 1, flatten: 0 },
});
if (!made.ok) throw new Error(made.issue.message);
const part = {
  id: 'side',
  letter: 'A',
  name: 'Side',
  role: 'side',
  stock: made.stock,
  quantity: 2,
  length: 19.4375,
  markLengths: [],
  ends: [square, square] as [typeof square, typeof square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'back edge',
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [],
  cutouts: [],
  mortises: [],
  tenons: [],
  dovetails: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles: [],
};
const parts = [
  part,
  { ...part, id: 'post', letter: 'B', name: 'Post', stock: stock('4x4'), length: 30 },
];
const rows: PlannedCutRow[] = withSettings(cutList(parts), parts);

describe('the cut list with a panel', () => {
  const text = renderText(<CutList rows={rows} />);

  it("shows a panel's finished size as its stock, and its boards in the notes", () => {
    expect(text).toContain('Panel (3/4" x 15")');
    expect(text).toContain(
      'Glued up from 3 boards of 1x6 cherry (3/4" x 5-1/2"), each 21-7/16" long, glued to 16-1/4" wide and ripped to 15".',
    );
  });

  it('leaves other parts as they were', () => {
    expect(text).toContain('4x4 (3-1/2" x 3-1/2")');
    expect(text.match(/Glued up from/g)).toHaveLength(1);
  });
});

describe('the cut list with a strip glue-up', () => {
  // Core's lumber/strips.test.ts works the numbers.
  const top = stripGlueUp({
    thickness: 2.5,
    width: 17.625,
    length: 61.875,
    stackedAcross: 'width',
    board: { nominal: '1x6 cherry', thickness: 0.75, width: 5.5, buyableFeet: [6] },
    allowances: { rip: 0.5, trimPerEnd: 1, flatten: 1 / 16 },
    kerf: 0.125,
  });
  if (!top.ok) throw new Error(top.issue.message);
  const glued = [{ ...part, id: 'top', name: 'Top', stock: top.stock, length: 61.875 }];
  const text = renderText(<CutList rows={withSettings(cutList(glued), glued)} />);

  it("shows a glue-up's finished size as its stock, and its strips in the notes", () => {
    expect(text).toContain('Glue-up (2-1/2" x 17-5/8")');
    expect(text).toContain(
      'Glued up from 25 strips of 1x6 cherry (3/4" x 5-1/2"), each 2-9/16" wide and 63-7/8" long, 2 ripped from each board, glued face to face to 18-3/4" and ripped to 17-5/8", then flattened to 2-1/2".',
    );
  });
});

describe('the cut list as a narrow table (#360)', () => {
  const html = render(<CutList rows={rows} />);

  it('keeps four columns: part, quantity, length, and each end’s saw setting', () => {
    expect(
      [...html.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map((m) => textOf(m[1] ?? '')),
    ).toEqual(['Part', 'Qty Quantity', 'Length', 'Ends Saw setting at each end']);
    expect(html).toContain('data-keep=""');
    expect(html).toContain('<span class="k-setting">0.0°</span>');
  });

  it('is as wide as its columns, so a name stays near its numbers on a wide screen', () => {
    expect(html).toMatch(/<table class="k-table" data-keep="" data-narrow="">/);
  });

  it("sets each part's letter before its name and stock, apart from the link", () => {
    const linked = render(<CutList rows={rows} partHref={(id) => `#/drawings/${id}`} />);
    expect(linked).toContain(
      '<div class="k-table__lead"><span class="k-part-letter">A</span><div><a id="cut-list-part-side" href="#/drawings/side"><b>Side</b></a>',
    );
  });

  it('opens each row to its details beneath, closed at first and open in print', () => {
    expect(html.match(/<tr id="[^"]+" data-details="" hidden="">/g)).toHaveLength(2);
    expect(html).toContain('aria-expanded="false"');
    expect(textOf(html)).toContain('Details for A Side');
    expect(textOf(html)).toContain('Ends parallel.');
  });
});

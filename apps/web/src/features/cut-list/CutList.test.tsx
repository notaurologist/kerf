import { type CutListRow, cutList, panelStock, stock } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { renderText } from '../../test/render.tsx';
import { CutList } from './CutList.tsx';

// A made-up panel next to a post: the panel's stock stays short and its boards go in the notes
// (#305). Core's outputs.test.ts works the panel's numbers.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const made = panelStock({
  thickness: 0.75,
  width: 15,
  length: 19.4375,
  board: { nominal: '1x6 cherry', thickness: 0.75, width: 5.5, buyableFeet: [8] },
  allowances: { jointPerEdge: 1 / 16, rip: 0.5, trimPerEnd: 1 },
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
};
const rows: CutListRow[] = cutList([
  part,
  { ...part, id: 'post', letter: 'B', name: 'Post', stock: stock('4x4'), length: 30 },
]);

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

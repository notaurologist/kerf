import { describe, expect, it } from 'vitest';
import { type BoardStock, panelStock } from '../lumber/panel.ts';
import { stock } from '../lumber/stock.ts';
import type { HardwareItem, Part } from '../model/types.ts';
import { cutList } from './cutList.ts';
import { hardwareList } from './hardwareList.ts';
import { planLumber } from './shoppingList.ts';

// Generic outputs, tested on made-up parts. Each template tests its own output through these
// in its own folder.

describe('cutList', () => {
  const part: Part = {
    id: 'rail',
    letter: 'A',
    name: 'Rail',
    role: 'crossbar',
    stock: stock('2x4'),
    quantity: 3,
    length: 30.03,
    markLengths: [{ label: 'Short edge', value: 27.4 }],
    ends: [
      { setting: 0, description: 'Square', measuredFrom: 'reference-edge' },
      { setting: 15, description: 'Miter', measuredFrom: 'reference-edge' },
    ],
    endsParallel: false,
    notes: ['A note'],
    selection: [],
    referenceEdge: 'reference edge',
    holes: [],
    boltAreas: [],
    tapers: [],
    dadoes: [],
    notches: [],
    cutouts: [],
  };

  it('formats stock, length, ends, and marks', () => {
    expect(cutList([part])).toEqual([
      {
        partId: 'rail',
        letter: 'A',
        name: 'Rail',
        quantity: 3,
        stock: '2x4 (1-1/2" x 3-1/2")',
        length: '30"',
        ends: ['Square', 'Miter; saw at 15.0°, 75.0° to the edge'],
        endsParallel: false,
        marks: [{ label: 'Short edge', value: '27-3/8"' }],
        notes: ['A note'],
      },
    ]);
  });
});

describe('planLumber, edge cases', () => {
  const piece = (length: number, quantity = 1): Part => ({
    id: 'test',
    letter: 'A',
    name: 'Test piece',
    role: 'leg',
    stock: stock('2x4'),
    quantity,
    length,
    markLengths: [],
    ends: [
      { setting: 0, description: 'Square', measuredFrom: 'reference-edge' },
      { setting: 0, description: 'Square', measuredFrom: 'reference-edge' },
    ],
    endsParallel: true,
    notes: [],
    selection: [],
    referenceEdge: 'reference edge',
    holes: [],
    boltAreas: [],
    tapers: [],
    dadoes: [],
    notches: [],
    cutouts: [],
  });

  it('reports a part longer than any board instead of dropping it', () => {
    const plan = planLumber([piece(200)]);
    expect(plan.boards).toEqual([]);
    expect(plan.issues.map((i) => i.code)).toEqual(['part-longer-than-any-board']);
  });

  it('charges kerf and trim, so a piece exactly a board long needs the next size', () => {
    expect(planLumber([piece(96)]).lines).toEqual([{ nominal: '2x4', feet: 10, count: 1 }]);
    expect(planLumber([piece(94.875)]).lines).toEqual([{ nominal: '2x4', feet: 8, count: 1 }]);
  });

  it('uses the given kerf, trim, and lengths', () => {
    const plan = planLumber([piece(30, 3)], { kerf: 0, trimPerEnd: 0, buyableFeet: [6, 8] });
    expect(plan.lines).toEqual([{ nominal: '2x4', feet: 8, count: 1 }]);
    expect(plan.boards[0]?.offcut).toBe(6);
  });
});

describe('panels', () => {
  const cherry: BoardStock = {
    nominal: '1x6 cherry',
    thickness: 0.75,
    width: 5.5,
    buyableFeet: [4, 6, 8],
  };
  const allowances = { jointPerEdge: 1 / 16, rip: 0.5, trimPerEnd: 1, flatten: 0 };
  const panel = (id: string, width: number, quantity: number, board = cherry): Part => {
    const made = panelStock({ thickness: 0.75, width, length: 19.4375, board, allowances });
    if (!made.ok) throw new Error(made.issue.message);
    return {
      id,
      letter: 'A',
      name: 'Side',
      role: 'side',
      stock: made.stock,
      quantity,
      length: 19.4375,
      markLengths: [],
      ends: [
        { setting: 0, description: 'Square', measuredFrom: 'reference-edge' },
        { setting: 0, description: 'Square', measuredFrom: 'reference-edge' },
      ],
      endsParallel: true,
      notes: [],
      selection: [],
      referenceEdge: 'front edge',
      holes: [],
      boltAreas: [],
      tapers: [],
      dadoes: [],
      notches: [],
      cutouts: [],
    };
  };

  it('lists a panel with its finished size and the boards it is glued from', () => {
    // panel.test.ts works these: 3 boards, each 21-7/16" long, glued to 16-1/4".
    const [side] = cutList([panel('side', 15, 2)]);
    expect(side?.stock).toBe('Panel (3/4" x 15")');
    expect(side?.panel).toEqual({
      width: '15"',
      boardLength: '21-7/16"',
      recipe:
        '3 boards of 1x6 cherry (3/4" x 5-1/2"), each 21-7/16" long, glued to 16-1/4" wide and ripped to 15"',
    });
    expect(cutList([panel('rail', 3, 1)])[0]?.panel?.recipe).toBe(
      '1 board of 1x6 cherry (3/4" x 5-1/2"), 21-7/16" long, ripped to 3"',
    );
    // Dimension lumber has none, so stored cut lists read as before.
    expect(cutList([{ ...panel('post', 15, 1), stock: stock('2x4') }])[0]).not.toHaveProperty(
      'panel',
    );
  });

  it("plans each panel's boards as pieces of its board stock, in the lengths that stock is sold", () => {
    // Two panels of 3 boards: six pieces of 21-7/16". With 1/8" kerf and 1/2" trim at each end, a
    // board holds k pieces when 1 + 21.5625k fits. Four take 87.25", so they fit an 8' board (96")
    // and leave 8.75; five would take 108.8125". The other two take 44.125", which fits a 4' board
    // (48") and leaves 3.875.
    const plan = planLumber([panel('side', 15, 2)]);
    expect(plan.lines).toEqual([
      { nominal: '1x6 cherry', feet: 8, count: 1 },
      { nominal: '1x6 cherry', feet: 4, count: 1 },
    ]);
    expect(plan.boards.map((b) => [b.pieces.length, b.offcut])).toEqual([
      [4, 8.75],
      [2, 3.875],
    ]);
    expect(plan.boards[0]?.pieces[0]).toEqual({
      partId: 'side',
      name: 'Side board',
      length: 21.4375,
    });
  });

  it('plans dimension lumber and board stock separately', () => {
    const post = { ...panel('post', 15, 1), id: 'post', stock: stock('2x4'), length: 30 };
    const plan = planLumber([post, panel('side', 15, 1)]);
    expect(plan.lines).toEqual([
      { nominal: '2x4', feet: 8, count: 1 },
      { nominal: '1x6 cherry', feet: 6, count: 1 },
    ]);
  });

  it('refuses two different stocks with the same name', () => {
    const wider = { ...cherry, width: 7.25 };
    const plan = planLumber([panel('side', 15, 1), panel('top', 15, 1, wider)]);
    expect(plan.issues.map((i) => i.code)).toEqual(['stock-name-reused']);
  });
});

describe('hardwareList', () => {
  const bolt = (
    id: string,
    quantity: number,
    diameter: number,
    grip: number,
    fittings: Partial<NonNullable<HardwareItem['bolt']>> = {},
  ): HardwareItem => ({
    id,
    name: id,
    quantity,
    bolt: { diameter, grip, washers: 2, nut: 'standard', cap: false, ...fittings },
    structural: true,
    notes: [],
    group: 'Bolts',
  });

  it('groups bolts by diameter and displayed grip', () => {
    const lines = hardwareList([
      bolt('a', 2, 0.5, 5),
      bolt('b', 3, 0.5, 5.01), // displays as 5", so it shares a line
      bolt('c', 1, 0.5, 6),
    ]);
    expect(lines.slice(0, 2)).toEqual([
      { description: '1/2" through-bolt, grip 5"', quantity: 5, group: 'Bolts' },
      { description: '1/2" through-bolt, grip 6"', quantity: 1, group: 'Bolts' },
    ]);
  });

  it('totals only the fittings each bolt calls for', () => {
    const lines = hardwareList([
      bolt('a', 2, 0.5, 5, { washers: 1, nut: 'locking', cap: true }),
      bolt('b', 3, 0.5, 6),
      bolt('c', 1, 0.375, 4, { washers: 0 }),
    ]);
    expect(lines.slice(3)).toEqual([
      { description: '3/8" nuts', quantity: 1, group: 'Bolts' },
      { description: '1/2" flat washers', quantity: 8, group: 'Bolts' },
      { description: '1/2" locking nuts', quantity: 2, group: 'Bolts' },
      { description: '1/2" nuts', quantity: 3, group: 'Bolts' },
      { description: '1/2" bolt caps', quantity: 2, group: 'Bolts' },
    ]);
  });

  it('lists other items by name after the bolts and fittings', () => {
    const lines = hardwareList([
      { id: 'x', name: 'Hinge', quantity: 2, structural: false, notes: [], group: 'Other' },
      bolt('a', 1, 0.5, 5),
    ]);
    expect(lines.at(-1)).toEqual({ description: 'Hinge', quantity: 2, group: 'Other' });
  });
});

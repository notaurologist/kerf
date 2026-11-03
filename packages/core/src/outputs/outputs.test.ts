import { describe, expect, it } from 'vitest';
import { type BoardStock, PartStock, panelStock } from '../lumber/panel.ts';
import { stock } from '../lumber/stock.ts';
import type { HardwareItem, Part } from '../model/types.ts';
import { cutList, endName, panelMade } from './cutList.ts';
import { hardwareList } from './hardwareList.ts';
import { planLumber } from './shoppingList.ts';

// Generic outputs, tested on made-up parts. Each template tests its own output through these
// in its own folder.

describe('endName', () => {
  it('reads the name a template gives an end before its colon, and none without one', () => {
    expect(endName('Top: level cut')).toBe('Top');
    expect(endName('1-1/2" past the leg, parallel to it')).toBeUndefined();
    expect(endName('Square')).toBeUndefined();
  });
});

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
    mortises: [],
    tenons: [],
    screwHoles: [],
    grooves: [],
    rabbets: [],
    recesses: [],
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
    mortises: [],
    tenons: [],
    screwHoles: [],
    grooves: [],
    rabbets: [],
    recesses: [],
  });

  it('reports a part longer than any board instead of dropping it', () => {
    const plan = planLumber([piece(200)]);
    expect(plan.boards).toEqual([]);
    expect(plan.issues.map((i) => i.code)).toEqual(['part-longer-than-any-board']);
  });

  it('charges kerf and trim, so a piece exactly a board long needs the next size', () => {
    expect(planLumber([piece(96)]).lines).toMatchObject([{ nominal: '2x4', feet: 10, count: 1 }]);
    expect(planLumber([piece(94.875)]).lines).toMatchObject([
      { nominal: '2x4', feet: 8, count: 1 },
    ]);
  });

  // Two 40" pieces need 1 + 2 x 40.125 = 81.25 on an 8'; a 6' (72) misses by 9.25, more than the
  // 1-1/8" of trim and kerf, so no measured board, but each piece alone needs 41.125, so two 6's.
  // A piece of 70 needs 71.125, under 72, so it is planned on a 6' and needs no other length;
  // one of 72 needs 73.125 and misses a 6' by 1.125, so a 6' that measures 73-1/8" holds it.
  it('says what else holds a line when the store has none of its boards (#450)', () => {
    const options = { kerf: 0.125, trimPerEnd: 0.5, buyableFeet: [6, 8] };
    expect(planLumber([piece(40, 2)], options).lines[0]?.alternatives).toEqual([
      { kind: 'lengths', boards: [{ feet: 6, count: 2 }] },
    ]);
    expect(planLumber([piece(70)], options).lines[0]?.alternatives).toEqual([
      { kind: 'lengths', boards: [{ feet: 8, count: 1 }] },
    ]);
    const long = planLumber([piece(72)], options);
    expect(long.lines[0]?.alternatives).toEqual([
      { kind: 'measured', feet: 6, count: 1, atLeast: 73.125 },
    ]);
    expect(long.lines[0]?.notes).toEqual([
      `Test piece: listed as 8' to leave room for trimming the ends. A 6' board works if it measures at least 73-1/8".`,
    ]);
  });

  it('uses the given kerf, trim, and lengths', () => {
    const plan = planLumber([piece(30, 3)], { kerf: 0, trimPerEnd: 0, buyableFeet: [6, 8] });
    expect(plan.lines).toMatchObject([{ nominal: '2x4', feet: 8, count: 1 }]);
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
      mortises: [],
      tenons: [],
      screwHoles: [],
      grooves: [],
      rabbets: [],
      recesses: [],
    };
  };

  it("plans dealer hardwood by the board foot, with each board's least width", () => {
    // 4/4 cherry, 13/16" surfaced, planned 6" wide with 20% waste. n = ⌈(15 + 1/2 − 1/8) /
    // (6 − 1/8)⌉ = ⌈2.617⌉ = 3, each at least (15 + 1/2 + 2 · 1/16 · 2) / 3 = 5-1/4" wide. The
    // three 21-7/16" boards use 2 · 1/2 trim + 3 · (21-7/16 + 1/8) = 65-11/16", so one 6' board:
    // 1 × 6/12 × 6 = 3 board feet, 3.6 with the waste.
    const dealer: BoardStock = {
      nominal: '4/4 cherry',
      thickness: 0.8125,
      width: 6,
      buyableFeet: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      byBoardFoot: { nominalThickness: 1, waste: 0.2 },
    };
    const side = panel('side', 15, 1, dealer);
    expect(side.stock).toMatchObject({ boards: 3, minBoardWidth: 5.25 });
    expect(cutList([side])[0]?.panel?.recipe).toBe(
      '3 boards of 4/4 cherry (13/16" thick), each at least 5-1/4" wide and 21-7/16" long, glued up and ripped to 15"',
    );
    const plan = planLumber([side]);
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]).toMatchObject({ nominal: '4/4 cherry', feet: 6, count: 1 });
    expect(plan.lines[0]?.boardFeet).toBeCloseTo(3.6, 12);
    expect(plan.notes).toContain(
      '4/4 cherry is sold by the board foot in random widths. The boards are planned 6" wide, with 20% more board feet for defects and offcuts; wider boards need fewer.',
    );
    // Store boards have no board feet.
    expect(planLumber([panel('side', 15, 1)]).lines[0]).not.toHaveProperty('boardFeet');
  });

  it('lists a panel with its finished size and the boards it is glued from', () => {
    // panel.test.ts works these: 3 boards, each 21-7/16" long, glued to 16-1/4".
    const [side] = cutList([panel('side', 15, 2)]);
    expect(side?.stock).toBe('Panel (3/4" x 15")');
    expect(side?.panel).toEqual({
      width: '15"',
      boardLength: '21-7/16"',
      boards: 3,
      recipe:
        '3 boards of 1x6 cherry (3/4" x 5-1/2"), each 21-7/16" long, glued to 16-1/4" wide and ripped to 15"',
    });
    const [rail] = cutList([panel('rail', 3, 1)]);
    expect(rail?.stock).toBe('Board (3/4" x 3")');
    expect(rail?.panel?.recipe).toBe(
      '1 board of 1x6 cherry (3/4" x 5-1/2"), 21-7/16" long, ripped to 3"',
    );
    expect(side?.panel && panelMade(side.panel)).toBe('Glued up from');
    expect(rail?.panel && panelMade(rail.panel)).toBe('Ripped from');
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
    expect(plan.lines).toMatchObject([
      { nominal: '1x6 cherry', feet: 8, count: 1 },
      { nominal: '1x6 cherry', feet: 4, count: 1 },
    ]);
    expect(plan.boards.map((b) => [b.pieces.length, b.offcut])).toEqual([
      [4, 8.75],
      [2, 3.875],
    ]);
    // With no 8' board (#450): a 6' holds three pieces (1 + 3 x 21.5625 = 65.6875, under 72) and
    // the fourth needs 22.5625, so a 4'. No longer board is sold. The 4' line can only go longer.
    expect(plan.lines.map((l) => l.alternatives)).toEqual([
      [
        {
          kind: 'lengths',
          boards: [
            { feet: 6, count: 1 },
            { feet: 4, count: 1 },
          ],
        },
      ],
      [{ kind: 'lengths', boards: [{ feet: 6, count: 1 }] }],
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
    expect(plan.lines).toMatchObject([
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
      { description: '1/2" through-bolt, grip 5"', quantity: 5, group: 'Bolts', notes: [] },
      { description: '1/2" through-bolt, grip 6"', quantity: 1, group: 'Bolts', notes: [] },
    ]);
  });

  it('names a bolt by the length to buy, and keeps lengths and grips apart', () => {
    const lines = hardwareList([
      bolt('a', 2, 0.5, 8.9, { length: 10 }),
      bolt('b', 1, 0.5, 9, { length: 10 }),
      bolt('c', 1, 0.5, 9.4, { length: 10.5 }),
    ]);
    expect(lines.slice(0, 3).map((l) => [l.description, l.quantity])).toEqual([
      ['1/2" × 10" through-bolt', 2],
      ['1/2" × 10" through-bolt', 1],
      ['1/2" × 10-1/2" through-bolt', 1],
    ]);
  });

  it("carries each item's notes to its line, once each", () => {
    const noted = (id: string, notes: string[]) => ({ ...bolt(id, 1, 0.5, 5), notes });
    const lines = hardwareList([
      noted('a', ['Grip 5".', 'Galvanized.']),
      noted('b', ['Galvanized.', 'Leg bolts.']),
      { id: 'x', name: 'Hinge', quantity: 2, structural: false, notes: ['Brass.'], group: 'Other' },
    ]);
    expect(lines[0]?.notes).toEqual(['Grip 5".', 'Galvanized.', 'Leg bolts.']);
    // Fittings have none of their own.
    expect(lines.slice(1, -1).every((l) => l.notes.length === 0)).toBe(true);
    expect(lines.at(-1)?.notes).toEqual(['Brass.']);
  });

  it('totals only the fittings each bolt calls for', () => {
    const lines = hardwareList([
      bolt('a', 2, 0.5, 5, { washers: 1, nut: 'locking', cap: true }),
      bolt('b', 3, 0.5, 6),
      bolt('c', 1, 0.375, 4, { washers: 0 }),
    ]);
    expect(lines.slice(3)).toEqual([
      { description: '3/8" nuts', quantity: 1, group: 'Bolts', notes: [] },
      { description: '1/2" flat washers', quantity: 8, group: 'Bolts', notes: [] },
      { description: '1/2" locking nuts', quantity: 2, group: 'Bolts', notes: [] },
      { description: '1/2" nuts', quantity: 3, group: 'Bolts', notes: [] },
      { description: '1/2" bolt caps', quantity: 2, group: 'Bolts', notes: [] },
    ]);
  });

  it('lists other items by name after the bolts and fittings', () => {
    const lines = hardwareList([
      { id: 'x', name: 'Hinge', quantity: 2, structural: false, notes: [], group: 'Other' },
      bolt('a', 1, 0.5, 5),
    ]);
    expect(lines.at(-1)).toEqual({
      description: 'Hinge',
      quantity: 2,
      group: 'Other',
      notes: [],
    });
  });
});

describe('parts cut straight from board stock', () => {
  // Square leg stock, 1-1/2" sold in 3' and 4' lengths: four legs 7-1/2" long need
  // 2 × 1/2 trim + 4 × (7-1/2 + 1/8 kerf) = 31-1/2", so one 3' piece (36").
  const legStock: BoardStock = {
    nominal: '1-1/2" x 1-1/2"',
    thickness: 1.5,
    width: 1.5,
    buyableFeet: [3, 4],
  };
  const leg: Part = {
    id: 'leg',
    letter: 'A',
    name: 'Leg',
    role: 'leg',
    stock: legStock,
    quantity: 4,
    length: 7.5,
    markLengths: [],
    ends: [
      { setting: 0, description: 'Square', measuredFrom: 'reference-edge' },
      { setting: 0, description: 'Square', measuredFrom: 'reference-edge' },
    ],
    endsParallel: true,
    notes: [],
    selection: [],
    referenceEdge: 'inside edge',
    holes: [],
    boltAreas: [],
    tapers: [],
    dadoes: [],
    notches: [],
    cutouts: [],
    mortises: [],
    tenons: [],
    screwHoles: [],
    grooves: [],
    rabbets: [],
    recesses: [],
  };

  it('plans them on the stock’s own lengths', () => {
    const plan = planLumber([leg]);
    expect(plan.lines).toMatchObject([{ nominal: '1-1/2" x 1-1/2"', feet: 3, count: 1 }]);
    expect(plan.boards[0]?.offcut).toBe(4.5);
  });

  it('names the stock once when its name is its size, and with its size otherwise', () => {
    expect(cutList([leg])[0]?.stock).toBe('1-1/2" x 1-1/2"');
    const named = { ...leg, stock: { ...legStock, nominal: 'Maple leg stock' } };
    expect(cutList([named])[0]?.stock).toBe('Maple leg stock (1-1/2" x 1-1/2")');
    expect(cutList([leg])[0]).not.toHaveProperty('panel');
  });

  it('reads back as board stock, keeping its lengths', () => {
    expect(PartStock.parse(legStock)).toEqual(legStock);
    // Named like dimension lumber, it still keeps its own lengths.
    const twoByFour = { ...legStock, nominal: '2x4' };
    expect(PartStock.parse(twoByFour)).toEqual(twoByFour);
  });
});

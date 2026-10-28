import { describe, expect, it } from 'vitest';
import { stock } from '../lumber/stock.ts';
import type { SwingSetParams } from '../templates/swing-set-a-frame/params.ts';
import { generate } from '../templates/swing-set-a-frame/template.ts';
import type { Part } from '../templates/types.ts';
import { cutList } from './cutList.ts';
import { planLumber } from './shoppingList.ts';

// The swing-set worked example (docs/templates/swing-set-a-frame.md).
const example: SwingSetParams = {
  beamLength: 120,
  beamHeight: 96,
  splay: { kind: 'angle', degrees: 20 },
  beamStock: '4x6',
  beamPlies: 1,
  legStock: '4x4',
  crossbarStock: '2x6',
  crossbarHeight: 40,
  gussetStock: '2x8',
  frameInset: 12,
  groundSlope: 1,
  burialDepth: 24,
};

function parts(params: SwingSetParams): Part[] {
  const result = generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output.parts;
}

describe('cutList', () => {
  const rows = cutList(parts(example));
  const row = (id: string) => rows.find((r) => r.partId === id);

  it('shows nominal and actual stock, and lengths to the nearest 1/16', () => {
    expect(row('leg-back')).toMatchObject({
      name: 'Back leg (uphill)',
      quantity: 2,
      stock: '4x4 (3-1/2" x 3-1/2")',
      length: '131-1/2"',
    });
    expect(row('leg-front')?.length).toBe('138-3/8"');
    expect(row('crossbar')?.length).toBe('55-11/16"');
    expect(row('gusset')?.length).toBe('16-1/4"');
  });

  it('labels every angled end with the saw setting and the angle to the edge', () => {
    expect(row('leg-back')?.ends).toEqual([
      'Top: level cut; saw at 20.0°, 70.0° to the edge',
      'Foot: level cut; saw at 20.0°, 70.0° to the edge',
    ]);
    expect(row('beam')?.ends).toEqual(['Square', 'Square']);
  });

  it('formats mark lengths through the same formatter', () => {
    expect(row('crossbar')?.marks).toEqual([
      { label: 'Top edge', value: '51-11/16"' },
      { label: 'Bottom edge', value: '55-11/16"' },
    ]);
  });
});

describe('planLumber, worked example', () => {
  // Hand-checked with 1/8" kerf per piece and 1/2" trim at each end (1" per board):
  // beam 120 + 0.125 + 1 = 121.125 -> 12'; legs 139.479 and 132.635 each -> 12', one per board;
  // crossbars 1 + 2 x (55.7176 + 0.125) = 112.685 -> 10'; gussets 1 + 2 x 16.352 = 33.704 -> 8'.
  const plan = planLumber(parts(example));

  it('lists boards to buy', () => {
    expect(plan.lines).toEqual([
      { nominal: '4x6', feet: 12, count: 1 },
      { nominal: '4x4', feet: 12, count: 4 },
      { nominal: '2x6', feet: 10, count: 1 },
      { nominal: '2x8', feet: 8, count: 1 },
    ]);
    expect(plan.issues).toEqual([]);
  });

  it('records what comes from each board and the offcut', () => {
    const crossbarBoard = plan.boards.find((b) => b.nominal === '2x6');
    expect(crossbarBoard?.pieces.map((p) => p.partId)).toEqual(['crossbar', 'crossbar']);
    expect(crossbarBoard?.offcut).toBeCloseTo(7.315, 3);
    const legBoards = plan.boards.filter((b) => b.nominal === '4x4');
    expect(legBoards.map((b) => b.offcut)).toEqual([
      expect.closeTo(144 - 139.479, 3),
      expect.closeTo(144 - 139.479, 3),
      expect.closeTo(144 - 132.635, 3),
      expect.closeTo(144 - 132.635, 3),
    ]);
  });

  it('notes when a board one size down works if the store boards run long', () => {
    expect(plan.notes).toContain(
      `Beam: listed as 12' to leave room for trimming the ends. A 10' board works if it measures at least 121-1/8".`,
    );
  });
});

describe('planLumber, built-up beam', () => {
  // Two 2x6 plies (120) and two crossbars (55.218 with the narrower beam) share 2x6 boards:
  // 120 + 55.218 + 2 kerf + 1 trim = 176.468, so two 16' boards, each with one ply and one crossbar.
  const plan = planLumber(parts({ ...example, beamStock: '2x6', beamPlies: 2 }));

  it('puts each ply and a crossbar on one 16 foot board', () => {
    const twoBySix = plan.boards.filter((b) => b.nominal === '2x6');
    expect(twoBySix.map((b) => [b.feet, b.pieces.map((p) => p.partId)])).toEqual([
      [16, ['beam', 'crossbar']],
      [16, ['beam', 'crossbar']],
    ]);
    expect(twoBySix[0]?.offcut).toBeCloseTo(192 - 176.468, 3);
  });
});

describe('planLumber, edge cases', () => {
  const piece = (length: number, quantity = 1): Part => ({
    id: 'test',
    name: 'Test piece',
    role: 'leg',
    stock: stock('2x4'),
    quantity,
    length,
    markLengths: [],
    ends: [
      { setting: 0, description: 'Square' },
      { setting: 0, description: 'Square' },
    ],
    endsParallel: true,
    notes: [],
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

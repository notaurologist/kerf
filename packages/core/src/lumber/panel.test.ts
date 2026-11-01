import { describe, expect, it } from 'vitest';
import { type BoardStock, type PanelAllowances, PartStock, panelStock } from './panel.ts';
import { stock } from './stock.ts';

// 4/4 cherry surfaced two sides, 13/16" thick, which flattens to a 3/4" panel.
const cherry: BoardStock = {
  nominal: '4/4 cherry',
  thickness: 0.8125,
  width: 5.5,
  buyableFeet: [4, 6, 8],
};
const allowances: PanelAllowances = {
  jointPerEdge: 1 / 16,
  rip: 0.5,
  trimPerEnd: 1,
  flatten: 1 / 16,
};

function made(width: number, board = cherry, given = allowances) {
  const result = panelStock({ thickness: 0.75, width, length: 19.4375, board, allowances: given });
  if (!result.ok) throw new Error(result.issue.message);
  return result.stock;
}

describe('panelStock', () => {
  it('uses the fewest boards that cover the width when it is not a whole number of boards', () => {
    // 15 / 5-1/2 = 2.73 boards. n = ⌈(15 + 1/2 − 1/8) / (5-1/2 − 1/8)⌉ = ⌈15.375 / 5.375⌉ =
    // ⌈2.8605⌉ = 3. Glued width = 3 · 5.5 − 2 · (1/16) · 2 = 16.5 − 0.25 = 16.25, which leaves
    // 1.25 to rip off, at least the 1/2 asked for. Each board is 19-7/16 + 2 · 1 = 21-7/16 long.
    expect(made(15)).toEqual({
      thickness: 0.75,
      width: 15,
      board: cherry,
      boards: 3,
      boardLength: 21.4375,
      gluedWidth: 16.25,
      allowances,
    });
  });

  it('uses whole boards exactly when the width and allowances fill them', () => {
    // No allowances: 11 / 5.5 = 2 boards, glued to 11.
    const none = { jointPerEdge: 0, rip: 0, trimPerEnd: 0, flatten: 0 };
    expect(made(11, cherry, none)).toMatchObject({
      boards: 2,
      gluedWidth: 11,
      boardLength: 19.4375,
    });
    // (16 + 0.1 − 0.2) / (5.5 − 0.2) is 3 exactly, though in floating point it comes out as
    // 3.0000000000000004. Glued width = 3 · 5.5 − 2 · 0.1 · 2 = 16.1 = 16 + the 0.1 rip.
    const tenths = { jointPerEdge: 0.1, rip: 0.1, trimPerEnd: 0, flatten: 0 };
    const exact = made(16, cherry, tenths);
    expect(exact.boards).toBe(3);
    expect(exact.gluedWidth).toBeCloseTo(16.1, 12);
  });

  it('rips one board to width when the part is narrower than a board', () => {
    // ⌈(3 + 1/2 − 1/8) / 5.375⌉ = ⌈0.628⌉ = 1, with no glued edge: glued width is the board's.
    expect(made(3)).toMatchObject({ boards: 1, gluedWidth: 5.5 });
  });

  it('refuses a panel thicker than its boards', () => {
    const result = panelStock({ thickness: 1, width: 15, length: 20, board: cherry, allowances });
    expect(result).toMatchObject({ ok: false, issue: { code: 'panel-thicker-than-board' } });
  });

  it('refuses a glued-up panel thicker than its boards less flattening', () => {
    // 3/4" boards less 1/16" of flattening leave 11/16", short of a 3/4" panel.
    const board = { ...cherry, nominal: '1x6 poplar', thickness: 0.75 };
    const result = panelStock({ thickness: 0.75, width: 15, length: 20, board, allowances });
    expect(result).toEqual({
      ok: false,
      issue: {
        code: 'panel-thicker-than-flattened',
        message:
          'A 3/4" panel can\'t be glued up from 1x6 poplar: it is 3/4" thick, and flattening the glued-up panel takes off 1/16", leaving 11/16".',
        params: [],
      },
    });
    // 11/16" fits exactly, and one board ripped to width is not flattened, so 3/4" fits.
    expect(panelStock({ thickness: 0.6875, width: 15, length: 20, board, allowances }).ok).toBe(
      true,
    );
    expect(panelStock({ thickness: 0.75, width: 3, length: 20, board, allowances }).ok).toBe(true);
  });

  it('refuses boards that jointing both edges would use up', () => {
    const result = panelStock({
      thickness: 0.75,
      width: 15,
      length: 20,
      board: cherry,
      allowances: { ...allowances, jointPerEdge: 2.75 },
    });
    expect(result).toMatchObject({ ok: false, issue: { code: 'board-narrower-than-jointing' } });
  });
});

describe('PartStock', () => {
  it('reads dimension lumber and panel stock back unchanged', () => {
    expect(PartStock.parse(stock('2x4'))).toEqual(stock('2x4'));
    expect(PartStock.parse(made(15))).toEqual(made(15));
  });
});

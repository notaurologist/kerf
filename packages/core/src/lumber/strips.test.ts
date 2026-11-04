import { describe, expect, it } from 'vitest';
import type { BoardStock } from './panel.ts';
import { PartStock } from './partStock.ts';
import { type StripAllowances, stripBoardsFor, stripGlueUp } from './strips.ts';

// A dry 1x6, 3/4" by 5-1/2", with the record cabinet's suggested allowances (rules of thumb,
// #317) and a 1/8" saw kerf.
const cherry: BoardStock = {
  nominal: '1x6 cherry',
  thickness: 0.75,
  width: 5.5,
  buyableFeet: [4, 6, 8],
};
const allowances: StripAllowances = { rip: 0.5, trimPerEnd: 1, flatten: 1 / 16 };
const kerf = 0.125;

function top(board = cherry) {
  // A 61-7/8" by 17-5/8" top, 2-1/2" thick, of strips standing on edge.
  const result = stripGlueUp({
    thickness: 2.5,
    width: 17.625,
    length: 61.875,
    stackedAcross: 'width',
    board,
    allowances,
    kerf,
  });
  if (!result.ok) throw new Error(result.issue.message);
  return result.stock;
}

function leg(given = allowances) {
  // A 3" square leg, 34" long, of strips lying flat.
  const result = stripGlueUp({
    thickness: 3,
    width: 3,
    length: 34,
    stackedAcross: 'thickness',
    board: cherry,
    allowances: given,
    kerf,
  });
  if (!result.ok) throw new Error(result.issue.message);
  return result.stock;
}

describe('stripGlueUp', () => {
  it('glues a top deeper than one board gives strips for, from strips on edge', () => {
    // Each strip is ripped to the top's thickness plus flattening: 2-1/2 + 1/16 = 2-9/16.
    // Strips across the depth: ⌈(17-5/8 + 1/2) / 3/4⌉ = ⌈24.17⌉ = 25, glued to 25 · 3/4 = 18-3/4,
    // leaving 1-1/8 to rip off. One 5-1/2 board gives ⌊(5-1/2 + 1/8) / (2-9/16 + 1/8)⌋ =
    // ⌊2.09⌋ = 2 strips (2 · 2-9/16 + 1/8 = 5-1/4 of its width), 1-1/2 of depth, so the top needs
    // ⌈25 / 2⌉ = 13 boards. Each strip is 61-7/8 + 2 · 1 = 63-7/8 long.
    const made = top();
    expect(made).toEqual({
      thickness: 2.5,
      width: 17.625,
      board: cherry,
      stackedAcross: 'width',
      strips: 25,
      stripWidth: 2.5625,
      stripLength: 63.875,
      stripsPerBoard: 2,
      gluedAcross: 18.75,
      kerf,
      allowances,
    });
    expect(stripBoardsFor(made, 1)).toBe(13);
    // Two tops share boards: ⌈50 / 2⌉ = 25, not 2 · 13.
    expect(stripBoardsFor(made, 2)).toBe(25);
  });

  it('glues a 3" square leg from strips lying flat', () => {
    // Strips 3 + 1/16 = 3-1/16 wide. ⌈(3 + 1/2) / 3/4⌉ = ⌈4.67⌉ = 5 strips, glued to 3-3/4 and
    // ripped to 3. One board gives ⌊5-5/8 / 3-3/16⌋ = ⌊1.76⌋ = 1 strip, so 5 boards a leg, each
    // strip 34 + 2 = 36 long.
    const made = leg();
    expect(made).toMatchObject({
      strips: 5,
      stripWidth: 3.0625,
      stripLength: 36,
      stripsPerBoard: 1,
      gluedAcross: 3.75,
    });
    expect(stripBoardsFor(made, 4)).toBe(20);
    // With no rip allowance, four strips make 3 exactly: 3 / 3/4 = 4, with nothing to rip off.
    expect(leg({ ...allowances, rip: 0 })).toMatchObject({ strips: 4, gluedAcross: 3 });
  });

  it("gives board-foot stock the least width that holds a board's strips", () => {
    // 4/4 cherry surfaced to 13/16, planned 6-1/2 wide. ⌈(17-5/8 + 1/2) / 13/16⌉ = ⌈22.31⌉ = 23
    // strips, glued to 23 · 13/16 = 18-11/16. ⌊(6-1/2 + 1/8) / 2-11/16⌋ = ⌊2.47⌋ = 2 strips a
    // board, which need 2 · 2-9/16 + 1/8 = 5-1/4 of its width.
    const dealer: BoardStock = {
      nominal: '4/4 cherry',
      thickness: 0.8125,
      width: 6.5,
      buyableFeet: [8],
      byBoardFoot: { nominalThickness: 1, waste: 0.2 },
    };
    expect(top(dealer)).toMatchObject({
      strips: 23,
      gluedAcross: 18.6875,
      stripsPerBoard: 2,
      minBoardWidth: 5.25,
    });
  });

  it('refuses strips wider than the board', () => {
    // A 6" top needs strips 6-1/16 wide, more than a 5-1/2 board.
    const result = stripGlueUp({
      thickness: 6,
      width: 17.625,
      length: 60,
      stackedAcross: 'width',
      board: cherry,
      allowances,
      kerf,
    });
    expect(result).toEqual({
      ok: false,
      issue: {
        code: 'strip-wider-than-board',
        message:
          'A 6" glue-up needs strips 6-1/16" wide, with 1/16" for flattening, and 1x6 cherry is 5-1/2" wide.',
        params: [],
      },
    });
    // 5-7/16 + 1/16 is the board's width exactly, one strip a board.
    const exact = stripGlueUp({
      thickness: 5.4375,
      width: 17.625,
      length: 60,
      stackedAcross: 'width',
      board: cherry,
      allowances,
      kerf,
    });
    expect(exact.ok && exact.stock.stripsPerBoard).toBe(1);
  });

  it('refuses a glue-up of one strip', () => {
    // ⌈(1/4 + 1/2) / 3/4⌉ = 1.
    const result = stripGlueUp({
      thickness: 0.25,
      width: 3,
      length: 20,
      stackedAcross: 'thickness',
      board: cherry,
      allowances,
      kerf,
    });
    expect(result).toMatchObject({ ok: false, issue: { code: 'glue-up-of-one-strip' } });
  });
});

describe('PartStock', () => {
  it('reads a strip glue-up back unchanged', () => {
    expect(PartStock.parse(top())).toEqual(top());
  });
});

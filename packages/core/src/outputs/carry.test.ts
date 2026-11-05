import { describe, expect, it, vi } from 'vitest';
import * as exact from '../cutting/exact.ts';
import { stock } from '../lumber/stock.ts';
import type { Part } from '../model/types.ts';
import { type BoardOptions, boardOptionsFor, planLumber } from './shoppingList.ts';

// The longest board the owner can carry (#690), on made-up parts.

const calls: { workLimit: number; work: number }[] = [];
vi.mock('../cutting/exact.ts', async (actual) => {
  const real = await actual<typeof exact>();
  return {
    ...real,
    solveExact: (...args: Parameters<typeof real.solveExact>) => {
      const solved = real.solveExact(...args);
      calls.push({ workLimit: args[1]?.workLimit ?? Number.NaN, work: solved.work });
      return solved;
    },
  };
});

const piece = (length: number, quantity = 1, name = 'Test piece', nominal = '2x4'): Part => ({
  id: name.toLowerCase().replace(/ /g, '-'),
  letter: 'A',
  name,
  role: 'leg',
  stock: stock(nominal as '2x4'),
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
  dovetails: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles: [],
  hingePlates: [],
});

const options = (carryLength?: number, buyableFeet = [8, 16]): BoardOptions => ({
  kerf: 0.125,
  trimPerEnd: 0.5,
  buyableFeet,
  ...(carryLength !== undefined ? { carryLength } : {}),
});

const lines = (plan: ReturnType<typeof planLumber>) =>
  plan.lines.map((l) => [l.feet, l.count, l.notes]);

describe('planLumber with a carry length', () => {
  it('plans as before when no carry length is entered', () => {
    expect(boardOptionsFor()).not.toHaveProperty('carryLength');
    expect(boardOptionsFor({ carryLength: null })).not.toHaveProperty('carryLength');
    const plan = planLumber([piece(46, 4)], options());
    expect(plan).not.toHaveProperty('carryLength');
  });

  // Four 46" pieces: 1 + 4 x 46.125 = 185.5 fits one 16' (192); 1 + 2 x 46.125 = 93.25 fits an 8'
  // (96), so two 8's. Both buy 16 ft. Without a carry length the tie-break is fewer boards, one
  // 16'; with 8' (96") the plan with no board over it wins the tie.
  it('breaks a tie in feet toward boards within the carry length', () => {
    expect(lines(planLumber([piece(46, 4)], options()))).toEqual([
      [16, 1, ['No plan buys fewer feet of 2x4 with these allowances.']],
    ]);
    const carried = planLumber([piece(46, 4)], options(96));
    expect(carried.carryLength).toBe(96);
    expect(lines(carried)).toEqual([
      [8, 2, ['No plan buys fewer feet of 2x4 with these allowances.']],
    ]);
  });

  // Three 60" pieces: 1 + 3 x 60.125 = 181.375 fits one 16' (16 ft). On 8's, two need
  // 1 + 2 x 60.125 = 121.25, over 96, so one each: three 8's, 24 ft, 8 ft more.
  it('says what a plan with no board over the carry length costs when it buys more', () => {
    const plan = planLumber([piece(60, 3)], options(96));
    expect(lines(plan)).toEqual([
      [
        16,
        1,
        [
          'No plan buys fewer feet of 2x4 with these allowances.',
          `No boards over 8' 0" buys 8 ft more: 3 × 8'.`,
        ],
      ],
    ]);
  });

  // A 100" piece needs 101.125, over an 8' (96), so it needs the 16'. Nothing else is searched.
  it('says which pieces cannot avoid a board over the carry length', () => {
    const plan = planLumber([piece(100, 1, 'Rail'), piece(30, 2, 'Stile')], options(96));
    expect(lines(plan)).toEqual([
      [
        16,
        1,
        [
          'No plan buys fewer feet of 2x4 with these allowances.',
          `Rail is too long for a board of 8' 0" or shorter after trim and kerf, so this plan keeps boards over 8' 0".`,
        ],
      ],
    ]);
  });

  it('says when every length the stock is sold in is over the carry length', () => {
    const plan = planLumber([piece(30)], options(84));
    expect(plan.lines[0]?.notes).toContain(`2x4 is sold only in lengths over 7' 0".`);
  });

  it('notes only the lines over the carry length', () => {
    // The 100" rail and one 80" stile fill a 16' (1 + 100.125 + 80.125 = 181.25); the other stile
    // needs 81.125, so an 8'.
    const plan = planLumber([piece(100, 1, 'Rail'), piece(80, 2, 'Stile')], options(96));
    for (const line of plan.lines) {
      const noted = line.notes.some((n) => n.includes('too long'));
      expect(noted, `${line.feet}'`).toBe(line.feet > 8);
    }
  });

  // The carryable search for the 2x4 runs after both stocks' fewest-feet searches, with the work
  // they left: one limit for the whole plan.
  it('gives the carryable searches only the work the plan has left', () => {
    calls.length = 0;
    planLumber([piece(60, 3), piece(46, 4, 'Brace', '2x6')], options(96));
    expect(calls).toHaveLength(4);
    let left = exact.WORK_LIMIT;
    for (const call of calls) {
      expect(call.workLimit).toBe(Math.max(0, left));
      left -= call.work;
    }
  });
});

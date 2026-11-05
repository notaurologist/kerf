import { describe, expect, it } from 'vitest';
import { planLumber } from '../../outputs/shoppingList.ts';
import { workbench } from './definition.ts';

const example = workbench.examples[0];
if (!example) throw new Error('no worked example');
const made = workbench.generate(example.params, example.structuralInputs);
if (!made.ok) throw new Error('worked example does not generate');
const plan = planLumber(made.output.design.parts);
const BOARD = '13/16" x 5-1/2"';

describe('planLumber, worked example', () => {
  // Hand check: the 164 pieces of board stock total 4435.875", and each takes 1/8" of kerf, so
  // they need 4435.875 + 164 x 1/8 = 4456.375" of room. Boards come in 6', 8', and 10', so a
  // plan's feet are even. 374 ft takes at least 38 boards (37 x 10' is 370), and 38 boards lose
  // 38 x 1" of end trim, so 374 ft leaves at most 374 x 12 - 38 = 4450", short of 4456.375. So no
  // plan buys less than 376 ft. First-fit decreasing bought 386 ft in 39 boards; this plan buys
  // 376 ft in 38.
  it('buys the fewest feet of board stock, and says it is proven', () => {
    const boards = plan.boards.filter((b) => b.nominal === BOARD);
    const pieces = boards.flatMap((b) => b.pieces);
    expect(pieces).toHaveLength(164);
    expect(pieces.reduce((sum, p) => sum + p.length, 0)).toBe(4435.875);
    expect(boards.reduce((sum, b) => sum + b.feet, 0)).toBe(376);
    expect(boards).toHaveLength(38);
    for (const board of boards) expect(board.offcut).toBeGreaterThanOrEqual(0);
    const lines = plan.lines.filter((l) => l.nominal === BOARD);
    expect(lines.map((l) => [l.feet, l.count])).toEqual([
      [10, 37],
      [6, 1],
    ]);
    for (const line of lines) {
      expect(line.notes).toContain(`No plan buys fewer feet of ${BOARD} with these allowances.`);
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import { boardIds, planLumber } from '../../outputs/shoppingList.ts';
import { progressItems, progressToReset } from '../../progress/progress.ts';
import { readSnapshot } from '../../snapshot/snapshot.ts';
import { recordCabinet } from './definition.ts';
import v22 from './snapshots/v22.json' with { type: 'json' };
import v23 from './snapshots/v23.json' with { type: 'json' };

const example = recordCabinet.examples[0];
if (!example) throw new Error('no worked example');
const made = recordCabinet.generate(example.params, example.structuralInputs);
if (!made.ok) throw new Error('worked example does not generate');
const plan = planLumber(made.output.design.parts);
const CHERRY = '13/16" x 5-1/2"';

describe('planLumber, worked example', () => {
  // Hand check: the 45 cherry pieces total 1096", and each takes 1/8" of kerf, so they need
  // 1096 + 45 x 1/8 = 1101.625" of room. Boards come in 4', 6', and 8', so a plan's feet are even.
  // 92 ft takes at least 12 boards (11 x 8' is 88), and 12 boards lose 12 x 1" of end trim, so
  // 92 ft leaves at most 92 x 12 - 12 = 1092", short of 1101.625. So no plan buys less than 94
  // ft. First-fit decreasing bought 100 ft in 13 boards; this plan buys 94 ft in 14.
  it('buys the fewest feet of cherry, and says it is proven', () => {
    const boards = plan.boards.filter((b) => b.nominal === CHERRY);
    const pieces = boards.flatMap((b) => b.pieces);
    expect(pieces).toHaveLength(45);
    expect(pieces.reduce((sum, p) => sum + p.length, 0)).toBe(1096);
    expect(boards.reduce((sum, b) => sum + b.feet, 0)).toBe(94);
    expect(boards).toHaveLength(14);
    for (const board of boards) expect(board.offcut).toBeGreaterThanOrEqual(0);
    const lines = plan.lines.filter((l) => l.nominal === CHERRY);
    expect(lines.map((l) => [l.feet, l.count])).toEqual([
      [8, 6],
      [6, 7],
      [4, 1],
    ]);
    for (const line of lines) {
      expect(line.notes).toContain(`No plan buys fewer feet of ${CHERRY} with these allowances.`);
    }
  });

  // Version 23 replans the cherry. The first two 8' boards still hold what they held (56", 18-7/8",
  // 18-7/8" and 56", 18-7/8", 18"), and so does the leg stock's one board, so ticks on those stay;
  // every other cherry board changes or goes, and its tick is cleared (#444).
  it('keeps a tick on a board whose line is unchanged, and clears the rest', () => {
    const template = recordCabinet as TemplateDefinition;
    const outputs = (stored: unknown) => {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      return read.snapshot.outputs;
    };
    const before = progressItems(template, outputs(v22[0]));
    const after = progressItems(template, outputs(v23[0]));
    const ticked = before.filter((i) => i.kind === 'board');
    const cleared = new Set(progressToReset(ticked, before, after).map((r) => r.key));
    const kept = ticked.filter((i) => !cleared.has(i.key)).map((i) => i.key);
    expect(kept).toEqual([`${CHERRY}/8/1`, `${CHERRY}/8/2`, '1-1/2" x 1-1/2"/3/1']);
    expect([...cleared].every((key) => key.startsWith(`${CHERRY}/`))).toBe(true);
    expect(cleared.size).toBe(ticked.length - 3);
    const ids = boardIds(plan.boards);
    const held = (key: string) => plan.boards[ids.indexOf(key)];
    expect(held(`${CHERRY}/8/1`)?.pieces.map((p) => p.length)).toEqual([56, 18.875, 18.875]);
    expect(held(`${CHERRY}/8/2`)?.pieces.map((p) => p.length)).toEqual([56, 18.875, 18]);
  });
});

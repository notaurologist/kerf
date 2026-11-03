import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import { flagProgressKey, progressItems, progressToReset } from '../../progress/progress.ts';
import { readSnapshot } from '../../snapshot/snapshot.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';
import type { SwingSetParams } from './params.ts';
import v11 from './snapshots/v11.json' with { type: 'json' };
import v12 from './snapshots/v12.json' with { type: 'json' };

// Saved progress across a regeneration (#57), on the spec's worked example. Ticks stay only on
// items whose key is still in the plan with the same numbers.

const example = EXAMPLES[0];
if (!example) throw new Error('no worked example');

function generate(params: SwingSetParams) {
  const generated = swingSetAFrame.generate(params, example?.structuralInputs ?? {});
  if (!generated.ok) throw new Error('worked example does not generate');
  return generated.output;
}

const before = progressItems(swingSetAFrame, generate(example.params));
const { flags } = swingSetAFrame.plan(generate(example.params));
/** The expert check on the crossbar and gusset ends that project past the legs. */
const PROJECTING_ENDS = flagProgressKey(
  flags.find((f) => f.ask.startsWith("For the bolts' end distance")) ?? {
    category: 'load-bearing',
    ask: '',
  },
);
const keys = (kind: string) => before.filter((i) => i.kind === kind).map((i) => i.key);

describe('progress items for the worked example', () => {
  it('lists every line, board, piece, and step under a stable key', () => {
    expect(keys('shopping-line')).toEqual([
      'lumber/4x6/12',
      'lumber/4x4/12',
      'lumber/2x6/10',
      'lumber/2x8/8',
      'hardware/1/2" × 10" through-bolt',
      'hardware/1/2" × 6" through-bolt',
      'hardware/1/2" through-bolt, grip 5-1/2"',
      'hardware/1/2" flat washers',
      'hardware/1/2" locking nuts',
      'hardware/1/2" bolt caps',
      'hardware/Swing hangers',
      'hardware/Swing seats with chain',
      'hardware/Wood preservative for cut ends',
    ]);
    // The spec's boards: the beam on a 12' 4x6, each leg on its own 12' 4x4, both crossbars on a
    // 10' 2x6, both gussets on an 8' 2x8.
    expect(keys('board')).toEqual([
      '4x6/12/1',
      '4x4/12/1',
      '4x4/12/2',
      '4x4/12/3',
      '4x4/12/4',
      '2x6/10/1',
      '2x8/8/1',
    ]);
    expect(keys('part')).toEqual([
      'beam/0',
      'leg-back/0',
      'leg-back/1',
      'leg-front/0',
      'leg-front/1',
      'crossbar/0',
      'crossbar/1',
      'gusset/0',
      'gusset/1',
    ]);
    expect(keys('step')).toEqual([
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => `board-${n}`),
      'ease-edges',
      'treat-cuts',
      'site',
      'frames',
      'hanger-holes',
      'beam',
    ]);
    // Expert checks by category and what to ask, which carries the design's numbers.
    expect(keys('flag')).toEqual(flags.map((f) => `${f.category}/${f.ask}`));
    expect(keys('flag')).toHaveLength(6);
    expect(PROJECTING_ENDS).toContain(`2' 10-1/2" to 3' 4" above the ground`);
    expect(keys('checklist-item')).toEqual([
      'bolted-connections/Leg-to-beam bolt and gusset, each frame',
      'check-assumptions/Beam ends at the frames',
      'racking/A-frames and crossbars',
      'tipping-and-anchoring/Buried legs',
      'bolted-connections/Swing hangers',
      'lumber-quality/Beam and legs',
      'long-term-condition/Whole frame',
    ]);
  });

  it('keeps every tick when a change leaves the plan the same', () => {
    const after = progressItems(
      swingSetAFrame,
      generate({ ...example.params, swings: { ...example.params.swings, seatHeight: 18 } }),
    );
    expect(progressToReset(before, before, after)).toEqual([]);
  });

  it('clears the ticks a higher crossbar changes, and keeps the rest', () => {
    // Raising the crossbar from 40 to 44 shortens it by 2 · 4 · tan 20° = 2.912, from 58.993 to
    // 56.081. Both still fit the 10' 2x6 (1 + 2 · 56.206 = 113.41 ≤ 120), so every shopping line
    // stays. The legs' crossbar holes move 4 / cos 20° = 4.257 along them, so the legs' pieces
    // and every step that works on a leg change. The beam and gussets, their boards, and the site
    // work do not.
    const outputs = generate({ ...example.params, crossbarHeight: 44 });
    const board = swingSetAFrame.plan(outputs).lumber.boards[5];
    expect(board?.pieces.map((p) => p.length)).toEqual([
      expect.closeTo(56.081, 3),
      expect.closeTo(56.081, 3),
    ]);
    const reset = progressToReset(before, before, progressItems(swingSetAFrame, outputs));
    // The flag on the projecting ends names the crossbar ends' heights, 40 - 5.5 = 34.5 (2'
    // 10-1/2") to 40 (3' 4"): at 44 it asks about other heights, so it is another question and its
    // tick goes. No other flag or checklist item changes.
    const flag = reset.find((r) => r.kind === 'flag');
    const work = reset.filter((r) => r !== flag);
    expect(flag).toEqual({ kind: 'flag', key: PROJECTING_ENDS, reason: 'removed' });
    expect(work.every((r) => r.reason === 'changed')).toBe(true);
    expect(work.map((r) => `${r.kind} ${r.key}`)).toEqual([
      'board 2x6/10/1',
      'part leg-back/0',
      'part leg-back/1',
      'part leg-front/0',
      'part leg-front/1',
      'part crossbar/0',
      'part crossbar/1',
      'step board-2',
      'step board-3',
      'step board-4',
      'step board-5',
      'step board-6',
      'step ease-edges',
      'step treat-cuts',
      'step frames',
      'step beam',
    ]);
  });

  it('clears the lines and boards a stock change removes', () => {
    // 2x8 crossbars go on 2x8 boards with the gussets, so the 2x6 line and board and the old 8'
    // 2x8 line and board are gone, and the seventh board step with them.
    const after = progressItems(
      swingSetAFrame,
      generate({ ...example.params, crossbarStock: '2x8' }),
    );
    const removed = progressToReset(before, before, after)
      .filter((r) => r.reason === 'removed')
      .map((r) => `${r.kind} ${r.key}`);
    expect(removed).toEqual([
      'shopping-line lumber/2x6/10',
      'shopping-line lumber/2x8/8',
      'board 2x6/10/1',
      'board 2x8/8/1',
      'step board-7',
      `flag ${PROJECTING_ENDS}`,
    ]);
  });
});

describe('progress across the version 12 regeneration (#59)', () => {
  it('keeps ticks on shopping lines when only their store group is added', () => {
    // Against version 12's own plan: version 20 renames the bolt lines (#449).
    const lines = (fixture: unknown) => {
      const read = readSnapshot([swingSetAFrame as TemplateDefinition], fixture);
      if (!read.ok) throw new Error('fixture does not read');
      const stored = swingSetAFrame.storedOutputs.parse(read.snapshot.outputs);
      return progressItems(swingSetAFrame, stored).filter((i) => i.kind === 'shopping-line');
    };
    const old = lines(v11[0]);
    expect(progressToReset(old, old, lines(v12[0]))).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { progressItems, progressToReset } from '../../progress/progress.ts';
import { ResetRecord, recordResets, resetNotes } from '../../progress/resets.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';
import type { SwingSetParams } from './params.ts';

// A change made mid-build (#444), on the spec's worked example: what the owner did before the
// change, recorded when its tick clears, and what it needs now.

const example = EXAMPLES[0];
if (!example) throw new Error('no worked example');

function generate(params: Partial<SwingSetParams>) {
  const generated = swingSetAFrame.generate(
    { ...example?.params, ...params } as SwingSetParams,
    example?.structuralInputs ?? {},
  );
  if (!generated.ok) throw new Error('worked example does not generate');
  return generated.output;
}

/** The records and notes for ticks made on `from` once the plan is `to`. */
function change(
  from: ReturnType<typeof generate>,
  to: ReturnType<typeof generate>,
  ticked: { kind: 'part' | 'shopping-line' | 'step' | 'board'; key: string }[],
) {
  const reset = progressToReset(
    ticked,
    progressItems(swingSetAFrame, from),
    progressItems(swingSetAFrame, to),
  );
  const records = recordResets(swingSetAFrame, from, reset);
  return { records, notes: resetNotes(swingSetAFrame, to, records) };
}

const with4x6 = generate({ beamStock: '4x6' });
const with4x8 = generate({ beamStock: '4x8' });

describe('a deeper beam after a front leg is cut and the beam and bolts are bought', () => {
  // The worked example's front leg is 138.354 (138-3/8"). A 4x8 beam is 7-1/4" deep, 1-3/4"
  // deeper than a 4x6 (5-1/2"), so the leg's top moves 1.75 up and the leg, at 20° to the
  // vertical, grows 1.75 / cos 20° = 1.75 / 0.93969 = 1.862, to 140.216 (140-3/16"). The
  // difference rounds to 1-7/8". The leg still fits its 12' 4x4 (1 + 140.216 ≤ 144).
  const { records, notes } = change(with4x6, with4x8, [
    { kind: 'part', key: 'leg-front/0' },
    { kind: 'shopping-line', key: 'lumber/4x6/12' },
    { kind: 'shopping-line', key: 'hardware/1/2" × 10" through-bolt' },
  ]);

  it('records the piece at the length it was cut', () => {
    expect(records[0]).toEqual({
      kind: 'part',
      key: 'leg-front/0',
      reason: 'changed',
      was: {
        letter: 'C',
        name: 'Front leg (downhill)',
        instance: 0,
        length: expect.closeTo(138.354, 3),
      },
    });
  });

  it('names the piece with its old and new lengths, and the board to cut a new one from', () => {
    expect(notes[0]).toEqual({
      kind: 'part',
      key: 'leg-front/0',
      item: 'C Front leg (downhill), piece 1',
      change: 'cut at 138-3/8", now 140-3/16"',
      action:
        'It is 1-7/8" short. Cut a new one from another board: the shopping list adds a 4x4 × 12\' 0" for it.',
      // The first front leg is on the second board, cut in the second step.
      stepIds: ['board-2'],
      replacement: { nominal: '4x4', feet: 12, piece: 'C Front leg (downhill), piece 1' },
    });
  });

  // The leg bolts' grip falls by 1.75 · tan 20° = 0.637, to 8.310, so they fit from
  // 8.310 + 2 × 0.132 + 0.609 = 9.183 to 9.683: the line becomes 1/2" × 9-1/2" (#449).
  it('keeps a record of the beam and bolts bought, which the plan no longer has', () => {
    expect(notes.slice(1).map(({ item, change }) => ({ item, change }))).toEqual([
      { item: '4x6 × 12\' 0"', change: 'bought 1; no longer in the plan' },
      { item: '1/2" × 10" through-bolt', change: 'bought 2; no longer in the plan' },
    ]);
  });

  it('stores records that read back through their schema', () => {
    const stored = JSON.parse(JSON.stringify(records));
    expect(ResetRecord.array().parse(stored)).toEqual(records);
  });
});

describe('a shallower beam after a front leg is cut', () => {
  it('says the piece can be cut down by the difference', () => {
    const { notes } = change(with4x8, with4x6, [{ kind: 'part', key: 'leg-front/1' }]);
    expect(notes[0]).toMatchObject({
      item: 'C Front leg (downhill), piece 2',
      change: 'cut at 140-3/16", now 138-3/8"',
      action:
        'It is 1-7/8" long. Cut it down to 138-3/8", and check its end cuts and marks against the cut list.',
      stepIds: ['board-3'],
    });
    expect(notes[0]?.replacement).toBeUndefined();
  });
});

describe('a step and a board marked done', () => {
  it('names them by number and title, on the step they are about', () => {
    const { notes } = change(with4x6, with4x8, [
      { kind: 'board', key: '4x4/12/1' },
      { kind: 'step', key: 'board-2' },
    ]);
    expect(notes.map(({ item, change, stepIds }) => ({ item, change, stepIds }))).toEqual([
      {
        item: 'Board 2, 4x4 × 12\' 0"',
        change: 'marked done; its pieces changed',
        stepIds: ['board-2'],
      },
      {
        item: expect.stringMatching(/^Step 2, /),
        change: 'marked done; its numbers changed',
        stepIds: ['board-2'],
      },
    ]);
  });
});

describe('a bought line the plan needs more of', () => {
  it('says how many more to buy', () => {
    // Written by hand: no change to the worked example's values takes fewer of these bolts.
    const record = ResetRecord.parse({
      kind: 'shopping-line',
      key: 'hardware/1/2" × 6" through-bolt',
      reason: 'changed',
      was: { description: '1/2" × 6" through-bolt', quantity: 12 },
    });
    // The worked example takes 16 of these bolts.
    const [note] = resetNotes(swingSetAFrame, with4x6, [record]);
    expect(note).toMatchObject({ change: 'bought 12, now 16', action: 'Buy 4 more.' });
  });
});

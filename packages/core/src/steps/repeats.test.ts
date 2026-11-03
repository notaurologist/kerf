import { describe, expect, it } from 'vitest';
import type { FilledMethod, StepOperation } from './build.ts';
import { methodRepeats } from './repeats.ts';

const saw = (cut: string, depth: string): FilledMethod => ({
  id: 'crosscut-circular-saw',
  name: 'With a circular saw.',
  tools: [],
  setup: [`Set the blade a little deeper than the board is thick, ${depth}.`],
  technique: ['Hold the square tight to the edge.', `Cut ${cut} this way.`],
  mistakes: ['Letting the saw drift away from the square.'],
  safety: [
    { text: 'A circular saw kicks back toward you.', sources: [] },
    { text: 'Wear safety glasses.', sources: [] },
  ],
});
const op = (type: string, method?: FilledMethod) =>
  ({ operation: { type }, method }) as unknown as StepOperation;
const step = (...operations: StepOperation[]) => ({ operations });

describe('methodRepeats', () => {
  it('prints the first use in full, and later uses only the lines that differ', () => {
    const [first, later] = methodRepeats([
      step(op('crosscut', saw('1', '3/4"'))),
      step(op('crosscut', saw('2', '1-1/2"'))),
    ]).map((ops) => ops[0]);
    expect(first).toEqual({
      setup: [false],
      technique: [false, false],
      mistakes: [false],
      safety: [false, false],
    });
    expect(later).toEqual({
      firstStep: 1,
      setup: [false],
      technique: [true, false],
      mistakes: [true],
      safety: [false, false],
    });
  });

  it('counts the first use for each kind of operation', () => {
    const rip = { ...saw('1', '3/4"'), technique: ['Hold the square tight to the edge.'] };
    const [crosscut, ripped] = methodRepeats([
      step(op('crosscut', saw('1', '3/4"'))),
      step(op('rip', rip)),
    ]).map((ops) => ops[0]);
    expect(crosscut?.firstStep).toBeUndefined();
    expect(ripped?.firstStep).toBeUndefined();
    expect(ripped?.technique).toEqual([false]);
  });

  it('prints a safety line once in a step, and again on each later step', () => {
    const glue = {
      ...saw('1', '3/4"'),
      id: 'glue',
      safety: [{ text: 'Wear safety glasses.', sources: [] }],
    };
    const [[a, b, c] = [], [d] = []] = methodRepeats([
      step(op('crosscut', saw('1', '3/4"')), op('crosscut', saw('2', '3/4"')), op('glue', glue)),
      step(op('crosscut', saw('3', '3/4"'))),
    ]);
    expect(a?.safety).toEqual([false, false]);
    expect(b).toMatchObject({ firstStep: 1, safety: [true, true] });
    expect(c?.safety).toEqual([true]);
    expect(d).toMatchObject({ firstStep: 1, safety: [false, false] });
  });

  it('has nothing for an operation with no method', () => {
    expect(methodRepeats([step(op('crosscut'))])).toEqual([[undefined]]);
  });
});

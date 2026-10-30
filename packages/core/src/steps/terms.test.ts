import { describe, expect, it } from 'vitest';
import type { CutListRow } from '../outputs/cutList.ts';
import type { Flag } from '../templates/types.ts';
import type { BuildStep, FilledMethod } from './build.ts';
import { planTerms, planText } from './terms.ts';

const flag = (ask: string, why: string) => ({ category: 'load-bearing', ask, why }) as Flag;
const row = (ends: string[]) => ({ ends }) as CutListRow;
const method = (m: Partial<FilledMethod>): FilledMethod => ({
  id: 'm',
  name: 'M',
  tools: [],
  setup: [],
  technique: [],
  mistakes: [],
  safety: [],
  ...m,
});
const step = (flags: Flag[], methods: FilledMethod[]) =>
  ({
    flags: flags.map((f) => ({ ...f, sources: [] })),
    operations: methods.map((m) => ({ method: m })),
  }) as unknown as BuildStep;

describe('planTerms', () => {
  it('finds terms in flags, end cuts, and method setup, technique, and mistakes', () => {
    const plan = { flags: [flag('Confirm the gusset.', 'It holds.')], cutList: [row(['Square'])] };
    const steps = [
      step(
        [flag('Ask about the margins.', 'Why.')],
        [
          method({
            setup: ['Set no bevel.'],
            technique: ['Mark the long point.'],
            mistakes: ['Cutting on the waste side loses the kerf.'],
            safety: [{ text: 'Mind the offcut.', sources: [] }],
          }),
        ],
      ),
    ];
    expect(planTerms(plan, steps).map((e) => e.id)).toEqual([
      'bevel',
      'gusset',
      'kerf',
      'long-point',
      'margin',
    ]);
  });

  it('lists each term once, in the glossary’s alphabetical order', () => {
    const plan = {
      flags: [flag('The stock and the stock.', 'A miter.')],
      cutList: [row(['Top: miter', 'Foot: bevel'])],
    };
    expect(planTerms(plan, []).map((e) => e.term)).toEqual(['Bevel', 'Miter', 'Stock']);
  });

  it('leaves out tool names and steps with no method', () => {
    const plan = { flags: [], cutList: [] };
    const steps = [step([], []), step([], [method({ technique: ['Set the miter saw.'] })])];
    expect(planText(plan, steps)).toEqual(['Set the miter saw.']);
    expect(planTerms(plan, steps)).toEqual([]);
  });
});

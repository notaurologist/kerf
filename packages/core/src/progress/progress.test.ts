import { describe, expect, it } from 'vitest';
import { boardIds } from '../outputs/shoppingList.ts';
import {
  type ProgressItem,
  progressToReset,
  shoppingGroups,
  summarizeProgress,
} from './progress.ts';

describe('boardIds', () => {
  it('numbers each board within its line, so boards of other sizes do not shift it', () => {
    const boards = [
      { nominal: '4x4', feet: 12 },
      { nominal: '2x6', feet: 10 },
      { nominal: '4x4', feet: 12 },
      { nominal: '4x4', feet: 8 },
    ] as const;
    expect(boardIds(boards)).toEqual(['4x4/12/1', '2x6/10/1', '4x4/12/2', '4x4/8/1']);
    expect(boardIds(boards.filter((b) => b.nominal !== '2x6'))).toEqual([
      '4x4/12/1',
      '4x4/12/2',
      '4x4/8/1',
    ]);
  });
});

describe('progressToReset', () => {
  const item = (key: string, numbers: string): ProgressItem => ({ kind: 'step', key, numbers });
  const before = [item('a', '1'), item('b', '2'), item('c', '3')];

  it('keeps ticks whose key is still there with the same numbers', () => {
    const ticked = [{ kind: 'step' as const, key: 'a' }];
    expect(progressToReset(ticked, before, [item('a', '1')])).toEqual([]);
  });

  it('clears ticks whose key is gone or whose numbers changed, and says which', () => {
    const ticked = (['a', 'b', 'c'] as const).map((key) => ({ kind: 'step' as const, key }));
    expect(progressToReset(ticked, before, [item('a', '1'), item('b', '2.5')])).toEqual([
      { kind: 'step', key: 'b', reason: 'changed' },
      { kind: 'step', key: 'c', reason: 'removed' },
    ]);
  });

  it('matches on kind as well as key', () => {
    const ticked = [{ kind: 'board' as const, key: 'a' }];
    expect(progressToReset(ticked, before, before)).toEqual([
      { kind: 'board', key: 'a', reason: 'removed' },
    ]);
  });
});

describe('summarizeProgress', () => {
  const plan = {
    lumber: { lines: [{ nominal: '2x6' as const, feet: 10, count: 1 }] },
    hardware: [
      { description: 'Bolts', quantity: 4 },
      { description: 'Bolts', quantity: 2 },
      { description: 'Nuts', quantity: 4 },
    ],
  } as unknown as Parameters<typeof summarizeProgress>[0];
  const steps = [
    { id: 'a', title: 'Cut' },
    { id: 'b', title: 'Drill' },
    { id: 'c', title: 'Bolt' },
  ];

  it('counts shopping lines once each, and steps, and finds the first step not done', () => {
    expect(
      summarizeProgress(plan, steps, [
        { kind: 'shopping-line', key: 'hardware/Bolts' },
        { kind: 'step', key: 'a' },
        { kind: 'step', key: 'c' },
        { kind: 'board', key: 'b' },
      ]),
    ).toEqual({
      shopping: { done: 1, total: 3 },
      steps: { done: 2, total: 3 },
      nextStep: { id: 'b', number: 2, title: 'Drill' },
    });
  });

  it('has no next step when every step is done', () => {
    const ticked = steps.map((s) => ({ kind: 'step' as const, key: s.id }));
    expect(summarizeProgress(plan, steps, ticked).nextStep).toBeNull();
  });
});

describe('shoppingGroups', () => {
  it('puts lumber first, then each hardware group in the order its first line comes', () => {
    const plan = {
      lumber: {
        lines: [
          { nominal: '4x4' as const, feet: 12, count: 4 },
          { nominal: '2x6' as const, feet: 10, count: 1 },
        ],
      },
      hardware: [
        { description: 'Bolts', quantity: 4, group: 'Bolts and fittings' },
        { description: 'Hangers', quantity: 4, group: 'Swing hardware' },
        { description: 'Washers', quantity: 8, group: 'Bolts and fittings' },
        { description: 'Rope', quantity: 1 },
      ],
    } as unknown as Parameters<typeof shoppingGroups>[0];
    expect(shoppingGroups(plan).map((g) => [g.title, g.lines.map((l) => l.key)])).toEqual([
      ['Lumber', ['lumber/4x4/12', 'lumber/2x6/10']],
      ['Bolts and fittings', ['hardware/Bolts', 'hardware/Washers']],
      ['Swing hardware', ['hardware/Hangers']],
      ['Hardware', ['hardware/Rope']],
    ]);
  });
});

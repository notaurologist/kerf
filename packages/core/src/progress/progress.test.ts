import { describe, expect, it } from 'vitest';
import { boardIds } from '../outputs/shoppingList.ts';
import { type ProgressItem, progressToReset } from './progress.ts';

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

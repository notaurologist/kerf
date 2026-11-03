import { describe, expect, it } from 'vitest';
import { boardIds } from '../outputs/shoppingList.ts';
import {
  checklistProgressKey,
  flagProgressKey,
  isReviewProgress,
  PROGRESS_KINDS,
  type ProgressItem,
  progressToReset,
  shoppingGroups,
  summarizeProgress,
  summarizeReview,
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
    cutList: [
      { partId: 'post', quantity: 2 },
      { partId: 'rail', quantity: 1 },
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
        { kind: 'part', key: 'post/1' },
      ]),
    ).toEqual({
      shopping: { done: 1, total: 3 },
      // Each part's pieces, by quantity: post/0, post/1, rail/0.
      pieces: { done: 1, total: 3 },
      steps: { done: 2, total: 3 },
      nextStep: { id: 'b', number: 2, title: 'Drill' },
      // The ticks carry no times, so nothing says where the owner was.
      resumeStep: null,
    });
  });

  it('has no next step when every step is done', () => {
    const ticked = steps.map((s) => ({ kind: 'step' as const, key: s.id }));
    expect(summarizeProgress(plan, steps, ticked).nextStep).toBeNull();
  });

  describe('resumeStep (#460)', () => {
    const pieces = (...ids: string[]) =>
      ids.map((key) => {
        const [partId = '', instance = '0'] = key.split('/');
        return { partId, instance: Number(instance) };
      });
    const cutting = [
      { id: 'board-1', title: 'Cut board 1', board: { id: '2x6/10/1', pieces: pieces('rail/0') } },
      {
        id: 'board-2',
        title: 'Cut board 2',
        board: { id: '4x4/12/1', pieces: pieces('post/0', 'post/1') },
      },
      { id: 'bolt', title: 'Bolt' },
      { id: 'paint', title: 'Paint' },
    ];
    const at = (minute: number) => `2026-11-02T10:${String(minute).padStart(2, '0')}:00.000Z`;
    const resume = (ticked: Parameters<typeof summarizeProgress>[2]) =>
      summarizeProgress(plan, cutting, ticked).resumeStep;

    it('is the step of the most recent tick, even when an earlier step is not done', () => {
      const ticked = [
        { kind: 'shopping-line' as const, key: 'hardware/Bolts', doneAt: at(9) },
        { kind: 'part' as const, key: 'post/1', doneAt: at(5) },
      ];
      expect(resume(ticked)).toEqual({ id: 'board-2', number: 2, title: 'Cut board 2' });
      expect(summarizeProgress(plan, cutting, ticked).nextStep?.id).toBe('board-1');
    });

    it('takes the latest tick by time, not by the order the ticks come in', () => {
      expect(
        resume([
          { kind: 'part', key: 'rail/0', doneAt: at(7) },
          { kind: 'part', key: 'post/0', doneAt: at(3) },
        ])?.id,
      ).toBe('board-1');
    });

    it('finds a board tick by its board', () => {
      expect(resume([{ kind: 'board', key: '4x4/12/1', doneAt: at(1) }])?.id).toBe('board-2');
    });

    it('goes on to the step after one marked done, as Done, next does', () => {
      expect(resume([{ kind: 'step', key: 'board-2', doneAt: at(1) }])?.id).toBe('bolt');
      // The last step done goes back to the first step not done.
      expect(resume([{ kind: 'step', key: 'paint', doneAt: at(1) }])?.id).toBe('board-1');
    });

    it('breaks a tie between ticks saved together with the later step', () => {
      expect(
        resume([
          { kind: 'part', key: 'post/0', doneAt: at(4) },
          { kind: 'part', key: 'rail/0', doneAt: at(4) },
        ])?.id,
      ).toBe('board-2');
      // On one step, the step marked done is further along than a piece cut on it.
      expect(
        resume([
          { kind: 'step', key: 'board-2', doneAt: at(4) },
          { kind: 'part', key: 'post/1', doneAt: at(4) },
        ])?.id,
      ).toBe('bolt');
    });

    it('is null with no Building tick that has a time', () => {
      expect(resume([{ kind: 'part', key: 'post/0' }])).toBeNull();
      expect(resume([{ kind: 'flag', key: 'load-bearing/Bolt size?', doneAt: at(1) }])).toBeNull();
      // A tick on a step the plan no longer has.
      expect(resume([{ kind: 'step', key: 'gone', doneAt: at(1) }])).toBeNull();
    });
  });
});

describe('summarizeReview', () => {
  const flag = (ask: string) => ({ category: 'load-bearing' as const, ask });
  const item = (element: string) => ({ category: 'racking' as const, element });
  const plan = {
    // A flag repeated in a plan shares its tick, so it counts once.
    flags: [flag('Bolt size?'), flag('Burial depth?'), flag('Bolt size?')],
    checklist: [item('A-frames'), item('Beam')],
  } as unknown as Parameters<typeof summarizeReview>[0];

  it('counts the expert checks not asked and the checklist items not confirmed', () => {
    expect(
      summarizeReview(plan, [
        { kind: 'flag', key: flagProgressKey(flag('Bolt size?')) },
        { kind: 'checklist-item', key: checklistProgressKey(item('Beam')) },
        // Another kind with the same key is another item.
        { kind: 'step', key: flagProgressKey(flag('Burial depth?')) },
      ]),
    ).toEqual({ flags: { open: 1, total: 2 }, checklist: { open: 1, total: 2 } });
  });

  it('keys a flag by its category and ask, and a checklist item by its category and element', () => {
    expect(flagProgressKey(flag('Bolt size?'))).toBe('load-bearing/Bolt size?');
    expect(checklistProgressKey(item('Beam'))).toBe('racking/Beam');
  });
});

describe('isReviewProgress', () => {
  it('is true for the structural review kinds only', () => {
    expect(PROGRESS_KINDS.filter(isReviewProgress)).toEqual(['flag', 'checklist-item']);
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

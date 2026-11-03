import { describe, expect, it } from 'vitest';
import { describeReset } from './progress.ts';

const reset = (changed: number, removed: number) => [
  ...Array.from({ length: changed }, () => ({ reason: 'changed' as const })),
  ...Array.from({ length: removed }, () => ({ reason: 'removed' as const })),
];

describe('describeReset', () => {
  it('says nothing when no tick was cleared', () => {
    expect(describeReset(undefined)).toBeNull();
    expect(describeReset([])).toBeNull();
  });

  it('says how many were reset and why', () => {
    expect(describeReset(reset(1, 0))).toBe(
      '1 item marked done was reset because its numbers changed.',
    );
    expect(describeReset(reset(3, 0))).toBe(
      '3 items marked done were reset because their numbers changed.',
    );
    expect(describeReset(reset(0, 2))).toBe(
      '2 items marked done were reset because they are no longer in the plan.',
    );
    expect(describeReset(reset(3, 1))).toBe(
      '4 items marked done were reset: 3 have new numbers and 1 is no longer in the plan.',
    );
  });
});

describe('describeReset, with the project after the save', () => {
  const progress = (done: { shopping?: number; pieces?: number; steps?: number }) => ({
    shopping: { done: done.shopping ?? 0, total: 11 },
    pieces: { done: done.pieces ?? 0, total: 9 },
    steps: { done: done.steps ?? 0, total: 14 },
    nextStep: null,
    resumeStep: null,
  });
  const counted = '3 items marked done were reset because their numbers changed.';

  it('says why the status stays when nothing bought, cut, or built is left', () => {
    expect(describeReset(reset(3, 0), { status: 'in-progress', progress: progress({}) })).toBe(
      `${counted} The status stays In progress, because what you bought or built before this change is still done. Change it in Edit if it no longer fits.`,
    );
    expect(describeReset(reset(3, 0), { status: 'built', progress: progress({}) })).toContain(
      'The status stays Built,',
    );
  });

  it('says nothing about the status while some work is still ticked, or for a Planned project', () => {
    for (const done of [{ shopping: 1 }, { pieces: 1 }, { steps: 1 }]) {
      expect(describeReset(reset(3, 0), { status: 'in-progress', progress: progress(done) })).toBe(
        counted,
      );
    }
    expect(describeReset(reset(3, 0), { status: 'planned', progress: progress({}) })).toBe(counted);
    expect(describeReset(reset(3, 0), { status: 'in-progress', progress: null })).toBe(counted);
  });
});
